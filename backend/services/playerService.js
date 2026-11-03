const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const minecraftService = require('./minecraftService');
const rconService = require('./rconService');

function getOfflineUuid(username) {
    const md5 = crypto.createHash('md5').update('OfflinePlayer:' + username).digest();
    md5[6] = (md5[6] & 0x0f) | 0x30;
    md5[8] = (md5[8] & 0x3f) | 0x80;
    const hex = md5.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readJsonFile(filePath, fallback = []) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error(`[PlayerService] Error reading JSON file ${filePath}:`, e.message);
    }
    return fallback;
}

function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`[PlayerService] Error writing JSON file ${filePath}:`, e.message);
        return false;
    }
}

class PlayerService {
    getServerDir() {
        return minecraftService.serverDir;
    }

    getLevelName() {
        try {
            const propPath = path.join(this.getServerDir(), 'server.properties');
            if (fs.existsSync(propPath)) {
                const lines = fs.readFileSync(propPath, 'utf8').split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('level-name=')) {
                        return trimmed.substring('level-name='.length).trim() || 'world';
                    }
                }
            }
        } catch (e) {}
        return 'world';
    }

    isWhitelistEnabled() {
        try {
            const propPath = path.join(this.getServerDir(), 'server.properties');
            if (fs.existsSync(propPath)) {
                const lines = fs.readFileSync(propPath, 'utf8').split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('white-list=')) {
                        return trimmed.toLowerCase().includes('true');
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    async toggleWhitelist(enable = null) {
        const propPath = path.join(this.getServerDir(), 'server.properties');
        const current = this.isWhitelistEnabled();
        const target = typeof enable === 'boolean' ? enable : !current;

        if (fs.existsSync(propPath)) {
            const content = fs.readFileSync(propPath, 'utf8');
            let found = false;
            const updated = content.split(/\r?\n/).map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('white-list=')) {
                    found = true;
                    return `white-list=${target}`;
                }
                return line;
            });
            if (!found) {
                updated.push(`white-list=${target}`);
            }
            fs.writeFileSync(propPath, updated.join('\n') + '\n', 'utf8');
        }

        // If server is online, execute /whitelist on or /whitelist off
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`whitelist ${target ? 'on' : 'off'}`);
            } catch (e) {
                console.warn('[PlayerService] Failed to execute whitelist command live:', e.message);
            }
        }

        return { success: true, enabled: target, message: `Whitelist ${target ? 'enabled' : 'disabled'}` };
    }

    async executeMinecraftCommand(cmd) {
        if (minecraftService.status === 'online') {
            try {
                return await rconService.executeCommand(cmd);
            } catch (err) {
                // If RCON fails, fallback to sending via stdin
                return minecraftService.sendCommand(cmd);
            }
        }
        return null;
    }

    /**
     * Resolves UUID from usercache, Mojang API (if online-mode), or generates offline UUID
     */
    async resolvePlayerIdentity(username) {
        const usercachePath = path.join(this.getServerDir(), 'usercache.json');
        const usercache = readJsonFile(usercachePath, []);
        const entry = usercache.find(p => p.name && p.name.toLowerCase() === username.toLowerCase());
        if (entry && entry.uuid) {
            return { name: entry.name, uuid: entry.uuid };
        }

        // Attempt online Mojang lookup with a short timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.id) {
                    const raw = data.id.replace(/-/g, '');
                    const formatted = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
                    return { name: data.name || username, uuid: formatted };
                }
            }
        } catch (e) {
            // Fallback to offline UUID if offline or rate limited
        }

        return { name: username, uuid: getOfflineUuid(username) };
    }

    /**
     * Returns all known players consolidated from usercache, whitelist, ops, bans, and world/playerdata
     */
    async getAllPlayers() {
        const serverDir = this.getServerDir();
        const usercachePath = path.join(serverDir, 'usercache.json');
        const whitelistPath = path.join(serverDir, 'whitelist.json');
        const opsPath = path.join(serverDir, 'ops.json');
        const bannedPlayersPath = path.join(serverDir, 'banned-players.json');
        const bannedIpsPath = path.join(serverDir, 'banned-ips.json');

        const usercache = readJsonFile(usercachePath, []);
        const whitelist = readJsonFile(whitelistPath, []);
        const ops = readJsonFile(opsPath, []);
        const bannedPlayers = readJsonFile(bannedPlayersPath, []);
        const bannedIps = readJsonFile(bannedIpsPath, []);

        // Read playerdata timestamps if available
        const levelName = this.getLevelName();
        const playerdataDir = path.join(serverDir, levelName, 'playerdata');
        const lastSeenMap = new Map();

        try {
            if (fs.existsSync(playerdataDir)) {
                const files = fs.readdirSync(playerdataDir);
                for (const f of files) {
                    if (f.endsWith('.dat')) {
                        const uuid = f.replace('.dat', '');
                        const stat = fs.statSync(path.join(playerdataDir, f));
                        lastSeenMap.set(uuid.toLowerCase(), stat.mtime);
                    }
                }
            }
        } catch (e) {
            console.error('[PlayerService] Error reading playerdata:', e.message);
        }

        // Live online players check (RCON + Console logs hybrid)
        let onlineUsernames = [];
        if (minecraftService.status === 'online') {
            try {
                const rconPlayers = await rconService.getOnlinePlayers();
                if (rconPlayers && Array.isArray(rconPlayers.players) && !rconPlayers.error) {
                    onlineUsernames = rconPlayers.players.map(p => p.toLowerCase());
                    if (minecraftService.onlinePlayers) {
                        for (const p of rconPlayers.players) {
                            minecraftService.onlinePlayers.add(p);
                        }
                    }
                }
            } catch (e) {
                console.error('[PlayerService] Failed to query online players:', e.message);
            }

            // Also merge in console-tracked players from server logs
            if (minecraftService.onlinePlayers && minecraftService.onlinePlayers.size > 0) {
                for (const p of minecraftService.onlinePlayers) {
                    const low = p.toLowerCase();
                    if (!onlineUsernames.includes(low)) {
                        onlineUsernames.push(low);
                    }
                }
            }
        }

        const uuidToKey = new Map();
        const playersMap = new Map();

        const getOrCreate = (name, uuid) => {
            const cleanName = (name && name !== 'Unknown') ? name : null;
            const cleanUuid = uuid ? uuid.toLowerCase() : null;

            let key = null;
            if (cleanName && playersMap.has(cleanName.toLowerCase())) {
                key = cleanName.toLowerCase();
            } else if (cleanUuid && uuidToKey.has(cleanUuid)) {
                key = uuidToKey.get(cleanUuid);
            } else if (cleanName) {
                key = cleanName.toLowerCase();
            } else if (cleanUuid) {
                key = cleanUuid;
            } else {
                return null;
            }

            if (!playersMap.has(key)) {
                playersMap.set(key, {
                    name: cleanName || 'Unknown',
                    uuid: cleanUuid || getOfflineUuid(cleanName || 'Unknown'),
                    isOnline: false,
                    isWhitelisted: false,
                    isOp: false,
                    opLevel: 0,
                    isBanned: false,
                    banReason: null,
                    banDate: null,
                    lastSeen: null
                });
            }

            const record = playersMap.get(key);
            if (cleanName && record.name === 'Unknown') {
                record.name = cleanName;
            }
            if (cleanUuid) {
                record.uuid = cleanUuid;
                uuidToKey.set(cleanUuid, key);
            }
            if (cleanName) {
                uuidToKey.set(cleanName.toLowerCase(), key);
            }
            return record;
        };

        // 1. Process Usercache
        if (Array.isArray(usercache)) {
            for (const item of usercache) {
                if (item.name) {
                    const record = getOrCreate(item.name, item.uuid);
                    if (record && item.expiresOn) {
                        record.cacheExpires = item.expiresOn;
                    }
                }
            }
        }

        // 2. Process Whitelist
        if (Array.isArray(whitelist)) {
            for (const item of whitelist) {
                if (item.name || item.uuid) {
                    const record = getOrCreate(item.name, item.uuid);
                    if (record) record.isWhitelisted = true;
                }
            }
        }

        // 3. Process Ops
        if (Array.isArray(ops)) {
            for (const item of ops) {
                if (item.name || item.uuid) {
                    const record = getOrCreate(item.name, item.uuid);
                    if (record) {
                        record.isOp = true;
                        record.opLevel = item.level || 4;
                    }
                }
            }
        }

        // 4. Process Banned Players
        if (Array.isArray(bannedPlayers)) {
            for (const item of bannedPlayers) {
                if (item.name || item.uuid) {
                    const record = getOrCreate(item.name, item.uuid);
                    if (record) {
                        record.isBanned = true;
                        record.banReason = item.reason || 'Banned by operator';
                        record.banDate = item.created || null;
                    }
                }
            }
        }

        // 5. Check Online Status & Last Seen
        for (const [key, record] of playersMap.entries()) {
            if (onlineUsernames.includes(record.name.toLowerCase())) {
                record.isOnline = true;
            }
            if (record.uuid && lastSeenMap.has(record.uuid.toLowerCase())) {
                record.lastSeen = lastSeenMap.get(record.uuid.toLowerCase());
            }
        }

        // 6. Ensure any currently online player not in cache is included
        for (const onName of onlineUsernames) {
            const record = getOrCreate(onName);
            if (record) record.isOnline = true;
        }

        const playerList = Array.from(playersMap.values()).sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.name.localeCompare(b.name);
        });

        return {
            players: playerList,
            onlineCount: playerList.filter(p => p.isOnline).length,
            totalCount: playerList.length,
            whitelistEnabled: this.isWhitelistEnabled(),
            serverStatus: minecraftService.status,
            bannedIps: Array.isArray(bannedIps) ? bannedIps : []
        };
    }

    /**
     * Add to whitelist
     */
    async addWhitelist(username) {
        if (!username || typeof username !== 'string') throw new Error('Player username is required');
        const clean = username.trim();

        // 1. Update whitelist.json on disk
        const whitelistPath = path.join(this.getServerDir(), 'whitelist.json');
        const whitelist = readJsonFile(whitelistPath, []);
        const existing = whitelist.find(p => p.name && p.name.toLowerCase() === clean.toLowerCase());
        if (!existing) {
            const identity = await this.resolvePlayerIdentity(clean);
            whitelist.push({ uuid: identity.uuid, name: identity.name });
            writeJsonFile(whitelistPath, whitelist);
        }

        // 2. If server is online, execute command & reload in Minecraft
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`whitelist add ${clean}`);
            } catch (e) {
                console.warn('[PlayerService] Live whitelist add failed, reloading from disk:', e.message);
            }
            try {
                await this.executeMinecraftCommand(`whitelist reload`);
            } catch (e) {}
        }
        return { success: true, message: `Added ${clean} to whitelist` };
    }

    /**
     * Remove from whitelist
     */
    async removeWhitelist(username) {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();

        // 1. Update whitelist.json on disk
        const whitelistPath = path.join(this.getServerDir(), 'whitelist.json');
        let whitelist = readJsonFile(whitelistPath, []);
        whitelist = whitelist.filter(p => !p.name || p.name.toLowerCase() !== clean.toLowerCase());
        writeJsonFile(whitelistPath, whitelist);

        // 2. If server is online, execute command & reload in Minecraft
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`whitelist remove ${clean}`);
            } catch (e) {
                console.warn('[PlayerService] Live whitelist remove failed, reloading from disk:', e.message);
            }
            try {
                await this.executeMinecraftCommand(`whitelist reload`);
            } catch (e) {}
        }
        return { success: true, message: `Removed ${clean} from whitelist` };
    }

    /**
     * Add operator
     */
    async addOp(username, level = 4) {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();

        // 1. Update ops.json on disk
        const opsPath = path.join(this.getServerDir(), 'ops.json');
        const ops = readJsonFile(opsPath, []);
        const existing = ops.find(p => p.name && p.name.toLowerCase() === clean.toLowerCase());
        if (!existing) {
            const identity = await this.resolvePlayerIdentity(clean);
            ops.push({
                uuid: identity.uuid,
                name: identity.name,
                level: parseInt(level, 10) || 4,
                bypassesPlayerLimit: false
            });
            writeJsonFile(opsPath, ops);
        }

        // 2. If server is online, execute live command
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`op ${clean}`);
            } catch (e) {
                console.warn('[PlayerService] Live op command failed:', e.message);
            }
        }
        return { success: true, message: `Granted Operator to ${clean}` };
    }

    /**
     * Remove operator
     */
    async removeOp(username) {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();

        // 1. Update ops.json on disk
        const opsPath = path.join(this.getServerDir(), 'ops.json');
        let ops = readJsonFile(opsPath, []);
        ops = ops.filter(p => !p.name || p.name.toLowerCase() !== clean.toLowerCase());
        writeJsonFile(opsPath, ops);

        // 2. If server is online, execute live command
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`deop ${clean}`);
            } catch (e) {
                console.warn('[PlayerService] Live deop command failed:', e.message);
            }
        }
        return { success: true, message: `Revoked Operator from ${clean}` };
    }

    /**
     * Ban player
     */
    async banPlayer(username, reason = 'Banned by operator') {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();
        const cleanReason = (reason || 'Banned by operator').trim();

        // 1. Update banned-players.json on disk
        const bannedPlayersPath = path.join(this.getServerDir(), 'banned-players.json');
        const bans = readJsonFile(bannedPlayersPath, []);
        const existing = bans.find(p => p.name && p.name.toLowerCase() === clean.toLowerCase());
        if (!existing) {
            const identity = await this.resolvePlayerIdentity(clean);
            bans.push({
                uuid: identity.uuid,
                name: identity.name,
                created: new Date().toISOString(),
                source: 'Obsidian Panel',
                expires: 'forever',
                reason: cleanReason
            });
            writeJsonFile(bannedPlayersPath, bans);
        }

        // 2. If server is online, execute live command
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`ban ${clean} ${cleanReason}`);
            } catch (e) {
                console.warn('[PlayerService] Live ban command failed:', e.message);
            }
        }
        return { success: true, message: `Banned player ${clean}` };
    }

    /**
     * Unban player
     */
    async unbanPlayer(username) {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();

        // 1. Update banned-players.json on disk
        const bannedPlayersPath = path.join(this.getServerDir(), 'banned-players.json');
        let bans = readJsonFile(bannedPlayersPath, []);
        bans = bans.filter(p => !p.name || p.name.toLowerCase() !== clean.toLowerCase());
        writeJsonFile(bannedPlayersPath, bans);

        // 2. If server is online, execute live command
        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`pardon ${clean}`);
            } catch (e) {
                console.warn('[PlayerService] Live pardon command failed:', e.message);
            }
        }
        return { success: true, message: `Pardoned player ${clean}` };
    }

    /**
     * Ban IP
     */
    async banIp(ip, reason = 'Banned by operator') {
        if (!ip) throw new Error('IP address is required');
        const cleanIp = ip.trim();
        const cleanReason = (reason || 'Banned by operator').trim();

        const bannedIpsPath = path.join(this.getServerDir(), 'banned-ips.json');
        const bans = readJsonFile(bannedIpsPath, []);
        const existing = bans.find(item => item.ip === cleanIp);
        if (!existing) {
            bans.push({
                ip: cleanIp,
                created: new Date().toISOString(),
                source: 'Obsidian Panel',
                expires: 'forever',
                reason: cleanReason
            });
            writeJsonFile(bannedIpsPath, bans);
        }

        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`ban-ip ${cleanIp} ${cleanReason}`);
            } catch (e) {
                console.warn('[PlayerService] Live ban-ip command failed:', e.message);
            }
        }
        return { success: true, message: `Banned IP ${cleanIp}` };
    }

    /**
     * Unban IP
     */
    async unbanIp(ip) {
        if (!ip) throw new Error('IP address is required');
        const cleanIp = ip.trim();

        const bannedIpsPath = path.join(this.getServerDir(), 'banned-ips.json');
        let bans = readJsonFile(bannedIpsPath, []);
        bans = bans.filter(item => item.ip !== cleanIp);
        writeJsonFile(bannedIpsPath, bans);

        if (minecraftService.status === 'online') {
            try {
                await this.executeMinecraftCommand(`pardon-ip ${cleanIp}`);
            } catch (e) {
                console.warn('[PlayerService] Live pardon-ip command failed:', e.message);
            }
        }
        return { success: true, message: `Pardoned IP ${cleanIp}` };
    }

    /**
     * Kick player
     */
    async kickPlayer(username, reason = 'Kicked by operator') {
        if (!username) throw new Error('Player username is required');
        const clean = username.trim();
        const cleanReason = (reason || 'Kicked by operator').trim();

        if (minecraftService.status === 'online') {
            await this.executeMinecraftCommand(`kick ${clean} ${cleanReason}`);
            return { success: true, message: `Kicked player ${clean}` };
        }
        throw new Error('Server must be online to kick players');
    }
}

const playerService = new PlayerService();
module.exports = playerService;

