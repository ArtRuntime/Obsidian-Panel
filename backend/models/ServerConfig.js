const mongoose = require('mongoose');

const ServerConfigSchema = new mongoose.Schema({
    name: { type: String, default: 'main-server' },
    ram: { type: String, default: '4GB' },
    port: { type: Number, default: 25565 },
    version: { type: String, default: '1.20.4' },
    type: { type: String, default: 'vanilla' },
    gofileToken: { type: String, default: '' },
    buzzheavierToken: { type: String, default: '' },
    buzzheavierDomain: { type: String, default: 'bzzhr.co' },
    backupProvider: { type: String, enum: ['buzzheavier', 'gofile'], default: 'buzzheavier' },
    javaVersion: { type: Number, default: 21 },
    javaArgs: { type: String, default: '' },
    // Sleep Mode (Join to Start / Auto-sleep)
    sleepModeEnabled: { type: Boolean, default: false },
    sleepTimeoutMinutes: { type: Number, default: 5 },
    sleepingMotd: { type: String, default: '§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦' },
    startingMotd: { type: String, default: '§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!' },
    wakeKickMessage: { type: String, default: '§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.' },
    // RCON Settings (mcrcon)
    rconPort: { type: Number, default: 0 },
    rconPassword: { type: String, default: '' },
    rconSilent: { type: Boolean, default: true },
    rconDisableColors: { type: Boolean, default: false },
    rconRawOutput: { type: Boolean, default: false }
}, { collection: 'server_config' });

module.exports = mongoose.model('ServerConfig', ServerConfigSchema);
