const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    downloadPage: {
        type: String,
        required: true
    },
    provider: {
        type: String,
        default: 'buzzheavier'
    },
    fileId: {
        type: String,
        default: ''
    },
    guestToken: {
        type: String
    },
    size: {
        type: String
    },
    encryptionPassword: {
        type: String,
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Backup', BackupSchema);
