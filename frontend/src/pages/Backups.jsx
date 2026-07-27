import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CloudUpload, HardDrive, Download, CheckCircle, Database, Shield, Trash2, Clock, FileArchive, AlertTriangle, Calendar, X, Lock, Copy, RotateCw, Settings, Plus, Archive, Loader2, Search, Edit2, Eye, EyeOff } from 'lucide-react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import Select from '../components/Select';

const frequencyOptions = [
    { value: 'minute', label: 'Every minute (0 * * * * *)' },
    { value: 'hourly', label: 'Every hour (0 0 * * * *)' },
    { value: 'daily', label: 'Every day at midnight (0 0 0 * * *)' },
    { value: 'weekly_sun', label: 'Every Sunday at midnight (0 0 0 * * 0)' },
    { value: 'monthly_1st', label: 'Every month on the 1st at midnight (0 0 0 1 * *)' },
    { value: 'every_15_min', label: 'Every 15 minutes (0 */15 * * * *)' },
    { value: 'every_weekday', label: 'Every weekday at midnight (0 0 0 * * 1-5)' },
    { value: 'custom', label: 'Custom' }
];

const Backups = () => {
    const { showToast } = useToast();
    const { logout } = useAuth();
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBackupInProgress, setIsBackupInProgress] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [backupConfig, setBackupConfig] = useState({
        enabled: false,
        frequency: 'daily',
        cronExpression: '0 0 0 * * *'
    });
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [backupToRestore, setBackupToRestore] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [filterDate, setFilterDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [backupNotes, setBackupNotes] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [backupData, setBackupData] = useState(null);
    const [editingBackup, setEditingBackup] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState({});

    const toggleShowPassword = (id) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // pollIntervalRef kept for potential future use
    const _pollIntervalRef = useRef(null);

    const checkStatus = useCallback(async () => {
        try {
            const status = await serverApi.getBackupStatus();
            setIsBackupInProgress(status.isBackupInProgress);
            setIsRestoring(status.isRestoreInProgress);
        } catch (e) {
            console.error(e);
            if (e.message.includes('401') || e.message.includes('Unauthorized')) {
                logout();
            }
        }
    }, [logout]);

    const loadBackups = useCallback(async () => {
        try {
            const data = await serverApi.getBackups();
            setBackups(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBackups();
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [checkStatus, loadBackups]);

    const loadConfig = async () => {
        try {
            const config = await serverApi.getBackupConfig();
            setBackupConfig(config);
            setIsConfigModalOpen(true);
        } catch {
            showToast('Failed to load settings', 'error');
        }
    };

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            let cron = backupConfig.cronExpression;
            switch (backupConfig.frequency) {
                case 'minute': cron = '0 * * * * *'; break;
                case 'hourly': cron = '0 0 * * * *'; break;
                case 'daily': cron = '0 0 0 * * *'; break;
                case 'weekly_sun': cron = '0 0 0 * * 0'; break;
                case 'monthly_1st': cron = '0 0 0 1 * *'; break;
                case 'every_15_min': cron = '0 */15 * * * *'; break;
                case 'every_weekday': cron = '0 0 0 * * 1-5'; break;
                case 'custom': break;
                default: break;
            }
            const newConfig = { ...backupConfig, cronExpression: cron };
            await serverApi.updateBackupConfig(newConfig);
            setBackupConfig(newConfig);
            showToast('Auto-Backup settings saved', 'success');
            setIsConfigModalOpen(false);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            const data = await serverApi.createBackup(backupNotes || undefined);
            setBackupData(data);
            showToast('Backup created successfully!', 'success');
            setBackups(prev => [data, ...prev]);
            loadBackups();
            setBackupNotes('');
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to create backup', 'error');
        } finally {
            setIsCreating(false);
            setIsCreateModalOpen(false);
        }
    };

    const confirmRestore = (backup) => {
        setBackupToRestore(backup);
        setIsRestoreModalOpen(true);
    };

    const handleRestore = async () => {
        if (!backupToRestore) return;
        window.onbeforeunload = () => true;
        setIsRestoring(true);
        try {
            await serverApi.restoreBackup(backupToRestore._id);
            showToast('Server restored successfully!', 'success');
            setIsRestoreModalOpen(false);
            setBackupToRestore(null);
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to restore backup', 'error');
        } finally {
            setIsRestoring(false);
            window.onbeforeunload = null;
        }
    };

    const handleDelete = (id) => {
        setDeleteId(id);
    };

    const handleDeleteBackup = async () => {
        if (!deleteId) return;
        try {
            await serverApi.deleteBackup(deleteId);
            setBackups(prev => prev.filter(b => b._id !== deleteId));
            showToast('Backup deleted', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const handleCopyPassword = async (password) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(password);
                showToast('Password copied to clipboard', 'success');
            } else {
                // Fallback for non-secure contexts
                const textArea = document.createElement("textarea");
                textArea.value = password;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    showToast('Password copied to clipboard', 'success');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                    showToast('Failed to copy password: ' + err.message, 'error');
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            console.error('Copy failed', err);
            showToast('Failed to copy password', 'error');
        }
    };

    const formatBytes = (bytes) => {
        if (typeof bytes === 'string' && (bytes.includes('MB') || bytes.includes('GB') || bytes.includes('KB') || bytes.includes('B'))) {
            return bytes; // Return as-is if already formatted
        }
        if (typeof bytes === 'string') bytes = parseFloat(bytes); // Try parsing if string number
        if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Handle MongoDB date format (bson::DateTime serializes as {$date: {$numberLong: "timestamp"}} or {$date: "ISO string"})
    const formatDate = (dateVal) => {
        if (!dateVal) return 'Unknown';
        try {
            let date;
            if (typeof dateVal === 'string') {
                date = new Date(dateVal);
            } else if (dateVal.$date) {
                // MongoDB extended JSON format - can be string or nested object
                if (typeof dateVal.$date === 'string') {
                    date = new Date(dateVal.$date);
                } else if (dateVal.$date.$numberLong) {
                    // bson::DateTime format: {$date: {$numberLong: "timestamp"}}
                    date = new Date(parseInt(dateVal.$date.$numberLong, 10));
                } else {
                    date = new Date(dateVal.$date);
                }
            } else if (dateVal instanceof Date) {
                date = dateVal;
            } else if (typeof dateVal === 'number') {
                date = new Date(dateVal);
            } else {
                date = new Date(dateVal);
            }
            if (isNaN(date.getTime())) return 'Unknown';
            return date.toLocaleString();
        } catch {
            return 'Unknown';
        }
    };

    const openEditNotes = (backup) => {
        setEditingBackup(backup);
        setEditNotes(backup.notes || '');
    };

    const handleUpdateNotes = async () => {
        if (!editingBackup) return;
        setIsSavingNotes(true);
        try {
            // Extract backup ID - handle MongoDB ObjectId format
            let backupId = editingBackup._id || editingBackup.id;
            // Handle MongoDB extended JSON format { $oid: '...' }
            if (backupId && typeof backupId === 'object' && backupId.$oid) {
                backupId = backupId.$oid;
            }
            if (!backupId) {
                throw new Error('Backup ID not found');
            }
            await serverApi.updateBackupNotes(backupId, editNotes || null);
            showToast('Notes updated!', 'success');
            // Update local state using helper to compare IDs
            const getId = (b) => {
                let id = b._id || b.id;
                if (id && typeof id === 'object' && id.$oid) id = id.$oid;
                return id;
            };
            setBackups(prev => prev.map(b =>
                getId(b) === backupId ? { ...b, notes: editNotes || undefined } : b
            ));
            setEditingBackup(null);
        } catch (err) {
            showToast('Failed to update notes: ' + err.message, 'error');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const filteredBackups = backups.filter(backup => {
        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            backup.fileName?.toLowerCase().includes(searchLower) ||
            backup.notes?.toLowerCase().includes(searchLower);

        // Date filter
        let matchesDate = true;
        if (filterDate) {
            const backupDate = new Date(backup.createdAt);
            const [fYear, fMonth, fDay] = filterDate.split('-').map(Number);
            matchesDate = backupDate.getFullYear() === fYear &&
                backupDate.getMonth() === fMonth - 1 &&
                backupDate.getDate() === fDay;
        }

        return matchesSearch && matchesDate;
    });

    // isBusy kept for potential future use
    const _isBusy = loading || isBackupInProgress;

    return (
        <div className="space-y-6 animate-fade-in content-container">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-1 flex items-center gap-3">
                        Backups
                        {isBackupInProgress && (
                            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-full border border-yellow-500/20 animate-pulse">
                                <Loader2 size={12} className="animate-spin" /> In Progress
                            </span>
                        )}
                    </h1>
                    <p className="text-obsidian-muted text-sm">Manage and restore server snapshots.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadConfig}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center"
                    >
                        <Settings className="mr-2" size={18} />
                        Auto Backup
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={isCreating || isBackupInProgress || isRestoring}
                        className="glass-button px-6 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                        {isCreating || isBackupInProgress ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                {isCreating ? 'Creating...' : 'Backup Running'}
                            </>
                        ) : (
                            <><Plus size={20} /> Create Backup</>
                        )}
                    </button>
                </div>
            </div>

            {backupData && (
                <div className="glass-panel rounded-xl p-6 bg-green-500/10 border-green-500/20 mb-6">
                    <div className="flex items-start">
                        <CheckCircle className="text-green-500 shrink-0 mt-1 mr-4" size={24} />
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">Backup Complete!</h3>
                            <p className="text-obsidian-muted mb-4">You can download your backup using the link below.</p>
                            <div className="bg-black/30 rounded-lg p-4 flex items-center justify-between border border-white/5">
                                <span className="font-mono text-sm text-gray-300 truncate mr-4">{backupData.fileName}</span>
                                <a href={backupData.downloadPage} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors text-sm font-medium whitespace-nowrap">
                                    <Download size={16} className="mr-2" /> Download
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="flex gap-4 items-center mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-muted" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by filename or notes..."
                        className="w-full pl-10 pr-4 py-2.5 bg-obsidian-bg border border-obsidian-border rounded-lg text-white placeholder-obsidian-muted focus:outline-none focus:border-obsidian-accent"
                    />
                </div>
                {(searchQuery || filterDate) && (
                    <button
                        onClick={() => { setSearchQuery(''); setFilterDate(''); }}
                        className="text-obsidian-muted hover:text-white text-sm flex items-center gap-1 transition-colors"
                    >
                        <X size={14} /> Clear filters
                    </button>
                )}
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-obsidian-muted">
                        <thead className="bg-white/5 text-xs uppercase font-semibold text-white border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Filename</th>
                                <th className="px-6 py-4">Size</th>
                                <th className="px-6 py-4">Created At</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredBackups.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center opacity-40">
                                            <Archive size={48} className="mb-4" />
                                            <p className="text-lg font-medium text-white">No backups found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBackups.map((backup) => (
                                    <tr key={backup._id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                                <Archive size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span>{backup.fileName}</span>
                                                </div>
                                                {backup.notes && (
                                                    <div className="text-xs text-obsidian-muted mt-0.5 opacity-70 max-w-xs truncate" title={backup.notes}>
                                                        📝 {backup.notes}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {(backup.provider === 'buzzheavier' || backup.downloadPage?.includes('bzzhr') || backup.downloadPage?.includes('buzzheavier')) ? (
                                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 uppercase font-extrabold tracking-wider">Buzzheavier</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 uppercase font-extrabold tracking-wider">GoFile</span>
                                                    )}
                                                    {backup.encryptionPassword && (
                                                        <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase font-extrabold tracking-wider">Encrypted</span>
                                                    )}
                                                </div>
                                                {backup.encryptionPassword && (
                                                    <div className="mt-2 p-1.5 px-2.5 bg-black/40 rounded-lg border border-yellow-500/20 flex items-center justify-between gap-2 max-w-xs">
                                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                                            <Lock size={12} className="text-yellow-400 shrink-0" />
                                                            <span className="text-xs font-mono text-gray-300 truncate">
                                                                {visiblePasswords[backup._id] ? backup.encryptionPassword : '••••••••••••••••'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleShowPassword(backup._id)}
                                                                className="p-1 text-obsidian-muted hover:text-white transition-colors"
                                                                title={visiblePasswords[backup._id] ? "Hide Password" : "Show Password"}
                                                            >
                                                                {visiblePasswords[backup._id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyPassword(backup.encryptionPassword)}
                                                                className="p-1 text-obsidian-muted hover:text-white transition-colors"
                                                                title="Copy Password"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs opacity-70">{formatBytes(backup.size)}</td>
                                        <td className="px-6 py-4 opacity-70">{formatDate(backup.createdAt)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEditNotes(backup)} className="p-2 hover:bg-white/10 rounded-lg text-obsidian-muted hover:text-white transition-colors" title="Edit Notes">
                                                    <Edit2 size={18} />
                                                </button>
                                                {backup.encryptionPassword && (
                                                    <button onClick={() => handleCopyPassword(backup.encryptionPassword)} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Copy Password">
                                                        <Copy size={18} />
                                                    </button>
                                                )}
                                                <a href={backup.downloadPage} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Download">
                                                    <Download size={18} />
                                                </a>
                                                <button onClick={() => handleDelete(backup._id)} className="p-2 hover:bg-red-500/10 text-obsidian-muted hover:text-red-400 rounded-lg transition-colors" title="Delete">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create Cloud Backup"
                footer={
                    <>
                        <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateBackup} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center" disabled={isCreating}>
                            {isCreating ? 'Creating...' : 'Start Backup'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center">
                    <CloudUpload size={48} className="text-obsidian-accent mb-4" />
                    <p className="text-white mb-2">Ready to create a backup?</p>
                    <p className="text-sm text-obsidian-muted mb-4">This will upload your server files to GoFile.</p>

                    <div className="w-full mt-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1 block text-left mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={backupNotes}
                            onChange={(e) => setBackupNotes(e.target.value)}
                            placeholder="e.g., Before 1.21 update, Pre-plugin install..."
                            className="w-full px-4 py-3 bg-obsidian-bg border border-obsidian-border rounded-lg text-white placeholder-obsidian-muted focus:outline-none focus:border-obsidian-accent resize-none"
                            rows={2}
                        />
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Backup Record">
                <div className="text-center">
                    <p className="text-white mb-4">Remove this backup record from history?</p>
                    <div className="flex justify-center gap-3">
                        <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-obsidian-muted">Cancel</button>
                        <button onClick={handleDeleteBackup} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Delete</button>
                    </div>
                </div>
            </Modal>

            {/* Edit Notes Modal */}
            <Modal
                isOpen={!!editingBackup}
                onClose={() => setEditingBackup(null)}
                title="Edit Backup Notes"
                footer={
                    <>
                        <button onClick={() => setEditingBackup(null)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleUpdateNotes} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center" disabled={isSavingNotes}>
                            {isSavingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-obsidian-muted">
                        {editingBackup?.fileName}
                    </p>
                    <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes for this backup..."
                        className="w-full px-4 py-3 bg-obsidian-bg border border-obsidian-border rounded-lg text-white placeholder-obsidian-muted focus:outline-none focus:border-obsidian-accent resize-none"
                        rows={3}
                    />
                </div>
            </Modal>

            <Modal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                title="Auto Backup Settings"
                footer={
                    <>
                        <button onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSaveConfig} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center" disabled={isSavingConfig}>
                            {isSavingConfig ? 'Saving...' : 'Save Settings'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                            <h3 className="text-white font-medium">Enable Auto Backup</h3>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle-checkbox"
                            checked={backupConfig.enabled}
                            onChange={(e) => setBackupConfig({ ...backupConfig, enabled: e.target.checked })}
                        />
                    </div>
                    <div>
                        <Select
                            label="Schedule"
                            value={backupConfig.frequency}
                            onChange={(val) => setBackupConfig({ ...backupConfig, frequency: val })}
                            options={frequencyOptions}
                            disabled={!backupConfig.enabled}
                        />
                    </div>
                    {backupConfig.frequency === 'custom' && (
                        <input
                            type="text"
                            value={backupConfig.cronExpression}
                            onChange={(e) => setBackupConfig({ ...backupConfig, cronExpression: e.target.value })}
                            placeholder="Cron Expression"
                            className="glass-input w-full p-2"
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Backups;
