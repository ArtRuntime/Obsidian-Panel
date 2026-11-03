import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Trash2, Edit, Save, X, User as UserIcon, Check, Key } from 'lucide-react';
import clsx from 'clsx';
import { serverApi } from '../api/server';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

// ... (PERMISSIONS array not repeated here if possible, but I must match target)
// Actually I can just target the top block.

const PERMISSION_GROUPS = [
    {
        category: 'Server Control & Power',
        permissions: [
            { id: 'overview.control', label: 'Control Power (Start/Stop/Kill)' },
            { id: 'sleep.manage', label: 'Manage Sleep Mode & Auto-Shutdown' },
        ]
    },
    {
        category: 'Console',
        permissions: [
            { id: 'console.view', label: 'View Console Logs' },
            { id: 'console.command', label: 'Execute Console Commands' },
        ]
    },
    {
        category: 'File Manager',
        permissions: [
            { id: 'files.view', label: 'View/Download Files' },
            { id: 'files.upload', label: 'Upload/Create Files & Remote Download' },
            { id: 'files.edit', label: 'Edit, Move & Compress Files' },
            { id: 'files.delete', label: 'Delete Files' },
        ]
    },
    {
        category: 'Plugins & Modpacks',
        permissions: [
            { id: 'plugins.view', label: 'View Installed Plugins & Modpacks' },
            { id: 'plugins.manage', label: 'Install/Manage Plugins & Mods' },
        ]
    },
    {
        category: 'Backups & Storage',
        permissions: [
            { id: 'backups.view', label: 'View Backups' },
            { id: 'backups.create', label: 'Create Backups' },
            { id: 'backups.restore', label: 'Restore Backups' },
            { id: 'backups.delete', label: 'Delete Backups' },
            { id: 'backups.settings', label: 'Manage Backup Settings' },
        ]
    },
    {
        category: 'Settings & Configuration',
        permissions: [
            { id: 'settings.edit', label: 'Edit Server Software & RAM' },
            { id: 'game.edit', label: 'Edit In-Game Settings (server.properties)' },
            { id: 'general.edit', label: 'Edit General Settings' },
        ]
    },
    {
        category: 'Automation & Templates',
        permissions: [
            { id: 'schedules.manage', label: 'Create & Run Schedules' },
            { id: 'templates.manage', label: 'Apply Server Templates' },
        ]
    },
    {
        category: 'Players & Moderation',
        permissions: [
            { id: 'players.view', label: 'View Players List & Status' },
            { id: 'players.manage', label: 'Manage Players (Whitelist, OP, Ban, Kick)' },
        ]
    },
    {
        category: 'User Accounts',
        permissions: [
            { id: 'users.view', label: 'View Users List' },
            { id: 'users.manage', label: 'Manage Users & Roles' },
        ]
    }
];

const PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions);

const Users = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    const fetchUsers = async () => {
        try {
            const data = await serverApi.getUsers();
            setUsers(data);
        } catch {
            toast.error('Failed to fetch users');
        }
    };

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        fetchUsers();
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setRole('user');
        setSelectedPermissions([]);
        setEditingUser(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user) => {
        setUsername(user.username);
        setPassword(''); // Don't show existing hash
        setRole(user.role);
        setSelectedPermissions(user.permissions || []);
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (permId) => {
        setSelectedPermissions(prev =>
            prev.includes(permId)
                ? prev.filter(p => p !== permId)
                : [...prev, permId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                username,
                role,
                permissions: role === 'admin' ? [] : selectedPermissions,
            };
            if (password) payload.password = password;

            const targetId = editingUser?._id || editingUser?.id;
            if (editingUser) {
                await serverApi.updateUser(targetId, payload);
                toast.success('User updated successfully');
            } else {
                if (!password) return toast.error('Password is required for new users');
                await serverApi.createUser(payload);
                toast.success('User created successfully');
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            toast.error(err?.message || 'Operation failed');
        }
    };

    const [userToDelete, setUserToDelete] = useState(null);

    const confirmDelete = async () => {
        if (!userToDelete) return;
        try {
            const deleteId = userToDelete?._id || userToDelete?.id;
            await serverApi.deleteUser(deleteId);
            toast.success('User deleted');
            setUserToDelete(null);
            fetchUsers();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete user');
        }
    };

    const handleDeleteClick = (user) => {
        setUserToDelete(user);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Shield className="text-obsidian-accent" size={32} />
                        User Management
                    </h1>
                    <p className="text-obsidian-muted mt-1">Manage admins, sub-admins, and permissions.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="glass-button bg-obsidian-accent text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-obsidian-accent-hover transition-colors"
                >
                    <Plus size={18} />
                    Create User
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user, index) => (
                    <div key={user.id || `user-${index}`} className="glass-panel p-6 rounded-xl relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                                    user.role === 'admin' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                        user.role === 'sub-admin' ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                                            "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                )}>
                                    <UserIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{user.username}</h3>
                                    <span className={clsx(
                                        "text-xs uppercase px-2 py-0.5 rounded border",
                                        user.role === 'admin' ? "text-red-400 border-red-500/20 bg-red-500/10" :
                                            user.role === 'sub-admin' ? "text-purple-400 border-purple-500/20 bg-purple-500/10" :
                                                "text-blue-400 border-blue-500/20 bg-blue-500/10"
                                    )}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenEdit(user)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-obsidian-muted hover:text-white transition-colors"
                                    title="Edit User"
                                >
                                    <Edit size={16} />
                                </button>
                                {currentUser?.id !== user.id && (
                                    <button
                                        onClick={() => handleDeleteClick(user)}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-obsidian-muted hover:text-red-400 transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {user.role === 'sub-admin' && (
                            <div className="mt-4 border-t border-white/5 pt-4">
                                <p className="text-xs text-obsidian-muted mb-2 uppercase font-bold tracking-wider">Permissions</p>
                                <div className="flex flex-wrap gap-2">
                                    {(user.permissions || []).slice(0, 5).map(perm => (
                                        <span key={perm} className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                            {perm}
                                        </span>
                                    ))}
                                    {(user.permissions?.length || 0) > 5 && (
                                        <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">
                                            +{user.permissions.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Edit User" : "Create User"} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="glass-input w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">
                            {editingUser ? "New Password (Optional)" : "Password"}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-input w-full"
                            placeholder={editingUser ? "Leave blank to keep current" : ""}
                        />
                    </div>
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">Role</label>
                        <div className="flex gap-4">
                            {['user', 'sub-admin', 'admin'].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg border text-sm font-semibold transition-all",
                                        role === r
                                            ? "bg-obsidian-accent/20 border-obsidian-accent text-white"
                                            : "bg-white/5 border-white/10 text-obsidian-muted hover:bg-white/10"
                                    )}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(role === 'sub-admin' || role === 'user') && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <label className="block text-white text-sm font-semibold">{role === 'sub-admin' ? 'Sub-admin Permissions' : 'User Permissions'}</label>
                                    <p className="text-xs text-obsidian-muted">
                                        {selectedPermissions.length} of {PERMISSIONS.length} permissions granted
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPermissions(PERMISSIONS.map(p => p.id))}
                                        className="text-xs font-semibold text-obsidian-accent hover:text-purple-400 transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-600">|</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPermissions([])}
                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {PERMISSION_GROUPS.map((group) => (
                                    <div key={group.category} className="space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-obsidian-muted flex items-center gap-2">
                                            <span>{group.category}</span>
                                            <div className="flex-1 h-px bg-white/5"></div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {group.permissions.map((perm) => (
                                                <label
                                                    key={perm.id}
                                                    className={clsx(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none",
                                                        selectedPermissions.includes(perm.id)
                                                            ? "bg-green-500/10 border-green-500/30"
                                                            : "bg-white/5 border-white/5 hover:border-white/20"
                                                    )}
                                                >
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                                                        selectedPermissions.includes(perm.id)
                                                            ? "bg-green-500 border-green-500"
                                                            : "border-gray-500"
                                                    )}>
                                                        {selectedPermissions.includes(perm.id) && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={selectedPermissions.includes(perm.id)}
                                                        onChange={() => handlePermissionToggle(perm.id)}
                                                    />
                                                    <span className={clsx(
                                                        "text-xs font-medium leading-tight",
                                                        selectedPermissions.includes(perm.id) ? "text-green-400" : "text-gray-400"
                                                    )}>
                                                        {perm.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-obsidian-muted hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-obsidian-accent hover:bg-obsidian-accent-hover text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-lg hover:shadow-obsidian-accent/25 transition-all"
                        >
                            <Save size={18} />
                            Save User
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Delete User">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                        <Trash2 size={24} />
                        <div>
                            <p className="font-bold text-sm uppercase tracking-wider">Warning</p>
                            <p className="text-sm opacity-90">This action cannot be undone.</p>
                        </div>
                    </div>

                    <p className="text-gray-300">
                        Are you sure you want to delete user <strong className="text-white">{userToDelete?.username}</strong>?
                        They will lose all access to the panel immediately.
                    </p>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            onClick={() => setUserToDelete(null)}
                            className="px-4 py-2 rounded-lg text-obsidian-muted hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold shadow-lg hover:shadow-red-900/20 transition-all flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            Confirm Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Users;
