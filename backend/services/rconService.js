const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

class RconService {
    constructor() {
        this.socket = null;
        this.isAuthenticated = false;
        this.connectingPromise = null;
        this.commandQueue = [];
        this.isProcessingQueue = false;
        this.activeRequest = null;
        this.responseBuffer = Buffer.alloc(0);
        this.currentConfig = {
            port: 0,
            password: '',
            enabled: false,
            rconSilent: true,
            rconDisableColors: false,
            rconRawOutput: false
        };
        this.cachedPlayers = {
            count: 0,
            max: 0,
            players: [],
            lastUpdated: null
        };
        this.reqIdCounter = 1;
    }

    /**
     * Ensures server.properties has RCON enabled, with a random port, random password,
     * and broadcast-rcon-to-ops=false (silent mode so RCON logs don't clutter console).
     */
    ensureRconConfigured(serverDir, existingConfig = {}) {
        try {
            const propPath = path.join(serverDir, 'server.properties');
            let content = '';
            const properties = {};

            if (fs.existsSync(propPath)) {
                content = fs.readFileSync(propPath, 'utf8');
                content.split(/\r?\n/).forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const idx = trimmed.indexOf('=');
                        const key = trimmed.slice(0, idx).trim();
                        const val = trimmed.slice(idx + 1).trim();
                        properties[key] = val;
                    }
                });
            }

            let needsUpdate = false;

            // 1. Enable RCON
            if (properties['enable-rcon'] !== 'true') {
                properties['enable-rcon'] = 'true';
                needsUpdate = true;
            }

            // 2. Silent mode (-s): do not broadcast RCON commands to console/operators
            const isSilent = existingConfig.rconSilent !== undefined ? Boolean(existingConfig.rconSilent) : true;
            const broadcastValue = isSilent ? 'false' : 'true';
            if (properties['broadcast-rcon-to-ops'] !== broadcastValue) {
                properties['broadcast-rcon-to-ops'] = broadcastValue;
                needsUpdate = true;
            }

            // 3. RCON Port (random port between 25575 and 29999 if not set)
            let rconPort = parseInt(properties['rcon.port'], 10);
            if (!rconPort || isNaN(rconPort) || rconPort <= 1024 || rconPort > 65535) {
                if (existingConfig.rconPort && existingConfig.rconPort > 1024) {
                    rconPort = existingConfig.rconPort;
                } else {
                    // Random unprivileged port in high range
                    rconPort = 25575 + Math.floor(Math.random() * 4000);
                }
                properties['rcon.port'] = String(rconPort);
                needsUpdate = true;
            }

            // 4. RCON Password (cryptographically random if not set)
            let rconPassword = properties['rcon.password'];
            if (!rconPassword || rconPassword.trim() === '') {
                if (existingConfig.rconPassword && existingConfig.rconPassword.trim() !== '') {
                    rconPassword = existingConfig.rconPassword.trim();
                } else {
                    rconPassword = crypto.randomBytes(12).toString('hex');
                }
                properties['rcon.password'] = rconPassword;
                needsUpdate = true;
            }

            // 5. Ensure whitelist is explicitly false by default (do not turn on whitelist by default)
            if (properties['white-list'] === undefined) {
                properties['white-list'] = 'false';
                needsUpdate = true;
            }

            if (properties['enforce-whitelist'] === undefined) {
                properties['enforce-whitelist'] = 'false';
                needsUpdate = true;
            }

            if (needsUpdate || !fs.existsSync(propPath)) {
                // Ensure server-port is present
                if (!properties['server-port']) {
                    properties['server-port'] = '25565';
                }

                // If file existed, replace/append lines while preserving comments
                let newLines = [];
                const touchedKeys = new Set();

                if (content) {
                    content.split(/\r?\n/).forEach(line => {
                        const trimmed = line.trim();
                        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                            const key = trimmed.split('=')[0].trim();
                            if (properties[key] !== undefined) {
                                newLines.push(`${key}=${properties[key]}`);
                                touchedKeys.add(key);
                            } else {
                                newLines.push(line);
                            }
                        } else {
                            newLines.push(line);
                        }
                    });
                }

                // Add any missing properties
                ['enable-rcon', 'rcon.port', 'rcon.password', 'broadcast-rcon-to-ops', 'server-port', 'white-list', 'enforce-whitelist'].forEach(k => {
                    if (!touchedKeys.has(k) && properties[k] !== undefined) {
                        newLines.push(`${k}=${properties[k]}`);
                    }
                });

                fs.writeFileSync(propPath, newLines.join('\n') + '\n', 'utf8');
                console.log(`[RconService] Configured server.properties: RCON port=${rconPort}, silent=${isSilent}`);
            }

            // If credentials changed while connected, reset socket to reconnect with new credentials
            if (this.socket && (this.currentConfig.port !== rconPort || this.currentConfig.password !== rconPassword)) {
                this.disconnect();
            }

            this.currentConfig = {
                port: rconPort,
                password: rconPassword,
                enabled: true,
                rconSilent: isSilent,
                rconDisableColors: Boolean(existingConfig.rconDisableColors),
                rconRawOutput: Boolean(existingConfig.rconRawOutput)
            };

            return this.currentConfig;
        } catch (err) {
            console.error('[RconService] Error ensuring RCON configured:', err.message);
            return this.currentConfig;
        }
    }

    /**
     * Builds an RCON binary packet according to the Valve Source / Minecraft RCON protocol.
     */
    _buildPacket(id, type, body) {
        const bodyBuf = Buffer.from(body, 'utf8');
        const size = 4 + 4 + bodyBuf.length + 2;
        const buf = Buffer.alloc(4 + size);
        buf.writeInt32LE(size, 0);
        buf.writeInt32LE(id, 4);
        buf.writeInt32LE(type, 8);
        bodyBuf.copy(buf, 12);
        buf.writeUInt8(0, 12 + bodyBuf.length);
        buf.writeUInt8(0, 13 + bodyBuf.length);
        return buf;
    }

    /**
     * Establishes or reuses a persistent RCON connection.
     */
    async connect(config = null) {
        if (this.socket && this.isAuthenticated && !this.socket.destroyed) {
            return true;
        }

        if (this.connectingPromise) {
            return this.connectingPromise;
        }

        const port = (config && config.port) || this.currentConfig.port;
        const password = (config && config.password) || this.currentConfig.password;

        if (!port || !password) {
            return Promise.reject(new Error('RCON is not configured or port/password missing'));
        }

        this.connectingPromise = new Promise((resolve, reject) => {
            let socket = null;
            let authTimer = null;
            let hasSettled = false;

            const cleanupConnection = (err) => {
                if (hasSettled) return;
                hasSettled = true;
                if (authTimer) clearTimeout(authTimer);
                if (socket) {
                    socket.removeAllListeners();
                    socket.destroy();
                }
                this.socket = null;
                this.isAuthenticated = false;
                this.connectingPromise = null;
                reject(err);
            };

            authTimer = setTimeout(() => {
                cleanupConnection(new Error('RCON connection/authentication timed out'));
            }, 4000);

            try {
                socket = net.connect({ host: '127.0.0.1', port }, () => {
                    const authPacket = this._buildPacket(1, SERVERDATA_AUTH, password);
                    socket.write(authPacket);
                });
            } catch (err) {
                cleanupConnection(err);
                return;
            }

            this.responseBuffer = Buffer.alloc(0);

            socket.on('error', (err) => {
                if (!this.isAuthenticated) {
                    cleanupConnection(err);
                } else {
                    this._handleSocketError(err);
                }
            });

            socket.on('close', () => {
                if (!this.isAuthenticated) {
                    cleanupConnection(new Error('RCON socket closed before authentication'));
                } else {
                    this._handleSocketClose();
                }
            });

            socket.on('data', (chunk) => {
                this.responseBuffer = Buffer.concat([this.responseBuffer, chunk]);

                while (this.responseBuffer.length >= 14) {
                    const packetSize = this.responseBuffer.readInt32LE(0);
                    const totalSize = 4 + packetSize;

                    if (this.responseBuffer.length < totalSize) {
                        break;
                    }

                    const packetId = this.responseBuffer.readInt32LE(4);
                    const packetType = this.responseBuffer.readInt32LE(8);
                    const body = this.responseBuffer.toString('utf8', 12, totalSize - 2);
                    this.responseBuffer = this.responseBuffer.slice(totalSize);

                    if (!this.isAuthenticated) {
                        if (packetId === -1) {
                            cleanupConnection(new Error('RCON authentication failed (invalid password)'));
                            return;
                        }
                        if (packetType === SERVERDATA_AUTH_RESPONSE && packetId === 1) {
                            if (authTimer) clearTimeout(authTimer);
                            this.isAuthenticated = true;
                            this.socket = socket;
                            this.connectingPromise = null;
                            hasSettled = true;
                            resolve(true);
                            return;
                        }
                    } else if (this.activeRequest && packetType === SERVERDATA_RESPONSE_VALUE && packetId === this.activeRequest.cmdId) {
                        const req = this.activeRequest;
                        this.activeRequest = null;
                        if (req.timer) clearTimeout(req.timer);
                        req.resolve(body);
                    }
                }
            });
        });

        return this.connectingPromise;
    }

    _handleSocketError(err) {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            this.socket = null;
        }
        this.isAuthenticated = false;
        this.connectingPromise = null;
        this.responseBuffer = Buffer.alloc(0);

        if (this.activeRequest) {
            const req = this.activeRequest;
            this.activeRequest = null;
            if (req.timer) clearTimeout(req.timer);
            req.reject(err);
        }

        while (this.commandQueue.length > 0) {
            const item = this.commandQueue.shift();
            item.reject(err);
        }
        this.isProcessingQueue = false;
    }

    _handleSocketClose() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket = null;
        }
        this.isAuthenticated = false;
        this.connectingPromise = null;
        this.responseBuffer = Buffer.alloc(0);

        if (this.activeRequest) {
            const req = this.activeRequest;
            this.activeRequest = null;
            if (req.timer) clearTimeout(req.timer);
            req.reject(new Error('RCON connection closed'));
        }

        while (this.commandQueue.length > 0) {
            const item = this.commandQueue.shift();
            item.reject(new Error('RCON connection closed'));
        }
        this.isProcessingQueue = false;
    }

    /**
     * Executes a command over the persistent RCON connection.
     * Queues commands sequentially to prevent packet interleaved collisions.
     */
    executeCommand(command, config = null) {
        return new Promise((resolve, reject) => {
            this.commandQueue.push({
                command,
                config,
                resolve,
                reject
            });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.isProcessingQueue || this.commandQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;

        while (this.commandQueue.length > 0) {
            const item = this.commandQueue[0];

            try {
                await this.connect(item.config);
            } catch (connErr) {
                this.commandQueue.shift();
                item.reject(connErr);
                continue;
            }

            if (!this.socket || !this.isAuthenticated) {
                this.commandQueue.shift();
                item.reject(new Error('RCON not connected or authenticated'));
                continue;
            }

            if (this.reqIdCounter > 0x7FFFFFFF - 10) {
                this.reqIdCounter = 2;
            }
            const cmdId = ++this.reqIdCounter;

            const commandPromise = new Promise((res, rej) => {
                const timer = setTimeout(() => {
                    if (this.activeRequest && this.activeRequest.cmdId === cmdId) {
                        this.activeRequest = null;
                        if (this.socket) {
                            this.socket.removeAllListeners();
                            this.socket.destroy();
                            this.socket = null;
                        }
                        this.isAuthenticated = false;
                        rej(new Error('RCON command timed out'));
                    }
                }, 4000);

                this.activeRequest = {
                    cmdId,
                    timer,
                    resolve: res,
                    reject: rej
                };

                const packet = this._buildPacket(cmdId, SERVERDATA_EXECCOMMAND, item.command);
                this.socket.write(packet, (writeErr) => {
                    if (writeErr) {
                        clearTimeout(timer);
                        this.activeRequest = null;
                        rej(writeErr);
                    }
                });
            });

            this.commandQueue.shift();

            try {
                let output = await commandPromise;

                const disableColors = item.config?.rconDisableColors ?? this.currentConfig?.rconDisableColors;
                const rawOutput = item.config?.rconRawOutput ?? this.currentConfig?.rconRawOutput;

                if (!rawOutput && disableColors) {
                    // mcrcon -c: Strip Minecraft § color codes and ANSI escape codes
                    output = output.replace(/§[0-9a-fk-or]/gi, '').replace(/\x1b\[[0-9;]*m/g, '');
                }

                item.resolve(output);
            } catch (cmdErr) {
                item.reject(cmdErr);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Gracefully disconnects the persistent RCON socket.
     */
    disconnect() {
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.destroy();
            } catch (e) {}
            this.socket = null;
        }
        this.isAuthenticated = false;
        this.connectingPromise = null;
        this.responseBuffer = Buffer.alloc(0);

        if (this.activeRequest) {
            const req = this.activeRequest;
            this.activeRequest = null;
            if (req.timer) clearTimeout(req.timer);
            req.reject(new Error('RCON disconnected'));
        }

        while (this.commandQueue.length > 0) {
            const item = this.commandQueue.shift();
            item.reject(new Error('RCON disconnected'));
        }
        this.isProcessingQueue = false;
    }

    /**
     * Queries online player count and player usernames.
     * Uses vanilla '/minecraft:list' first to bypass Essentials command logging and op broadcast,
     * falling back to '/list' if '/minecraft:list' is unsupported.
     */
    async getOnlinePlayers(config = null) {
        try {
            let raw = '';
            // 1. Try vanilla command '/minecraft:list' first to bypass Essentials command logging and op broadcast
            try {
                raw = await this.executeCommand('minecraft:list', config);
            } catch (err) {
                raw = '';
            }

            // If minecraft:list returned unknown command or was empty, fallback to standard 'list'
            if (!raw || /unknown (?:or incomplete )?command/i.test(raw)) {
                raw = await this.executeCommand('list', config);
            }

            const parsed = this._parsePlayerList(raw);
            this.cachedPlayers = {
                ...parsed,
                lastUpdated: new Date()
            };
            return this.cachedPlayers;
        } catch (err) {
            // Server offline, booting, or RCON unavailable
            return {
                count: -1, // -1 denotes error/unknown, preventing false 0-player idle triggers
                max: 0,
                players: [],
                error: err.message,
                lastUpdated: new Date()
            };
        }
    }

    /**
     * Parses player list command output across Vanilla, Paper, Spigot, Folia, Fabric, Forge, NeoForge, and Essentials.
     * Supports:
     * "There are 0 of a max of 20 players online:"
     * "There are 2 of a max of 20 players online: Alex, Steve"
     * "Connected players (1/20):\nDefault: Alex"
     * "Connected players (2/20):\n[Owner] Alex, [Admin] Steve"
     * "There are 1 out of 20 players online.\nAdmins: Alex"
     */
    _parsePlayerList(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return { count: 0, max: 0, players: [], raw: '' };
        }

        const clean = rawText.replace(/§[0-9a-fk-or]/gi, '').replace(/\x1b\[[0-9;]*m/g, '').trim();

        let count = 0;
        let max = 20;

        // Standard: "There are X of a max of Y players online" or "There are X out of Y players online"
        const stdMatch = clean.match(/There are (\d+)(?:\s*(?:of a max|out of|of)\s*(?:a max of\s*)?(\d+))?\s*players?\s*online/i);
        if (stdMatch) {
            count = parseInt(stdMatch[1], 10) || 0;
            if (stdMatch[2]) max = parseInt(stdMatch[2], 10) || 20;
        } else {
            // Slash format: "Connected players (X/Y):" or "Online: X/Y"
            const slashMatch = clean.match(/(\d+)\s*\/\s*(\d+)/i);
            if (slashMatch) {
                count = parseInt(slashMatch[1], 10) || 0;
                max = parseInt(slashMatch[2], 10) || 20;
            } else {
                const countMatch = clean.match(/(\d+)\s*(?:players?\s*online|online|connected)/i);
                if (countMatch) count = parseInt(countMatch[1], 10) || 0;
            }
        }

        const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const playerNames = new Set();
        const excludeWords = new Set(['there', 'are', 'players', 'online', 'max', 'connected', 'out', 'of', 'nobody', 'none']);

        for (const line of lines) {
            let contentToParse = line;
            if (/^(?:there are|connected players|online players)/i.test(line)) {
                const colonIdx = line.indexOf(':');
                if (colonIdx !== -1) {
                    contentToParse = line.slice(colonIdx + 1).trim();
                } else {
                    continue;
                }
            } else if (line.includes(':')) {
                const colonIdx = line.indexOf(':');
                contentToParse = line.slice(colonIdx + 1).trim();
            }

            if (!contentToParse) continue;

            const tokens = contentToParse.split(',').map(t => t.trim());
            for (let tok of tokens) {
                // Strip bracket prefixes like [Admin], [Owner], etc.
                tok = tok.replace(/\[.*?\]\s*/g, '').trim();
                // Strip status symbols like *, +, ~, - (e.g. Essentials AFK or Op prefixes)
                tok = tok.replace(/^[\*\+\~\-\s]+/, '').trim();
                // Strip trailing parentheses like (AFK)
                tok = tok.replace(/\s*\(.*?\)$/, '').trim();

                if (tok && /^[a-zA-Z0-9_]{2,16}$/.test(tok) && !excludeWords.has(tok.toLowerCase())) {
                    playerNames.add(tok);
                }
            }
        }

        const players = Array.from(playerNames);
        count = Math.max(count, players.length);
        return { count, max, players, raw: clean };
    }
}

const rconService = new RconService();
module.exports = rconService;
