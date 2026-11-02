const net = require('net');
const EventEmitter = require('events');
const ServerConfig = require('../models/ServerConfig');
const rconService = require('./rconService');

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

            // If sleep mode is enabled, automatically enter sleep mode listener
            if (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
                console.log('[SleepMode] Server stopped. Activating sleep mode listener...');
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
            } else if (newStatus === 'offline') {
                this.stopIdleMonitor();
                if (this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
                    this.startSleepListener();
                }
            }
        });

        // If server is currently offline and sleep mode is enabled, start listening
        if (this.minecraftService.status === 'offline' && this.minecraftService.config && this.minecraftService.config.sleepModeEnabled) {
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

        if (this.minecraftService && this.minecraftService.status !== 'offline') {
            console.log('[SleepMode] Cannot start sleep listener: server is not offline (current status:', this.minecraftService.status, ')');
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
                            socket.destroy();
                            return;
                        }
                    } else if (state === 'status') {
                        if (packetId === 0x00) {
                            // Status Request -> send Status Response
                            const isStarting = this.isStartingWake || (this.minecraftService && this.minecraftService.status === 'starting');
                            const cfg = (this.minecraftService && this.minecraftService.config) || {};
                            const motd = isStarting
                                ? (cfg.startingMotd || '§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!')
                                : (cfg.sleepingMotd || '§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦');

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

                        const cfg = (this.minecraftService && this.minecraftService.config) || {};
                        const kickMsg = cfg.wakeKickMessage || '§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.';

                        // Send Login Disconnect packet (0x00 in login state)
                        const disconnectJson = JSON.stringify({ text: kickMsg });
                        const disconnectPkt = createPacket(0x00, writeString(disconnectJson));
                        socket.write(disconnectPkt, () => {
                            socket.end();
                        });

                        // Wake up the server
                        this.wakeUpServer(username);
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
            console.log(`[SleepMode] Listener active on 0.0.0.0:${this.port}. Server is in Sleep Mode.`);
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
            for (const socket of this.activeSockets) {
                try {
                    socket.destroy();
                } catch (e) { }
            }
            this.activeSockets.clear();

            this.tcpServer.close(() => {
                this.tcpServer = null;
                this.isSleeping = false;
                console.log(`[SleepMode] Stopped sleep listener on port ${this.port}`);
                this.broadcastStatus();
                resolve();
            });

            // Fallback timeout in case sockets hang
            setTimeout(() => {
                if (this.tcpServer) {
                    try {
                        this.tcpServer.unref();
                    } catch (e) { }
                    this.tcpServer = null;
                    this.isSleeping = false;
                    resolve();
                }
            }, 500);
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

        // Close sleep listener so Minecraft process can bind port
        await this.stopSleepListener();

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

                // Broadcast player update through socket.io
                if (this.minecraftService.io) {
                    this.minecraftService.io.emit('players_update', playerData);
                }

                if (playerData.count === 0) {
                    if (!this.idleSince) {
                        this.idleSince = Date.now();
                        console.log('[SleepMode] 0 players detected. Starting idle countdown...');
                    }

                    const elapsedMs = Date.now() - this.idleSince;
                    const timeoutMinutes = cfg.sleepTimeoutMinutes || 5;
                    const timeoutMs = timeoutMinutes * 60 * 1000;

                    if (elapsedMs >= timeoutMs) {
                        console.log(`[SleepMode] Server idle with 0 players for ${timeoutMinutes} minutes. Putting server to sleep...`);
                        this.minecraftService.pushLog(`[SleepMode] 💤 Server idle with 0 players for ${timeoutMinutes} minute(s). Entering Sleep Mode...`);
                        this.idleSince = null;
                        this.minecraftService.stop();
                    }
                } else {
                    if (this.idleSince) {
                        console.log(`[SleepMode] Active players (${playerData.count}) detected. Resetting idle timer.`);
                    }
                    this.idleSince = null;
                }
            } catch (err) {
                // RCON poll error
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

