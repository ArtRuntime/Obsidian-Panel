import React, { useState, useEffect } from 'react';
import { Clock, Plus, Play, Trash2, Edit2, CheckCircle, AlertCircle, RefreshCw, Terminal, RotateCcw, Power, HardDrive } from 'lucide-react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Select from '../components/Select';
import clsx from 'clsx';

const taskTypeOptions = [
    { value: 'command', label: 'Console Command' },
    { value: 'restart', label: 'Auto-Restart Server' },
    { value: 'start', label: 'Auto-Start Server' },
    { value: 'stop', label: 'Auto-Stop Server' },
];

const cronPresets = [
    { label: 'Every 30 Minutes', cron: '*/30 * * * *' },
    { label: 'Every Hour', cron: '0 * * * *' },
    { label: 'Every 6 Hours', cron: '0 */6 * * *' },
    { label: 'Every Night at 4:00 AM', cron: '0 4 * * *' },
    { label: 'Every Sunday at 3:00 AM', cron: '0 3 * * 0' },
];

export default function Schedules() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [runningId, setRunningId] = useState(null);

    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState('command');
    const [payload, setPayload] = useState('');
    const [cron, setCron] = useState('0 4 * * *');
    const [enabled, setEnabled] = useState(true);

    const { addToast } = useToast();

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await serverApi.getSchedules();
            setTasks(data);
        } catch (err) {
            addToast(err.message || 'Failed to load scheduled tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleOpenModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setName(task.name);
            setType(task.type);
            setPayload(task.payload || '');
            setCron(task.cron);
            setEnabled(task.enabled);
        } else {
            setEditingTask(null);
            setName('');
            setType('command');
            setPayload('say Server restarting in 5 minutes...');
            setCron('0 4 * * *');
            setEnabled(true);
        }
        setIsModalOpen(true);
    };

    const handleSaveTask = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) {
                await serverApi.updateSchedule(editingTask._id, { name, type, payload, cron, enabled });
                addToast('Scheduled task updated successfully', 'success');
            } else {
                await serverApi.createSchedule({ name, type, payload, cron, enabled });
                addToast('Scheduled task created successfully', 'success');
            }
            setIsModalOpen(false);
            fetchTasks();
        } catch (err) {
            addToast(err.message || 'Failed to save task', 'error');
        }
    };

    const handleDeleteTask = async (id) => {
        if (!confirm('Are you sure you want to delete this scheduled task?')) return;
        try {
            await serverApi.deleteSchedule(id);
            addToast('Task deleted successfully', 'success');
            fetchTasks();
        } catch (err) {
            addToast(err.message || 'Failed to delete task', 'error');
        }
    };

    const handleRunNow = async (id) => {
        try {
            setRunningId(id);
            await serverApi.runScheduleNow(id);
            addToast('Task triggered successfully', 'success');
            fetchTasks();
        } catch (err) {
            addToast(err.message || 'Failed to trigger task', 'error');
        } finally {
            setRunningId(null);
        }
    };

    const handleToggleEnabled = async (task) => {
        try {
            await serverApi.updateSchedule(task._id, { ...task, enabled: !task.enabled });
            fetchTasks();
        } catch (err) {
            addToast(err.message || 'Failed to update status', 'error');
        }
    };

    const getTypeIcon = (taskType) => {
        switch (taskType) {
            case 'command': return <Terminal size={18} className="text-purple-400" />;
            case 'restart': return <RotateCcw size={18} className="text-yellow-400" />;
            case 'start': return <Power size={18} className="text-green-400" />;
            case 'stop': return <Power size={18} className="text-red-400" />;
            default: return <Clock size={18} className="text-obsidian-accent" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="text-obsidian-accent" /> Scheduled Tasks
                    </h1>
                    <p className="text-obsidian-muted text-sm mt-1">
                        Automate server restarts, backups, and console commands using cron schedules.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="glass-button px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-obsidian-accent/30"
                >
                    <Plus size={18} /> Create Task
                </button>
            </div>

            {/* Task List */}
            {loading ? (
                <div className="glass-card p-12 rounded-2xl text-center text-obsidian-muted">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-obsidian-accent" size={24} />
                    Loading scheduled tasks...
                </div>
            ) : tasks.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl text-center text-obsidian-muted">
                    <Clock size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium text-white">No scheduled tasks yet</p>
                    <p className="text-sm mt-1">Create automated tasks to run server commands or backups on a schedule.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                        <div key={task._id} className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                        {getTypeIcon(task.type)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base">{task.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-obsidian-muted">
                                                {task.cron}
                                            </span>
                                            <span className="text-xs text-obsidian-muted capitalize">
                                                {task.type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleEnabled(task)}
                                    className={clsx(
                                        "px-2.5 py-1 text-xs font-mono rounded-lg transition-all border",
                                        task.enabled
                                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                                            : "bg-white/5 text-obsidian-muted border-white/10"
                                    )}
                                >
                                    {task.enabled ? 'Active' : 'Disabled'}
                                </button>
                            </div>

                            {task.payload && (
                                <div className="px-3 py-2 bg-black/40 rounded-lg border border-white/5 font-mono text-xs text-purple-300 truncate">
                                    {task.payload}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-obsidian-muted">
                                <div>
                                    Last run: {task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleRunNow(task._id)}
                                        disabled={runningId === task._id}
                                        className="p-2 hover:bg-white/10 rounded-lg text-green-400 transition-colors"
                                        title="Run Now"
                                    >
                                        {runningId === task._id ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(task)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-obsidian-muted hover:text-white transition-colors"
                                        title="Edit Task"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task._id)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                        title="Delete Task"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTask ? 'Edit Scheduled Task' : 'Create Scheduled Task'}
            >
                <form onSubmit={handleSaveTask} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider block mb-1.5 ml-1">
                            Task Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full glass-input px-4 py-2.5"
                            placeholder="e.g., Nightly Server Restart"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider block mb-1.5 ml-1">
                            Action Type
                        </label>
                        <Select
                            options={taskTypeOptions}
                            value={type}
                            onChange={(val) => setType(val)}
                            className="w-full"
                        />
                    </div>

                    {type === 'command' && (
                        <div>
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider block mb-1.5 ml-1">
                                Command Payload
                            </label>
                            <input
                                type="text"
                                required
                                value={payload}
                                onChange={(e) => setPayload(e.target.value)}
                                className="w-full glass-input px-4 py-2.5 font-mono text-sm"
                                placeholder="say Server restarting in 5 minutes..."
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider block mb-1.5 ml-1">
                            Cron Schedule
                        </label>
                        <input
                            type="text"
                            required
                            value={cron}
                            onChange={(e) => setCron(e.target.value)}
                            className="w-full glass-input px-4 py-2.5 font-mono text-sm"
                            placeholder="0 4 * * *"
                        />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {cronPresets.map((preset) => (
                                <button
                                    key={preset.cron}
                                    type="button"
                                    onClick={() => setCron(preset.cron)}
                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs font-mono rounded border border-white/10 text-obsidian-muted hover:text-white transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="glass-button-secondary px-4 py-2 rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="glass-button px-5 py-2 rounded-xl text-sm font-medium"
                        >
                            {editingTask ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
