import React, { useState, useEffect, useCallback } from 'react';
import { useServer } from '../context/ServerContext';
import { useToast } from '../context/ToastContext';
import StatCard from '../components/StatCard';
import { serverApi } from '../api/server';
import { Activity, Cpu, HardDrive, MemoryStick, Play, Square, RefreshCw, Loader2, Server as ServerIcon, Zap, ArrowDown, ArrowUp, Copy, Check } from 'lucide-react';

import { copyToClipboard } from '../utils/copyToClipboard';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Overview = () => {
    const { server, performAction, installServer, socket } = useServer();
    const { showToast } = useToast();
    const [stats, setStats] = useState({
        cpu: 0,
        cores: 0,
        ram: { total: 0, used: 0 },
        storage: { total: 0, used: 0 },
        network: { rx: 0, tx: 0 }
    });
    const [publicIp, setPublicIp] = useState(null);
    const [ipCopied, setIpCopied] = useState(false);

    useEffect(() => {
        serverApi.getPublicIp()
            .then(data => setPublicIp(data.ip))
            .catch(() => setPublicIp('Unavailable'));
    }, []);

    const handleCopyIp = useCallback(async () => {
        if (!publicIp || publicIp === 'Unavailable') return;
        const ok = await copyToClipboard(publicIp);
        if (ok) {
            setIpCopied(true);
            showToast('IP address copied to clipboard!', 'success');
            setTimeout(() => setIpCopied(false), 2000);
        } else {
            showToast('Failed to copy IP address', 'error');
        }
    }, [publicIp, showToast]);

    const handleStart = async () => {
        if (server.isInstalled === false) {
            showToast('Please install the server JAR first!', 'error');
            return;
        }
        try {
            await performAction('start');
        } catch (error) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Failed to start server';
            showToast(errorMsg, 'error');
        }
    };
    useEffect(() => {
        if (!socket) return;
        const onStats = (data) => setStats(prev => ({ ...prev, ...data }));
        socket.on('stats', onStats);
        return () => socket.off('stats', onStats);
    }, [socket]);
    const handleReinstall = async () => {
        if (!server.version) return;
        try {
            await installServer(server.version);
        } catch (error) {
            console.error("Reinstall failed:", error);
        }
    };
    if (!server) return <div className="text-white">Loading...</div>;
    const isOnline = server.status === 'online';
    const isInstalling = server.status === 'installing';
    const ramPercent = stats.ram.total > 0 ? (stats.ram.used / stats.ram.total) * 100 : 0;
    return (

        <div className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Server Overview</h1>
                    <p className="text-obsidian-muted">Manage and monitor your Minecraft server instance.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Public IP pill + copy button */}
                    <button
                        onClick={handleCopyIp}
                        disabled={!publicIp || publicIp === 'Unavailable'}
                        title={publicIp ? `Copy IP: ${publicIp}` : 'Fetching IP...'}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-obsidian-accent/40 px-4 py-2 rounded-full backdrop-blur-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-xs font-mono text-obsidian-muted group-hover:text-white transition-colors">
                            {publicIp ?? 'Fetching...'}
                        </span>
                        {ipCopied
                            ? <Check size={14} className="text-green-400" />
                            : <Copy size={14} className="text-obsidian-muted group-hover:text-obsidian-accent transition-colors" />
                        }
                    </button>
                    {/* Status pill */}
                    <div className="flex items-center space-x-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                        <span className={`relative flex h-3 w-3`}>
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${server.status === 'online' ? 'bg-green-500' :
                                server.status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${server.status === 'online' ? 'bg-green-500' :
                                server.status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></span>
                        </span>
                        <span className="text-white font-medium capitalize tracking-wide">{server.status}</span>
                    </div>
                </div>
            </div>

            {server.isInstalled === false && server.status === 'offline' && (
                <div className="glass-panel rounded-2xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-500/10 rounded-xl text-red-500">
                            <ServerIcon size={32} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-xl mb-1">Server Not Installed</h3>
                            <p className="text-obsidian-muted">Server file (server.jar) is missing. Install a version to get started.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleReinstall}
                        className="glass-button px-6 py-3 rounded-xl flex items-center hover:scale-105 transition-transform"
                    >
                        <RefreshCw size={20} className="mr-2" />
                        Install Server
                    </button>
                </div>
            )}

            {isInstalling && (
                <div className="glass-panel rounded-2xl p-12 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-obsidian-accent/5 animate-pulse-slow"></div>
                    <Loader2 size={48} className="text-obsidian-accent animate-spin mx-auto mb-6 relative z-10" />
                    <h3 className="text-white font-bold text-2xl mb-2 relative z-10">Installing Server...</h3>
                    <p className="text-obsidian-muted relative z-10">Please wait while the server files are downloaded and configured.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                    <StatCard
                        title="Status"
                        value={server.status}
                        subtext={isOnline ? "Server is active" : "Server is offline"}
                        icon={Activity}
                        color="text-blue-400"
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <StatCard
                        title="CPU Usage"
                        value={`${stats.cpu}%`}
                        subtext={`${stats.cores} Cores Active`}
                        icon={Cpu}
                        color="text-obsidian-accent"
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <StatCard
                        title="RAM Usage"
                        value={formatBytes(stats.ram.used)}
                        subtext={`of ${formatBytes(stats.ram.total)} (${Math.round(ramPercent)}%)`}
                        icon={MemoryStick}
                        color="text-purple-400"
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
                    <StatCard
                        title="Storage"
                        value={formatBytes(stats.storage.used)}
                        subtext={`of ${formatBytes(stats.storage.total)} Used`}
                        icon={HardDrive}
                        color="text-green-400"
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '400ms' }}>
                    <StatCard
                        title="Network In"
                        value={stats.network ? `${formatBytes(stats.network.rx)}/s` : '0 B/s'}
                        subtext="Incoming Traffic"
                        icon={ArrowDown}
                        color="text-cyan-400"
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '500ms' }}>
                    <StatCard
                        title="Network Out"
                        value={stats.network ? `${formatBytes(stats.network.tx)}/s` : '0 B/s'}
                        subtext="Outgoing Traffic"
                        icon={ArrowUp}
                        color="text-orange-400"
                    />
                </div>
            </div>

            <div className="glass-panel rounded-2xl p-8">
                <h3 className="text-white font-bold mb-6 flex items-center">
                    <Play size={20} className="mr-2 text-obsidian-accent" />
                    Power Controls
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={handleStart}
                        disabled={isOnline || isInstalling || server.status === 'stopping'}
                        className="group relative overflow-hidden bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] active:scale-95"
                    >
                        <span className="flex items-center justify-center relative z-10">
                            <Play size={20} className="mr-2 fill-current" /> Start Server
                        </span>
                        <div className="absolute inset-0 bg-green-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                await performAction('restart');
                            } catch (error) {
                                showToast(error?.response?.data?.message || error?.message || 'Failed to restart server', 'error');
                            }
                        }}
                        disabled={!isOnline || isInstalling}
                        className="group relative overflow-hidden bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(234,179,8,0.2)] active:scale-95"
                    >
                        <span className="flex items-center justify-center relative z-10">
                            <RefreshCw size={20} className="mr-2" /> Restart
                        </span>
                        <div className="absolute inset-0 bg-yellow-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                await performAction('stop');
                            } catch (error) {
                                showToast(error?.response?.data?.message || error?.message || 'Failed to stop server', 'error');
                            }
                        }}
                        disabled={!isOnline || isInstalling}
                        className="group relative overflow-hidden bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] active:scale-95"
                    >
                        <span className="flex items-center justify-center relative z-10">
                            <Square size={20} className="mr-2 fill-current" /> Stop Server
                        </span>
                        <div className="absolute inset-0 bg-orange-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                await performAction('kill');
                                showToast('Force kill signal sent', 'info');
                            } catch (error) {
                                showToast(error?.response?.data?.message || error?.message || 'Failed to kill server', 'error');
                            }
                        }}
                        disabled={isInstalling}
                        className="group relative overflow-hidden bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] active:scale-95"
                    >
                        <span className="flex items-center justify-center relative z-10">
                            <Zap size={20} className="mr-2 fill-current" /> Force Kill
                        </span>
                        <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-panel rounded-2xl p-6 border border-red-500/20">
                <h3 className="text-red-400 font-bold mb-4 flex items-center text-sm uppercase tracking-wider">
                    <Zap size={16} className="mr-2" />
                    Danger Zone
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-white font-medium">Force Kill Server</h4>
                        <p className="text-sm text-obsidian-muted">Immediately terminate the server process. Data may be lost.</p>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                await performAction('kill');
                                showToast('Force kill signal sent', 'info');
                            } catch (error) {
                                showToast(error?.response?.data?.message || error?.message || 'Failed to kill server', 'error');
                            }
                        }}
                        disabled={isInstalling}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Kill Process
                    </button>
                </div>
            </div>
        </div>
    );
};
export default Overview;
