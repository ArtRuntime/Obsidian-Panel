import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Terminal, Folder, Settings, Shield, HardDrive, Server, LogOut, Package, User, Github, Coffee, Download, CheckCircle, RefreshCw, AlertTriangle, Copy, Check, Clock, Sparkles, Sliders } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import Modal from './Modal';

const Sidebar = ({ isOpen, onClose }) => {
    const { logout, user } = useAuth();
    const [updateInfo, setUpdateInfo] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const [checking, setChecking] = useState(false);
    const checkingRef = useRef(false);

    const checkUpdate = useCallback(async () => {
        if (checkingRef.current) return;
        checkingRef.current = true;
        setChecking(true);
        try {
            const res = await fetch('/api/system/update-check', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUpdateInfo(data);
            }
        } catch (err) {
            console.error("Silent update check failed", err);
        } finally {
            setChecking(false);
            checkingRef.current = false;
        }
    }, []);

    useEffect(() => {
        checkUpdate();
    }, [checkUpdate]);

    const handleUpdateClick = () => {
        if (updateInfo && updateInfo.updateAvailable) {
            setShowUpdateModal(true);
        } else {
            checkUpdate();
        }
    };

    const handleCopyCommand = () => {
        const command = "bash <(curl -s https://raw.githubusercontent.com/ArtRuntime/Obsidian-Panel/master/install.sh)";

        // Try modern API first (requires HTTPS/localhost)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(command)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(err => {
                    console.warn('Clipboard API failed, trying fallback...', err);
                    fallbackCopyTextToClipboard(command);
                });
        } else {
            // Fallback for HTTP/insecure contexts
            fallbackCopyTextToClipboard(command);
        }
    };

    const fallbackCopyTextToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Ensure it's not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                console.error('Fallback: Copying text command was unsuccessful');
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    };

    const allNavItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/', permission: 'overview.view' }, // Default for all usually, but can be explicit
        { icon: Terminal, label: 'Console', path: '/console', permission: 'console.view' }, // View logs only
        { icon: Folder, label: 'Files', path: '/files', permission: 'files.view' },
        { icon: Package, label: 'Plugin Store', path: '/plugins', permission: 'plugins.manage' },
        { icon: Sparkles, label: 'Server Templates', path: '/templates', permission: 'settings.edit' },
        { icon: HardDrive, label: 'Backups', path: '/backups', permission: 'backups.view' },
        { icon: Clock, label: 'Schedules', path: '/schedules', permission: 'settings.edit' },
        { icon: Settings, label: 'Server Settings', path: '/server-settings', permission: 'settings.edit' },
        { icon: Sliders, label: 'In-Game Settings', path: '/game-settings', permission: 'settings.edit' },
        { icon: Shield, label: 'General Settings', path: '/general-settings', permission: 'settings.edit' },
        { icon: User, label: 'Users', path: '/users', adminOnly: true },
    ];

    const navItems = allNavItems.filter(item => {
        // Admin sees everything
        if (user?.role === 'admin') return true;

        // User role: only sees Overview
        if (user?.role === 'user') {
            return item.label === 'Overview';
        }

        // Sub-admin checks permissions
        if (item.adminOnly) return false;

        // Overview is always shown for sub-admins
        if (item.label === 'Overview') return true;

        // Check if sub-admin has permission for this item
        if (item.permission) {
            return user?.permissions?.includes(item.permission);
        }

        return true;
    });
    const sidebarClasses = clsx(
        'bg-obsidian-surface-glass backdrop-blur-xl border-r border-obsidian-border flex flex-col',
        'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
    );
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={onClose}
                />
            )}
            <div className={sidebarClasses}>
                <div className="h-16 flex items-center px-6 border-b border-white/5 justify-between">
                    <div className="flex items-center group cursor-pointer">
                        <div className="relative">
                            <Shield className="text-obsidian-accent mr-3 transition-transform group-hover:scale-110 duration-300" size={24} />
                            <div className="absolute inset-0 bg-obsidian-accent blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white group-hover:text-obsidian-accent transition-colors duration-300">Obsidian</span>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => onClose && window.innerWidth < 768 && onClose()}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                                    isActive
                                        ? 'text-white shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-white/10'
                                        : 'text-obsidian-muted hover:text-white hover:bg-white/5'
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-obsidian-accent/20 to-transparent opacity-100 transition-opacity duration-300" />
                                    )}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-obsidian-accent rounded-r-full shadow-[0_0_10px_#8b5cf6]"></div>
                                    )}
                                    <item.icon
                                        size={20}
                                        className={clsx(
                                            "mr-3 z-10 transition-transform duration-300 group-hover:scale-110",
                                            isActive ? "text-obsidian-accent drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" : "group-hover:text-white"
                                        )}
                                    />
                                    <span className={clsx("font-medium text-sm z-10", isActive && "font-semibold")}>{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/5 bg-black/20">
                    {checking ? (
                        <div className="mb-3 flex items-center justify-center space-x-2 opacity-70">
                            <RefreshCw size={12} className="text-obsidian-muted animate-spin" />
                            <span className="text-[10px] text-obsidian-muted font-mono">Checking...</span>
                        </div>
                    ) : updateInfo && updateInfo.updateAvailable ? (
                        <div
                            onClick={handleUpdateClick}
                            className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between group cursor-pointer hover:bg-yellow-500/20 transition-all"
                        >
                            <div className="flex items-center text-xs text-yellow-500 font-medium">
                                <Download size={14} className="mr-2 animate-bounce" />
                                <span>Update Available</span>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={checkUpdate}
                            className="mb-3 flex items-center justify-center space-x-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer group"
                            title="Click to check for updates"
                        >
                            <div className={`w-1.5 h-1.5 rounded-full bg-green-500 group-hover:scale-125 transition-transform`}></div>
                            <span className="text-[10px] text-obsidian-muted font-mono group-hover:text-white transition-colors">
                                {updateInfo ? 'System Up to Date' : 'System Online'}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <a
                            href="https://github.com/ArtRuntime/Obsidian-Panel"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs border border-white/5 hover:border-white/20"
                            title="Project Source"
                        >
                            <Github size={14} className="mr-1.5" /> Source
                        </a>
                        <a
                            href="https://buymeacoffee.com/alex5402"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center p-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500/70 hover:text-yellow-400 transition-all text-xs border border-yellow-500/10 hover:border-yellow-500/30"
                            title="Buy Me a Coffee"
                        >
                            <Coffee size={14} className="mr-1.5" /> Donate
                        </a>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-2.5 text-obsidian-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-300 group hover:border-red-500/20 text-xs font-medium"
                    >
                        <LogOut size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
                        <span>Logout</span>
                    </button>
                </div>
            </div >

            <Modal
                isOpen={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
                title="Update Available"
            >
                <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start">
                        <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5 mr-3" size={20} />
                        <div className="text-sm">
                            <h4 className="font-bold text-yellow-500 mb-1">Important: Stop Server First</h4>
                            <p className="text-yellow-500/80">
                                You must stop your Minecraft server from the console before proceeding with the update to prevent data corruption.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm text-gray-400">
                            Updates are applied by reinstalling the panel container. Your data (worlds, plugins, configs) will be preserved.
                        </p>
                        <p className="text-sm font-medium text-white">
                            Run this command in your terminal:
                        </p>
                        <div className="relative group">
                            <div className="bg-black/50 border border-white/10 rounded-lg p-3 pr-10 font-mono text-xs text-green-400 break-all">
                                bash &lt;(curl -s https://raw.githubusercontent.com/ArtRuntime/Obsidian-Panel/master/install.sh)
                            </div>
                            <button
                                onClick={handleCopyCommand}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};
export default Sidebar;
