const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RCON_PID = 0xBADC0DE;
const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

class RconService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.currentConfig = {
            port: 0,
            password: '',
            enabled: false
        };
        this.cachedPlayers = {
            count: 0,
            max: 0,
            players: [],
            lastUpdated: null
        };
        this.reqIdCounter = 1;
        this.pendingRequests = new Map();
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

            // 2. Silent mode: do not broadcast RCON commands to console/operators
            if (properties['broadcast-rcon-to-ops'] !== 'false') {
                properties['broadcast-rcon-to-ops'] = 'false';
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
                console.log(`[RconService] Configured server.properties: RCON port=${rconPort}, silent=true`);
            }

            this.currentConfig = {
                port: rconPort,
                password: rconPassword,
                enabled: true
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
     * Executes a single command over RCON and returns the response string.
     */
    async executeCommand(command, config = null) {
        const port = (config && config.port) || this.currentConfig.port;
        const password = (config && config.password) || this.currentConfig.password;

        if (!port || !password) {
            throw new Error('RCON is not configured or port/password missing');
        }

        return new Promise((resolve, reject) => {
            let socket = null;
            let timeout = null;
            let responseBuffer = Buffer.alloc(0);
            let authenticated = false;
            let authId = 1;
            let cmdId = 2;

            const cleanup = (err) => {
                if (timeout) clearTimeout(timeout);
                if (socket) {
                    socket.removeAllListeners();
                    socket.destroy();
                }
                if (err) reject(err);
            };

            timeout = setTimeout(() => {
                cleanup(new Error('RCON connection/command timed out'));
            }, 4000);

            socket = net.connect({ host: '127.0.0.1', port }, () => {
                // 1. Authenticate
                const authPacket = this._buildPacket(authId, SERVERDATA_AUTH, password);
                socket.write(authPacket);
            });

            socket.on('error', (err) => {
                cleanup(err);
            });

            socket.on('data', (chunk) => {
                responseBuffer = Buffer.concat([responseBuffer, chunk]);

                // Parse incoming packet(s)
                while (responseBuffer.length >= 14) {
                    const packetSize = responseBuffer.readInt32LE(0);
                    const totalSize = 4 + packetSize;

                    if (responseBuffer.length < totalSize) {
                        break; // Wait for full packet
                    }

                    const packetId = responseBuffer.readInt32LE(4);
                    const packetType = responseBuffer.readInt32LE(8);
                    const body = responseBuffer.toString('utf8', 12, totalSize - 2);
                    responseBuffer = responseBuffer.slice(totalSize);

                    if (!authenticated) {
                        if (packetId === -1) {
                            cleanup(new Error('RCON authentication failed (invalid password)'));
                            return;
                        }
                        if (packetType === SERVERDATA_AUTH_RESPONSE && packetId === authId) {
                            authenticated = true;
                            // 2. Send Command
                            const cmdPacket = this._buildPacket(cmdId, SERVERDATA_EXECCOMMAND, command);
                            socket.write(cmdPacket);
                        }
                    } else {
                        if (packetType === SERVERDATA_RESPONSE_VALUE && packetId === cmdId) {
                            cleanup(null);
                            resolve(body);
                            return;
                        }
                    }
                }
            });
        });
    }

    /**
     * Queries online player count and player usernames via the RCON 'list' command.
     */
    async getOnlinePlayers(config = null) {
        try {
            const raw = await this.executeCommand('list', config);
            const parsed = this._parsePlayerList(raw);
            this.cachedPlayers = {
                ...parsed,
                lastUpdated: new Date()
            };
            return this.cachedPlayers;
        } catch (err) {
            // Server offline, booting, or RCON unavailable
            return {
                count: 0,
                max: 0,
                players: [],
                error: err.message,
                lastUpdated: new Date()
            };
        }
    }

    /**
     * Parses the vanilla/Paper/Spigot/Fabric 'list' command output:
     * Examples:
     * "There are 0 of a max of 20 players online:"
     * "There are 2 of a max of 20 players online: Alex, Steve"
     * "Connected players: Alex, Steve"
     */
    _parsePlayerList(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return { count: 0, max: 0, players: [], raw: '' };
        }

        const clean = rawText.replace(/§[0-9a-fk-or]/gi, '').trim();

        // Standard Minecraft: "There are X of a max of Y players online: name1, name2"
        const standardMatch = clean.match(/There are (\d+)(?:\s*of\s*a\s*max\s*of\s*(\d+))?\s*players?\s*online(?::\s*(.*))?/i);
        if (standardMatch) {
            const count = parseInt(standardMatch[1], 10) || 0;
            const max = parseInt(standardMatch[2], 10) || 20;
            const namesStr = standardMatch[3] ? standardMatch[3].trim() : '';
            const players = namesStr ? namesStr.split(',').map(n => n.trim()).filter(Boolean) : [];
            return { count, max, players, raw: clean };
        }

        // Alternative: "X/Y players: name1, name2"
        const slashMatch = clean.match(/(\d+)\s*\/\s*(\d+)\s*players?(?::\s*(.*))?/i);
        if (slashMatch) {
            const count = parseInt(slashMatch[1], 10) || 0;
            const max = parseInt(slashMatch[2], 10) || 20;
            const namesStr = slashMatch[3] ? slashMatch[3].trim() : '';
            const players = namesStr ? namesStr.split(',').map(n => n.trim()).filter(Boolean) : [];
            return { count, max, players, raw: clean };
        }

        return { count: 0, max: 20, players: [], raw: clean };
    }
}

const rconService = new RconService();
module.exports = rconService;

