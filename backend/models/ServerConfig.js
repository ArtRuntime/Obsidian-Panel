const mongoose = require('mongoose');
const ServerConfigSchema = new mongoose.Schema({
    name: { type: String, default: 'main-server' },
    ram: { type: String, default: '4GB' },
    port: { type: Number, default: 25565 },
    version: { type: String, default: '1.20.4' },
    type: { type: String, enum: ['vanilla', 'paper', 'purpur', 'spigot', 'fabric'], default: 'vanilla' },
    gofileToken: { type: String, default: '' },
    buzzheavierToken: { type: String, default: '' },
    buzzheavierDomain: { type: String, default: 'bzzhr.co' },
    backupProvider: { type: String, enum: ['buzzheavier', 'gofile'], default: 'buzzheavier' },
    javaVersion: { type: Number, default: 21 }
}, { collection: 'server_config' });
module.exports = mongoose.model('ServerConfig', ServerConfigSchema);
