const mongoose = require('mongoose');

const ScheduledTaskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['command', 'restart', 'start', 'stop'], required: true },
    payload: { type: String, default: '' }, // e.g., "say Server restarting in 5 minutes"
    cron: { type: String, required: true }, // e.g., "0 4 * * *"
    enabled: { type: Boolean, default: true },
    lastRun: { type: Date, default: null },
    nextRun: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledTask', ScheduledTaskSchema);
