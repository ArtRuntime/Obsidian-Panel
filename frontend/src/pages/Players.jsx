import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import { useServer } from '../context/ServerContext';
import Modal from '../components/Modal';
import {
    Users,
    UserCheck,
    UserX,
    Shield,
    Ban,
    Globe,
    RefreshCw,
    Search,
    MoreVertical,
    Check,
    X,
    AlertCircle,
    UserPlus,
    LogOut,
    Sparkles,
    Copy,
    Activity,
    ShieldAlert
} from 'lucide-react';
import clsx from 'clsx';

function formatLastSeen(dateStr) {
    if (!dateStr) return 'Offline';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Offline';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 30) return `Last seen ${diffDay} days ago`;
    return `Last seen on ${date.toLocaleDateString()}`;
}

export default function Players() {
    const { showToast } = useToast();
    const { server } = useServer();

    const [players, setPlayers] = useState([]);
    const [bannedIps, setBannedIps] = useState([]);
    const [whitelistEnabled, setWhitelistEnabled] = useState(false);
    const [togglingWhitelist, setTogglingWhitelist] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'online' | 'whitelisted' | 'ops' | 'banned'

    // Open Action Menus
    const [activeMenuPlayer, setActiveMenuPlayer] = useState(null);

    // Modals
    const [modalType, setModalType] = useState(null); // 'whitelist' | 'op' | 'ban' | 'bannedIps' | 'kick'
    const [targetPlayer, setTargetPlayer] = useState(null);
    const [modalInput, setModalInput] = useState('');
    const [modalReason, setModalReason] = useState('');
    const [modalOpLevel, setModalOpLevel] = useState(4);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch players data
    const fetchPlayers = useCallback(async (isSilent = false) => {
        if (!isSilent) setRefreshing(true);
        try {
            const data = await serverApi.getAllPlayers();
            setPlayers(data.players || []);
            setBannedIps(data.bannedIps || []);
            setWhitelistEnabled(Boolean(data.whitelistEnabled));
        } catch (err) {
            console.error('Failed to load players:', err);
            showToast(err.message || 'Failed to load players data', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchPlayers();
        // Auto-refresh periodically if server is online
        const interval = setInterval(() => {
            fetchPlayers(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchPlayers]);

    // Close action menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuPlayer(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Filter and search logic
    const filteredPlayers = useMemo(() => {
        return players.filter((p) => {
            // Filter category
            if (activeFilter === 'online' && !p.isOnline) return false;
            if (activeFilter === 'whitelisted' && !p.isWhitelisted) return false;
            if (activeFilter === 'ops' && !p.isOp) return false;
            if (activeFilter === 'banned' && !p.isBanned) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = p.name && p.name.toLowerCase().includes(q);
                const matchUuid = p.uuid && p.uuid.toLowerCase().includes(q);
                return matchName || matchUuid;
            }
            return true;
        });
    }, [players, activeFilter, searchQuery]);

    // Counts
    const counts = useMemo(() => {
        return {
            all: players.length,
            online: players.filter((p) => p.isOnline).length,
            whitelisted: players.filter((p) => p.isWhitelisted).length,
            ops: players.filter((p) => p.isOp).length,
            banned: players.filter((p) => p.isBanned).length,
            bannedIps: bannedIps.length
        };
    }, [players, bannedIps]);

    // Quick Action Handlers
    const handleToggleWhitelist = async (player) => {
        try {
            if (player.isWhitelisted) {
                await serverApi.removePlayerWhitelist(player.name);
                showToast(`Removed ${player.name} from whitelist`, 'success');
            } else {
                await serverApi.addPlayerWhitelist(player.name);
                showToast(`Added ${player.name} to whitelist`, 'success');
            }
            fetchPlayers(true);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleToggleOp = async (player) => {
        try {
            if (player.isOp) {
                await serverApi.removePlayerOp(player.name);
                showToast(`Revoked operator status from ${player.name}`, 'success');
            } else {
                await serverApi.addPlayerOp(player.name, 4);
                showToast(`Granted operator status to ${player.name}`, 'success');
            }
            fetchPlayers(true);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleToggleBan = async (player) => {
        try {
            if (player.isBanned) {
                await serverApi.unbanPlayer(player.name);
                showToast(`Pardoned ${player.name}`, 'success');
                fetchPlayers(true);
            } else {
                setTargetPlayer(player);
                setModalInput(player.name);
                setModalReason('Banned by an operator');
                setModalType('ban');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleOpenKick = (player) => {
        setTargetPlayer(player);
        setModalInput(player.name);
        setModalReason('Kicked by an operator');
        setModalType('kick');
    };

    // Modal submit handler
    const handleModalSubmit = async (e) => {
        e.preventDefault();
        if (!modalInput.trim()) {
            showToast('Username / IP is required', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (modalType === 'whitelist') {
                await serverApi.addPlayerWhitelist(modalInput.trim());
                showToast(`Added ${modalInput.trim()} to whitelist`, 'success');
            } else if (modalType === 'op') {
                await serverApi.addPlayerOp(modalInput.trim(), modalOpLevel);
                showToast(`Granted operator to ${modalInput.trim()}`, 'success');
            } else if (modalType === 'ban') {
                await serverApi.banPlayer(modalInput.trim(), modalReason.trim() || 'Banned by operator');
                showToast(`Banned player ${modalInput.trim()}`, 'success');
            } else if (modalType === 'kick') {
                await serverApi.kickPlayer(modalInput.trim(), modalReason.trim() || 'Kicked by operator');
                showToast(`Kicked player ${modalInput.trim()}`, 'success');
            } else if (modalType === 'banIp') {
                await serverApi.banIp(modalInput.trim(), modalReason.trim() || 'Banned by operator');
                showToast(`Banned IP ${modalInput.trim()}`, 'success');
            }
            setModalType(null);
            setModalInput('');
            setModalReason('');
            fetchPlayers(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnbanIp = async (ip) => {
        try {
            await serverApi.unbanIp(ip);
            showToast(`Pardoned IP ${ip}`, 'success');
            fetchPlayers(true);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleToggleWhitelistEnforcement = async () => {
        setTogglingWhitelist(true);
        try {
            const res = await serverApi.toggleWhitelist(!whitelistEnabled);
            setWhitelistEnabled(res.enabled);
            showToast(res.message || `Whitelist ${res.enabled ? 'enabled' : 'disabled'}`, 'success');
            fetchPlayers(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setTogglingWhitelist(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* TOP HEADER & QUICK ACTION BAR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-black text-white tracking-tight">Players</h1>
                        {counts.online > 0 && (
                            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                {counts.online} Online
                            </span>
                        )}
                        {whitelistEnabled ? (
                            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                Whitelist Active
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/5 text-obsidian-muted border border-white/10">
                                Whitelist Off
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-obsidian-muted mt-1">
                        View active & cached players, manage whitelist access, operators, and ban records.
                    </p>
                </div>

                {/* Top Action Buttons (Matching Screenshot Style) */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Whitelist Toggle Button */}
                    <button
                        type="button"
                        onClick={handleToggleWhitelistEnforcement}
                        disabled={togglingWhitelist}
                        className={clsx(
                            "px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50",
                            whitelistEnabled
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                : "bg-white/5 text-obsidian-muted border-white/10 hover:text-white hover:bg-white/10"
                        )}
                        title={whitelistEnabled ? "Whitelist is active: non-whitelisted players are blocked. Click to turn OFF." : "Whitelist is disabled: any player can join. Click to turn ON."}
                    >
                        <span className={clsx("w-2 h-2 rounded-full", whitelistEnabled ? "bg-amber-400 animate-pulse" : "bg-obsidian-muted")} />
                        <span>Whitelist: {whitelistEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setModalInput('');
                            setModalType('whitelist');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <UserCheck size={14} className="text-amber-400" />
                        Add to whitelist
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setModalInput('');
                            setModalOpLevel(4);
                            setModalType('op');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <Shield size={14} className="text-purple-400" />
                        Add operator
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setModalInput('');
                            setModalReason('Banned by an operator');
                            setModalType('ban');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-red-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <Ban size={14} className="text-red-400" />
                        Ban player
                    </button>

                    <button
                        type="button"
                        onClick={() => setModalType('bannedIps')}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <Globe size={14} className="text-blue-400" />
                        Banned IPs
                        {counts.bannedIps > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono">
                                {counts.bannedIps}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchPlayers(false)}
                        disabled={refreshing}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                        title="Refresh players"
                    >
                        <RefreshCw size={14} className={clsx(refreshing && "animate-spin text-obsidian-accent")} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-lg">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for a player name or UUID..."
                        className="glass-input w-full pl-10 pr-9 py-2.5 rounded-xl text-white text-xs placeholder:text-obsidian-muted/60 focus:ring-2 focus:ring-obsidian-accent/50"
                    />
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-obsidian-muted pointer-events-none z-10" />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-muted hover:text-white z-10"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filter Selector Tabs */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto">
                    {[
                        { key: 'all', label: 'All Players', count: counts.all },
                        { key: 'online', label: 'Online', count: counts.online, color: 'text-emerald-400' },
                        { key: 'whitelisted', label: 'Whitelisted', count: counts.whitelisted, color: 'text-amber-400' },
                        { key: 'ops', label: 'Operators', count: counts.ops, color: 'text-purple-400' },
                        { key: 'banned', label: 'Banned', count: counts.banned, color: 'text-red-400' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveFilter(tab.key)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap",
                                activeFilter === tab.key
                                    ? "bg-white/15 text-white shadow-sm"
                                    : "text-obsidian-muted hover:text-white hover:bg-white/5"
                            )}
                        >
                            <span>{tab.label}</span>
                            <span className={clsx(
                                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                                activeFilter === tab.key ? "bg-white/20 text-white" : "bg-black/30 text-obsidian-muted",
                                tab.color && activeFilter !== tab.key && tab.color
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* SECTION SUBTITLE & COUNTER */}
            <div className="flex items-center justify-between text-xs text-obsidian-muted font-semibold px-1">
                <span>
                    {activeFilter === 'all' && `All players (${filteredPlayers.length})`}
                    {activeFilter === 'online' && `Online players (${filteredPlayers.length})`}
                    {activeFilter === 'whitelisted' && `Whitelisted players (${filteredPlayers.length})`}
                    {activeFilter === 'ops' && `Operators (${filteredPlayers.length})`}
                    {activeFilter === 'banned' && `Banned players (${filteredPlayers.length})`}
                </span>
                {searchQuery && (
                    <span>Filtered by "{searchQuery}"</span>
                )}
            </div>

            {/* PLAYERS CARD GRID */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="glass-panel p-4 rounded-xl border border-white/5 animate-pulse flex items-center gap-3.5">
                            <div className="w-14 h-14 rounded-lg bg-white/5"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-white/10 rounded w-24"></div>
                                <div className="h-3 bg-white/5 rounded w-16"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredPlayers.length === 0 ? (
                <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-obsidian-muted">
                        <Users size={28} />
                    </div>
                    <h3 className="text-base font-bold text-white">No players found</h3>
                    <p className="text-xs text-obsidian-muted max-w-sm mx-auto">
                        {searchQuery
                            ? `No players matched your search for "${searchQuery}".`
                            : activeFilter === 'online'
                            ? "No players are currently online in the server."
                            : activeFilter === 'whitelisted'
                            ? "No players are currently added to the whitelist."
                            : activeFilter === 'ops'
                            ? "No operator accounts are configured yet."
                            : activeFilter === 'banned'
                            ? "No player bans are currently active."
                            : "No players have joined or been configured on this server yet."}
                    </p>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-2 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white transition-colors"
                        >
                            Clear search
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPlayers.map((player) => {
                        const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/64`;

                        return (
                            <div
                                key={player.name || player.uuid}
                                className={clsx(
                                    "glass-panel p-4 rounded-xl border transition-all duration-200 relative group flex items-start justify-between gap-3 shadow-md hover:border-white/20",
                                    player.isOnline ? "border-emerald-500/30 bg-emerald-950/10" : "border-white/10 bg-black/40"
                                )}
                            >
                                <div className="flex items-start gap-3.5 min-w-0">
                                    {/* Player Minecraft Skin Avatar */}
                                    <div className="w-14 h-14 rounded-lg bg-black/60 border border-white/10 shrink-0 overflow-hidden relative flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                                        <img
                                            src={avatarUrl}
                                            alt={player.name}
                                            className="w-full h-full object-contain"
                                            style={{ imageRendering: 'pixelated' }}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = `https://minotar.net/avatar/${encodeURIComponent(player.name)}/64`;
                                            }}
                                        />
                                        {player.isOnline && (
                                            <span
                                                className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black animate-pulse"
                                                title="Online"
                                            />
                                        )}
                                    </div>

                                    {/* Player Details & Badges */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white text-sm truncate tracking-tight">
                                                {player.name}
                                            </span>
                                        </div>

                                        {/* Status / Last seen */}
                                        <p className="text-[11px] text-obsidian-muted font-medium truncate">
                                            {player.isOnline ? (
                                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                                    ● Online now
                                                </span>
                                            ) : player.lastSeen ? (
                                                formatLastSeen(player.lastSeen)
                                            ) : (
                                                <span className="opacity-70">Offline</span>
                                            )}
                                        </p>

                                        {/* Badges Row */}
                                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                            {player.isOnline && (
                                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    Online
                                                </span>
                                            )}
                                            {player.isWhitelisted && (
                                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                    Whitelisted
                                                </span>
                                            )}
                                            {player.isOp && (
                                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                    OP (L{player.opLevel || 4})
                                                </span>
                                            )}
                                            {player.isBanned && (
                                                <span
                                                    className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30"
                                                    title={player.banReason || 'Banned by operator'}
                                                >
                                                    Banned
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Three-Dot Action Dropdown */}
                                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuPlayer(activeMenuPlayer === player.name ? null : player.name)}
                                        className="p-1.5 rounded-lg text-obsidian-muted hover:text-white hover:bg-white/10 transition-colors"
                                        title="Actions"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {activeMenuPlayer === player.name && (
                                        <div className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-[#181a20] border border-white/15 shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 font-sans">
                                            {player.isOnline && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveMenuPlayer(null);
                                                        handleOpenKick(player);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-orange-400 hover:bg-white/10 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                                >
                                                    <LogOut size={13} />
                                                    Kick player
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveMenuPlayer(null);
                                                    handleToggleWhitelist(player);
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-white/10 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                            >
                                                <UserCheck size={13} className={player.isWhitelisted ? "text-amber-400" : "text-obsidian-muted"} />
                                                {player.isWhitelisted ? "Remove whitelist" : "Add to whitelist"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveMenuPlayer(null);
                                                    handleToggleOp(player);
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-white/10 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                            >
                                                <Shield size={13} className={player.isOp ? "text-purple-400" : "text-obsidian-muted"} />
                                                {player.isOp ? "Revoke OP" : "Make Operator"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveMenuPlayer(null);
                                                    handleToggleBan(player);
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                            >
                                                <Ban size={13} />
                                                {player.isBanned ? "Pardon player" : "Ban player"}
                                            </button>

                                            {player.uuid && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(player.uuid);
                                                        showToast('UUID copied to clipboard', 'success');
                                                        setActiveMenuPlayer(null);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-obsidian-muted hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 font-medium transition-colors border-t border-white/5 mt-1 pt-1.5"
                                                >
                                                    <Copy size={13} />
                                                    Copy UUID
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ADD TO WHITELIST MODAL */}
            <Modal
                isOpen={modalType === 'whitelist'}
                onClose={() => setModalType(null)}
                title="Add Player to Whitelist"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleModalSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Player Username
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={modalInput}
                            onChange={(e) => setModalInput(e.target.value)}
                            placeholder="e.g. Notch or Alex"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50"
                        />
                        <p className="text-[11px] text-obsidian-muted ml-1">
                            Players on the whitelist can connect when whitelist enforcement is enabled.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setModalType(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-obsidian-muted hover:text-white bg-white/5 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30 active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Add to Whitelist'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ADD OPERATOR MODAL */}
            <Modal
                isOpen={modalType === 'op'}
                onClose={() => setModalType(null)}
                title="Grant Operator Status"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleModalSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Player Username
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={modalInput}
                            onChange={(e) => setModalInput(e.target.value)}
                            placeholder="e.g. Steve"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500/50"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Permission Level
                        </label>
                        <select
                            value={modalOpLevel}
                            onChange={(e) => setModalOpLevel(parseInt(e.target.value, 10))}
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500/50 bg-[#14151b]"
                        >
                            <option value={4} className="bg-[#14151b]">Level 4 - Full Administrator (All commands & stop)</option>
                            <option value={3} className="bg-[#14151b]">Level 3 - Moderator (Ban, kick, op)</option>
                            <option value={2} className="bg-[#14151b]">Level 2 - Game Master (Cheat commands, gamemode)</option>
                            <option value={1} className="bg-[#14151b]">Level 1 - Spawn VIP (Bypass spawn protection)</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setModalType(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-obsidian-muted hover:text-white bg-white/5 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Granting...' : 'Grant Operator'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* BAN PLAYER MODAL */}
            <Modal
                isOpen={modalType === 'ban'}
                onClose={() => setModalType(null)}
                title="Ban Player"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleModalSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Player Username
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={modalInput}
                            onChange={(e) => setModalInput(e.target.value)}
                            placeholder="e.g. BadPlayer123"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500/50"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Ban Reason (Optional)
                        </label>
                        <input
                            type="text"
                            value={modalReason}
                            onChange={(e) => setModalReason(e.target.value)}
                            placeholder="e.g. Griefing or Breaking rules"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500/50"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setModalType(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-obsidian-muted hover:text-white bg-white/5 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Banning...' : 'Ban Player'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* KICK PLAYER MODAL */}
            <Modal
                isOpen={modalType === 'kick'}
                onClose={() => setModalType(null)}
                title={`Kick Player (${modalInput})`}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleModalSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">
                            Kick Reason
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={modalReason}
                            onChange={(e) => setModalReason(e.target.value)}
                            placeholder="Kicked by an operator"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white text-sm focus:ring-2 focus:ring-orange-500/50"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setModalType(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-obsidian-muted hover:text-white bg-white/5 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-600/30 active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Kicking...' : 'Kick Player'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* BANNED IPS MODAL */}
            <Modal
                isOpen={modalType === 'bannedIps'}
                onClose={() => setModalType(null)}
                title="Banned IP Addresses"
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    {/* Add IP Ban Form */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!modalInput.trim()) return;
                            handleModalSubmit({ preventDefault: () => {} });
                        }}
                        className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2.5"
                    >
                        <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={13} className="text-blue-400" />
                            Ban New IP Address
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={modalInput}
                                onChange={(e) => setModalInput(e.target.value)}
                                placeholder="e.g. 192.168.1.100"
                                className="glass-input flex-1 px-3 py-2 rounded-lg text-white text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setModalType('banIp');
                                    handleModalSubmit({ preventDefault: () => {} });
                                }}
                                disabled={!modalInput.trim() || isSubmitting}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-50 shrink-0"
                            >
                                Ban IP
                            </button>
                        </div>
                    </form>

                    {/* Banned IPs List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {bannedIps.length === 0 ? (
                            <p className="text-xs text-obsidian-muted text-center py-6">
                                No IP addresses are currently banned.
                            </p>
                        ) : (
                            bannedIps.map((item) => (
                                <div
                                    key={item.ip}
                                    className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs"
                                >
                                    <div className="space-y-0.5">
                                        <span className="font-mono font-bold text-white tracking-wide">
                                            {item.ip}
                                        </span>
                                        <p className="text-[10px] text-obsidian-muted">
                                            {item.reason || 'Banned by operator'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleUnbanIp(item.ip)}
                                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                                    >
                                        Unban
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

