const express = require('express');
const router = express.Router();
const ScheduledTask = require('../models/ScheduledTask');
const schedulerService = require('../services/schedulerService');
const { auth, checkPermission } = require('../middleware');

// GET /api/schedules - List all scheduled tasks
router.get('/', auth, checkPermission('settings.view'), async (req, res) => {
    try {
        const tasks = await ScheduledTask.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/schedules - Create a scheduled task
router.post('/', auth, checkPermission('settings.edit'), async (req, res) => {
    try {
        const { name, type, payload, cron, enabled = true } = req.body;
        if (!name || !type || !cron) {
            return res.status(400).json({ message: 'Name, type, and cron schedule are required.' });
        }

        const task = await ScheduledTask.create({
            name,
            type,
            payload,
            cron,
            enabled
        });

        schedulerService.scheduleTask(task);
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/schedules/:id - Update a task
router.put('/:id', auth, checkPermission('settings.edit'), async (req, res) => {
    try {
        const { name, type, payload, cron, enabled } = req.body;
        const task = await ScheduledTask.findByIdAndUpdate(
            req.params.id,
            { name, type, payload, cron, enabled },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: 'Scheduled task not found' });
        }

        schedulerService.scheduleTask(task);
        res.json(task);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/schedules/:id - Delete a task
router.delete('/:id', auth, checkPermission('settings.edit'), async (req, res) => {
    try {
        const task = await ScheduledTask.findByIdAndDelete(req.params.id);
        if (task) {
            schedulerService.unscheduleTask(req.params.id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/schedules/:id/run - Execute task immediately
router.post('/:id/run', auth, checkPermission('settings.edit'), async (req, res) => {
    try {
        const task = await ScheduledTask.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        await schedulerService.executeTask(task);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
