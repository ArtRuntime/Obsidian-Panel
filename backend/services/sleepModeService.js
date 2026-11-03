const net = require('net');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const ServerConfig = require('../models/ServerConfig');
const rconService = require('./rconService');

function getServerFavicon(serverDir) {
    if (!serverDir) return null;
    const iconPath = path.join(serverDir, 'server-icon.png');
    if (fs.existsSync(iconPath)) {
        try {
            const buf = fs.readFileSync(iconPath);
            return 'data:image/png;base64,' + buf.toString('base64');
        } catch (e) {
            return null;
        }
    }
    return null;
}

function legacyToComponent(str) {
    if (!str) return { text: '' };
    const normalized = String(str).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
    const colorNames = {
        '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua',
        '4': 'dark_red', '5': 'dark_purple', '6': 'gold', '7': 'gray',
        '8': 'dark_gray', '9': 'blue', 'a': 'green', 'b': 'aqua',
        'c': 'red', 'd': 'light_purple', 'e': 'yellow', 'f': 'white'
    };

    const extra = [];
    let curColor = undefined;
    let bold = false;
    let italic = false;
    let underlined = false;
    let strikethrough = false;
    let obfuscated = false;
    let buffer = '';

    function flush() {
        if (buffer.length > 0) {
            const part = { text: buffer };
            if (curColor) part.color = curColor;
            if (bold) part.bold = true;
            if (italic) part.italic = true;
            if (underlined) part.underlined = true;
            if (strikethrough) part.strikethrough = true;
            if (obfuscated) part.obfuscated = true;
            extra.push(part);
            buffer = '';
        }
    }

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if ((ch === '§' || ch === '&') && i + 1 < normalized.length) {
            const code = normalized[i + 1].toLowerCase();
            if (colorNames[code]) {
                flush();
                curColor = colorNames[code];
                bold = false;
                italic = false;
                underlined = false;
                strikethrough = false;
                obfuscated = false;
                i++;
                continue;
            } else if (code === 'l') {
                flush();
                bold = true;
                i++;
                continue;
            } else if (code === 'o') {
                flush();
                italic = true;
                i++;
                continue;
            } else if (code === 'n') {
                flush();
                underlined = true;
                i++;
                continue;
            } else if (code === 'm') {
                flush();
                strikethrough = true;
                i++;
                continue;
            } else if (code === 'k') {
                flush();
                obfuscated = true;
                i++;
                continue;
            } else if (code === 'r') {
                flush();
                curColor = undefined;
                bold = false;
                italic = false;
                underlined = false;
                strikethrough = false;
                obfuscated = false;
                i++;
                continue;
            }
        }
        buffer += ch;
    }
    flush();

    if (extra.length === 0) return { text: '' };
    return { text: '', extra };
}

function writeVarInt(value) {
    const bytes = [];
    let v = value >>> 0;
    while (true) {
        if ((v & ~0x7F) === 0) {
            bytes.push(v);
            break;
        } else {
            bytes.push((v & 0x7F) | 0x80);
            v >>>= 7;
        }
    }
    return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
    let result = 0;
    let shift = 0;
    let cursor = offset;
    while (true) {
        if (cursor >= buffer.length) return null;
        const byte = buffer[cursor++];
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
        if (shift >= 35) throw new Error('VarInt too big');
    }
    return { value: result, bytesRead: cursor - offset };
}

function writeString(str) {
    const strBuf = Buffer.from(str, 'utf8');
    return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

function readString(buffer, offset = 0) {
    const lenRes = readVarInt(buffer, offset);
    if (!lenRes) return null;
    const strLen = lenRes.value;
    const strStart = offset + lenRes.bytesRead;
    const strEnd = strStart + strLen;
    if (buffer.length < strEnd) return null;
    return {
        value: buffer.toString('utf8', strStart, strEnd),
        bytesRead: lenRes.bytesRead + strLen
    };
}

function createPacket(packetId, payload = Buffer.alloc(0)) {
    const idBuf = writeVarInt(packetId);
    const body = Buffer.concat([idBuf, payload]);
    const lenBuf = writeVarInt(body.length);
    return Buffer.concat([lenBuf, body]);
}

class SleepModeService extends EventEmitter {
    constructor() {
        super();
        this.minecraftService = null;
        this.tcpServer = null;
        this.isSleeping = false;
        this.isStartingWake = false;
        this.idleSince = null;
        this.idleInterval = null;
        this.activeSockets = new Set();
        this.port = 25565;
    }

    /**
     * Initializes the service with minecraftService reference
     */
    init(minecraftService) {
        this.minecraftService = minecraftService;

        // Auto-configure RCON at panel startup
        try {
            rconService.ensureRconConfigured(this.minecraftService.serverDir, this.minecraftService.config);
        } catch (e) {
            console.error('[SleepMode] Error ensuring RCON configuration at startup:', e.message);
        }

        // Listen for Minecraft status changes
        this.minecraftService.on('stopped', () => {
            this.idleSince = null;
            this.isStartingWake = false;
            this.stopIdleMonitor();

            // If server was commanded to sleep or sleep mode is enabled, enter sleep mode listener
            const shouldSleep = Boolean(
                this.minecraftService.pendingSleep ||
                (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled)
            );
            this.minecraftService.pendingSleep = false;

            if (shouldSleep) {
                console.log('[SleepMode] Server stopped. Activating sleep mode listener...');
                this.minecraftService.pushLog('[SleepMode] 💤 Server stopped. Sleep mode listener is now active.');
                this.startSleepListener();
            }
        });

        // Start idle monitoring once Minecraft server is online
        this.minecraftService.on('status_change', (newStatus) => {
            if (newStatus === 'online') {
                this.isStartingWake = false;
                this.stopSleepListener();
                if (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
                    this.startIdleMonitor();
                }
            } else if (newStatus === 'starting') {
                if (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
                    if (!this.tcpServer) {
                        this.startSleepListener();
                    }
                }
            } else if (newStatus === 'offline') {
                this.stopIdleMonitor();
                if (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
                    this.startSleepListener();
                }
            }
        });

        // If server is currently offline or starting and sleep mode is enabled, start listening
        if ((this.minecraftService.status === 'offline' || this.minecraftService.status === 'starting') &&
            this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
            this.startSleepListener();
        }
    }

    /**
     * Starts listening on the Minecraft server port to emulate a sleeping server.
     */
    startSleepListener() {
        if (this.tcpServer) {
            return;
        }

        if (this.minecraftService && this.minecraftService.status !== 'offline' && this.minecraftService.status !== 'starting') {
            console.log('[SleepMode] Cannot start sleep listener: server is neither offline nor starting (current status:', this.minecraftService.status, ')');
            return;
        }

        const portStr = this.minecraftService ? this.minecraftService.getServerPort() : '25565';
        this.port = parseInt(portStr, 10) || 25565;

        this.tcpServer = net.createServer((socket) => {
            this.activeSockets.add(socket);

            let buffer = Buffer.alloc(0);
            let state = 'handshake'; // 'handshake' | 'status' | 'login'
            let clientProtocol = 765; // Default 1.20.4 protocol version

            socket.on('data', async (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);

                while (buffer.length > 0) {
                    const pktLenRes = readVarInt(buffer, 0);
                    if (!pktLenRes) break; // Incomplete length header

                    const packetLength = pktLenRes.value;
                    const totalLength = pktLenRes.bytesRead + packetLength;
                    if (buffer.length < totalLength) break; // Incomplete packet body

                    const packetBuf = buffer.slice(pktLenRes.bytesRead, totalLength);
                    buffer = buffer.slice(totalLength);

                    // Decode packet ID
                    const pktIdRes = readVarInt(packetBuf, 0);
                    if (!pktIdRes) continue;
                    const packetId = pktIdRes.value;
                    const payload = packetBuf.slice(pktIdRes.bytesRead);

                    // Handle based on client connection state
                    if (state === 'handshake' && packetId === 0x00) {
                        try {
                            let cursor = 0;
                            const protoRes = readVarInt(payload, cursor);
                            if (protoRes) {
                                clientProtocol = protoRes.value;
                                cursor += protoRes.bytesRead;
                            }
                            const hostRes = readString(payload, cursor);
                            if (hostRes) cursor += hostRes.bytesRead;
                            cursor += 2; // Port (uint16)
                            const nextStateRes = readVarInt(payload, cursor);
                            const nextState = nextStateRes ? nextStateRes.value : 1;

                            if (nextState === 1) {
                                state = 'status';
                            } else if (nextState === 2) {
                                state = 'login';
                            }
                        } catch (err) {
                            console.error('[SleepMode] Handshake parse error:', err.message);
                            this.activeSockets.delete(socket);
                            socket.destroy();
                            return;
                        }
                    } else if (state === 'status') {
                        if (packetId === 0x00) {
                            // Status Request -> send Status Response
                            const isStarting = this.isStartingWake || (this.minecraftService && this.minecraftService.status === 'starting');
                            const cfg = (this.minecraftService && this.minecraftService.config) || {};
                            const rawMotd = isStarting
                                ? (cfg.startingMotd || '§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!')
                                : (cfg.sleepingMotd || '§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦');
                            const motd = String(rawMotd).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');

                            const statusObj = {
                                version: {
                                    name: isStarting ? 'Starting...' : 'Obsidian (Sleeping)',
                                    protocol: clientProtocol || 765
                                },
                                players: {
                                    max: 0,
                                    online: 0,
                                    sample: []
                                },
                                description: {
                                    text: motd
                                }
                            };

                            const favicon = getServerFavicon(this.minecraftService && this.minecraftService.serverDir);
                            if (favicon) {
                                statusObj.favicon = favicon;
                            }

                            const jsonString = JSON.stringify(statusObj);
                            const responsePkt = createPacket(0x00, writeString(jsonString));
                            socket.write(responsePkt);
                        } else if (packetId === 0x01) {
                            // Ping request -> echo Pong response
                            const pongPkt = createPacket(0x01, payload);
                            socket.write(pongPkt, () => {
                                socket.end();
                            });
                        }
                    } else if (state === 'login' && packetId === 0x00) {
                        // Login Start -> player wants to connect and wake server!
                        let username = 'Player';
                        try {
                            const nameRes = readString(payload, 0);
                            if (nameRes && nameRes.value) {
                                username = nameRes.value.trim();
                            }
                        } catch (e) { }

                        const isStarting = this.isStartingWake || (this.minecraftService && this.minecraftService.status === 'starting');
                        const cfg = (this.minecraftService && this.minecraftService.config) || {};
                        const rawKickMsg = cfg.wakeKickMessage || '§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.';
                        const kickMsg = String(rawKickMsg).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');

                        // Send Login Disconnect packet (0x00 in login state) with proper Mojang chat component
                        const kickComponent = legacyToComponent(kickMsg);
                        const disconnectJson = JSON.stringify(kickComponent);
                        const disconnectPkt = createPacket(0x00, writeString(disconnectJson));

                        // Remove from activeSockets immediately to prevent premature socket destruction
                        this.activeSockets.delete(socket);

                        socket.write(disconnectPkt, () => {
                            try {
                                socket.end();
                            } catch (e) { }
                        });

                        // Fallback safety timeout in case client keeps socket open
                        setTimeout(() => {
                            try {
                                if (!socket.destroyed) socket.destroy();
                            } catch (e) { }
                        }, 3000);

                        if (isStarting) {
                            if (this.minecraftService) {
                                this.minecraftService.pushLog(`[SleepMode] ⚡ ${username} connected while server is booting. Sent wake kick message.`);
                            }
                        } else {
                            // Wake up the server
                            this.wakeUpServer(username);
                        }
                        return;
                    }
                }
            });

            socket.on('error', () => {
                this.activeSockets.delete(socket);
            });

            socket.on('close', () => {
                this.activeSockets.delete(socket);
            });
        });

        this.tcpServer.on('error', (err) => {
            console.error(`[SleepMode] TCP Server error on port ${this.port}:`, err.message);
            this.isSleeping = false;
            this.broadcastStatus();
        });

        this.tcpServer.listen(this.port, '0.0.0.0', () => {
            const isStarting = this.isStartingWake || (this.minecraftService && this.minecraftService.status === 'starting');
            console.log(`[SleepMode] Listener active on 0.0.0.0:${this.port}. Mode: ${isStarting ? 'Booting MOTD' : 'Sleep Mode'}.`);
            this.isSleeping = true;
            this.broadcastStatus();
        });
    }

    /**
     * Gracefully stops the sleep TCP listener and frees the port.
     */
    async stopSleepListener() {
        if (!this.tcpServer) {
            this.isSleeping = false;
            return;
        }

        return new Promise((resolve) => {
            const srv = this.tcpServer;
            this.tcpServer = null;
            this.isSleeping = false;

            for (const socket of this.activeSockets) {
                try {
                    socket.end();
                } catch (e) { }
            }
            this.activeSockets.clear();

            srv.close(() => {
                console.log(`[SleepMode] Stopped sleep listener on port ${this.port}`);
                this.broadcastStatus();
                resolve();
            });

            // Fast fallback timeout in case sockets hang
            setTimeout(() => {
                try {
                    srv.unref();
                } catch (e) { }
                this.broadcastStatus();
                resolve();
            }, 300);
        });
    }

    /**
     * Called when a player joins or manual wake is triggered.
     */
    async wakeUpServer(triggerPlayer = 'A player') {
        if (this.isStartingWake) return;
        this.isStartingWake = true;

        if (this.minecraftService) {
            this.minecraftService.pushLog(`[SleepMode] ⚡ ${triggerPlayer} attempted to connect! Waking up Minecraft server...`);
        }

        // Keep sleep listener active during startup so booting MOTD & wake kick screen are served!
        // The listener will release port 25565 right before Minecraft binds.
        this.broadcastStatus();

        if (this.minecraftService && this.minecraftService.status === 'offline') {
            try {
                await this.minecraftService.start();
            } catch (err) {
                console.error('[SleepMode] Error waking up server:', err.message);
                if (this.minecraftService) {
                    this.minecraftService.pushLog(`[SleepMode] ❌ Failed to wake server: ${err.message}`);
                }
                this.isStartingWake = false;
                // If it failed to start, restore sleep listener
                this.startSleepListener();
            }
        }
    }

    /**
     * Starts the periodic idle monitoring loop when the server is online.
     */
    startIdleMonitor() {
        this.stopIdleMonitor();
        this.idleSince = null;

        // Poll every 15 seconds
        this.idleInterval = setInterval(async () => {
            if (!this.minecraftService || this.minecraftService.status !== 'online') {
                return;
            }

            const cfg = this.minecraftService.config || {};
            if (!cfg.sleepModeEnabled) {
                return;
            }

            try {
                const playerData = await rconService.getOnlinePlayers();

                // Check console-tracked player count as secondary/hybrid verification
                const consoleTrackedCount = this.minecraftService.getTrackedPlayerCount();
                const consoleTrackedNames = Array.from(this.minecraftService.onlinePlayers || []);

                // Determine effective player count:
                // 1. If console logs show players, players are definitely online!
                // 2. If RCON had an error, we cannot trust count=0, so do not trigger idle countdown!
                let effectiveCount = 0;
                let hasValidCount = false;

                if (consoleTrackedCount > 0) {
                    effectiveCount = consoleTrackedCount;
                    hasValidCount = true;
                } else if (!playerData.error && playerData.count >= 0) {
                    effectiveCount = Math.max(playerData.count, consoleTrackedCount);
                    hasValidCount = true;
                } else if (playerData.error) {
                    // RCON query failed (e.g. timeout, connection error)
                    console.warn(`[SleepMode] RCON player query failed (${playerData.error}). Pausing idle countdown to prevent premature sleep.`);
                    hasValidCount = false;
                }

                // Broadcast player update through socket.io if we have valid data
                if (this.minecraftService.io) {
                    const broadcastData = hasValidCount && effectiveCount > 0
                        ? { count: effectiveCount, max: playerData.max || 20, players: playerData.players?.length ? playerData.players : consoleTrackedNames }
                        : (playerData.error ? { count: 0, max: 20, players: [], error: playerData.error } : playerData);
                    this.minecraftService.io.emit('players_update', broadcastData);
                }

                // If we could not reliably verify player count (due to RCON glitch and no console data), DO NOT put server to sleep!
                if (!hasValidCount) {
                    if (this.idleSince) {
                        console.log('[SleepMode] Unverified player count due to RCON glitch. Resetting idle countdown for safety.');
                        this.idleSince = null;
                    }
                    return;
                }

                if (effectiveCount === 0) {
                    if (!this.idleSince) {
                        this.idleSince = Date.now();
                        console.log('[SleepMode] 0 players detected. Starting idle countdown...');
                    }

                    const elapsedMs = Date.now() - this.idleSince;
                    const timeoutMinutes = cfg.sleepTimeoutMinutes || 5;
                    const timeoutMs = timeoutMinutes * 60 * 1000;

                    if (elapsedMs >= timeoutMs) {
                        // FINAL SAFETY CHECK: double-check that no players are online before stopping!
                        const finalConsoleCheck = this.minecraftService.getTrackedPlayerCount();
                        if (finalConsoleCheck > 0) {
                            console.log(`[SleepMode] Sleep aborted: ${finalConsoleCheck} player(s) currently active in console logs.`);
                            this.idleSince = null;
                            return;
                        }

                        console.log(`[SleepMode] Server idle with 0 players for ${timeoutMinutes} minutes. Putting server to sleep...`);
                        this.minecraftService.pushLog(`[SleepMode] 💤 Server idle with 0 players for ${timeoutMinutes} minute(s). Entering Sleep Mode...`);
                        this.idleSince = null;
                        this.minecraftService.stop();
                    }
                } else {
                    if (this.idleSince) {
                        console.log(`[SleepMode] Active players (${effectiveCount}) detected. Resetting idle timer.`);
                    }
                    this.idleSince = null;
                }
            } catch (err) {
                // Safeguard against unhandled errors: do not sleep on error
                console.warn('[SleepMode] Error in idle monitor loop:', err.message);
                this.idleSince = null;
            }
        }, 15000);
    }

    /**
     * Stops the idle monitor interval.
     */
    stopIdleMonitor() {
        if (this.idleInterval) {
            clearInterval(this.idleInterval);
            this.idleInterval = null;
        }
        this.idleSince = null;
    }

    /**
     * Broadcasts status event via MinecraftService
     */
    broadcastStatus() {
        if (this.minecraftService && typeof this.minecraftService.broadcast === 'function') {
            this.minecraftService.broadcast('status', this.minecraftService.getStatus());
        }
    }
}

const sleepModeService = new SleepModeService();
module.exports = sleepModeService;

