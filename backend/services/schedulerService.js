const cron = require('node-cron');
const ScheduledTask = require('../models/ScheduledTask');
const minecraftService = require('./minecraftService');

class SchedulerService {
    constructor() {
        this.runningJobs = new Map(); // taskId -> cronJob
    }

    async init() {
        console.log('[SchedulerService] Initializing Scheduled Tasks...');
        try {
            const tasks = await ScheduledTask.find({ enabled: true });
            console.log(`[SchedulerService] Found ${tasks.length} active scheduled task(s).`);
            for (const task of tasks) {
                this.scheduleTask(task);
            }
        } catch (err) {
            console.error('[SchedulerService] Error loading scheduled tasks:', err.message);
        }
    }

    scheduleTask(task) {
        // Cancel existing job if running
        this.unscheduleTask(task._id.toString());

        if (!task.enabled || !task.cron) return;

        if (!cron.validate(task.cron)) {
            console.error(`[SchedulerService] Invalid cron expression "${task.cron}" for task "${task.name}"`);
            return;
        }

        const job = cron.schedule(task.cron, async () => {
            console.log(`[SchedulerService] Executing scheduled task "${task.name}" [Type: ${task.type}]`);
            await this.executeTask(task);
        });

        this.runningJobs.set(task._id.toString(), job);
        console.log(`[SchedulerService] Scheduled task "${task.name}" with cron "${task.cron}"`);
    }

    unscheduleTask(taskId) {
        if (this.runningJobs.has(taskId)) {
            const job = this.runningJobs.get(taskId);
            job.stop();
            this.runningJobs.delete(taskId);
        }
    }

    async executeTask(task) {
        try {
            switch (task.type) {
                case 'command':
                    if (task.payload) {
                        minecraftService.sendCommand(task.payload);
                    }
                    break;
                case 'restart':
                    console.log(`[SchedulerService] Executing scheduled restart for task "${task.name}"`);
                    await minecraftService.restart();
                    break;
                case 'start':
                    console.log(`[SchedulerService] Executing scheduled start for task "${task.name}"`);
                    minecraftService.start();
                    break;
                case 'stop':
                    console.log(`[SchedulerService] Executing scheduled stop for task "${task.name}"`);
                    minecraftService.stop();
                    break;
                default:
                    console.warn(`[SchedulerService] Unknown task type: ${task.type}`);
            }

            // Update lastRun in database
            await ScheduledTask.findByIdAndUpdate(task._id, { lastRun: new Date() });
        } catch (err) {
            console.error(`[SchedulerService] Error running task "${task.name}":`, err.message);
        }
    }
}

module.exports = new SchedulerService();
