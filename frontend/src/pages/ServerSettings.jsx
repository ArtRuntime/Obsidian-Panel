import React, { useState, useEffect, useRef } from 'react';
import { useServer } from '../context/ServerContext';
import { Save, Download, Settings, Eye, EyeOff, ExternalLink, Cpu, Cloud, Server, AlertTriangle, Sparkles, Moon, Clock, ShieldCheck, Terminal, Zap } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import Select from '../components/Select';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import SleepModeCard from '../components/SleepModeCard';
import clsx from 'clsx';

const AIKAR_FLAGS = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true";
const ZGC_FLAGS = "-XX:+UseZGC -XX:+ZGenerational";
const UTF8_FLAGS = "-Dfile.encoding=UTF-8 -Dnet.kyori.ansi.colorLevel=true";

const SERVER_SOFTWARE = [
    {
        key: 'neoforge',
        name: 'NeoForge',
        badge: null,
        icon: '/software/neoforge.svg',
        description: 'A modern Forge successor used by many newer mods and modpacks',
        docs: 'https://docs.neoforged.net/'
    },
    {
        key: 'paper',
        name: 'Paper',
        badge: null,
        icon: '/software/paper.png',
        description: 'Fast and stable server software suited for running plugins with many players',
        docs: 'https://docs.papermc.io/paper/'
    },
    {
        key: 'vanilla',
        name: 'Vanilla',
        badge: null,
        icon: '/software/vanilla.png',
        description: 'The original Minecraft experience without mods or plugins',
        docs: 'https://help.minecraft.net/hc/en-us/articles/360058525452'
    },
    {
        key: 'forge',
        name: 'Forge',
        badge: null,
        icon: '/software/forge.png',
        description: 'The established modding platform used by many mods and modpacks',
        docs: 'https://docs.minecraftforge.net/'
    },
    {
        key: 'purpur',
        name: 'Purpur',
        badge: null,
        icon: '/software/purpur.svg',
        description: 'A highly configurable Paper fork with additional gameplay options',
        docs: 'https://purpurmc.org/docs/purpur/'
    },
    {
        key: 'fabric',
        name: 'Fabric',
        badge: null,
        icon: '/software/fabric.svg',
        description: 'A lightweight modding platform with a large selection of modern mods',
        docs: 'https://wiki.fabricmc.net/'
    },
    {
        key: 'pufferfish',
        name: 'Pufferfish',
        badge: null,
        icon: '/software/pufferfish.svg',
        description: 'A performance-focused Paper derivative designed for larger servers',
        docs: 'https://docs.pufferfish.host/'
    },
    {
        key: 'quilt',
        name: 'Quilt',
        badge: null,
        icon: '/software/quilt.svg',
        description: 'A Fabric-compatible modding platform focused on an open toolchain',
        docs: 'https://quiltmc.org/en/install/server/'
    },
    {
        key: 'folia',
        name: 'Folia',
        badge: 'BETA',
        icon: '/software/folia.svg',
        description: 'An experimental Paper fork designed around regionised multithreading',
        docs: 'https://docs.papermc.io/folia/'
    },
    {
        key: 'arclight',
        name: 'Arclight',
        badge: null,
        icon: '/software/arclight.png',
        description: 'Hybrid software that supports Bukkit plugins alongside mods',
        docs: 'https://github.com/IzzelAliz/Arclight'
    }
];

const serverTypes = SERVER_SOFTWARE.map(s => ({ value: s.key, label: s.name }));

const parseRam = (ramStr) => {
    if (!ramStr) return 1024;
    if (typeof ramStr === 'number') return ramStr;
    const match = ramStr.match(/(\d+)([GMgm])/);
    if (!match) return 1024;
    const val = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    return unit === 'G' ? val * 1024 : val;
};

const formatRam = (ramMB) => {
    if (ramMB % 1024 === 0) return `${ramMB / 1024}G`;
    return `${ramMB}M`;
};

const getRequiredJavaVersion = (mcVersion) => {
    if (!mcVersion) return '21';
    const clean = String(mcVersion).trim();

    const snapshotMatch = clean.match(/^(\d{2})w/i);
    if (snapshotMatch) {
        const year = parseInt(snapshotMatch[1], 10);
        if (year >= 25) return '25';
        if (year >= 24) return '21';
        return '17';
    }

    let minor = 0;
    if (clean.startsWith('1.')) {
        const parts = clean.substring(2).split('.');
        minor = parseInt(parts[0], 10) || 0;
    } else {
        const parts = clean.split('.');
        minor = parseInt(parts[0], 10) || 0;
    }

    if (minor >= 25) return '25';
    if (minor >= 21) return '21';
    if (minor >= 17) return '17';
    return '8';
};

const ServerSettings = () => {
    const { server, updateServer, loading, installServer, socket } = useServer();
    const { showToast } = useToast();

    const [name, setName] = useState('');
    const [ram, setRam] = useState('2G');
    const [type, setType] = useState('vanilla');
    const [gofileToken, setGofileToken] = useState('');
    const [buzzheavierToken, setBuzzheavierToken] = useState('');
    const [buzzheavierDomain, setBuzzheavierDomain] = useState('bzzhr.co');
    const [backupProvider, setBackupProvider] = useState('buzzheavier');
    const [version, setVersion] = useState('');
    const [javaVersion, setJavaVersion] = useState('21');
    const [javaArgs, setJavaArgs] = useState('');
    const [showGofileToken, setShowGofileToken] = useState(false);
    const [showBuzzheavierToken, setShowBuzzheavierToken] = useState(false);

    // Sleep Mode (Join to Start)
    const [sleepModeEnabled, setSleepModeEnabled] = useState(false);
    const [sleepTimeoutMinutes, setSleepTimeoutMinutes] = useState(5);
    const [sleepingMotd, setSleepingMotd] = useState('§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦');
    const [startingMotd, setStartingMotd] = useState('§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!');
    const [wakeKickMessage, setWakeKickMessage] = useState('§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.');

    // RCON (mcrcon) Configuration
    const [rconSilent, setRconSilent] = useState(true);
    const [rconDisableColors, setRconDisableColors] = useState(false);
    const [rconRawOutput, setRconRawOutput] = useState(false);

    const [rawVersions, setRawVersions] = useState([]);
    const [showSnapshots, setShowSnapshots] = useState(false);
    const [availableVersions, setAvailableVersions] = useState([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmUpdateOpen, setIsConfirmUpdateOpen] = useState(false);

    const [totalRamMB, setTotalRamMB] = useState(16384);
    const isInitializedRef = useRef(false);
    const topSaveRef = useRef(null);
    const [isTopSaveVisible, setIsTopSaveVisible] = useState(true);

    // Track visibility of top save button to toggle the floating button
    useEffect(() => {
        const target = topSaveRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsTopSaveVisible(entry.isIntersecting);
            },
            {
                root: null,
                threshold: 0
            }
        );

        observer.observe(target);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Sync form state once on server load
    useEffect(() => {
        if (server && !isInitializedRef.current) {
            isInitializedRef.current = true;
            setName(server.name || '');
            setRam(server.ram || '2G');
            setType(server.type || 'vanilla');
            setGofileToken(server.gofileToken || '');
            setBuzzheavierToken(server.buzzheavierToken || '');
            setBuzzheavierDomain(server.buzzheavierDomain || 'bzzhr.co');
            setBackupProvider(server.backupProvider || 'buzzheavier');
            const serverVer = server.version || '';
            setVersion(serverVer);
            setJavaVersion(server.javaVersion ? String(server.javaVersion) : getRequiredJavaVersion(serverVer));
            setJavaArgs(server.javaArgs || '');
            setSleepModeEnabled(Boolean(server.sleepModeEnabled ?? server.sleepMode?.enabled));
            setSleepTimeoutMinutes(server.sleepTimeoutMinutes ?? server.sleepMode?.timeoutMinutes ?? 5);
            if (server.sleepingMotd || server.sleepMode?.sleepingMotd) {
                setSleepingMotd(server.sleepingMotd || server.sleepMode?.sleepingMotd);
            }
            if (server.startingMotd || server.sleepMode?.startingMotd) {
                setStartingMotd(server.startingMotd || server.sleepMode?.startingMotd);
            }
            if (server.wakeKickMessage || server.sleepMode?.wakeKickMessage) {
                setWakeKickMessage(server.wakeKickMessage || server.sleepMode?.wakeKickMessage);
            }
            setRconSilent(server.rconSilent !== undefined ? Boolean(server.rconSilent) : (server.rcon?.silent ?? true));
            setRconDisableColors(Boolean(server.rconDisableColors ?? server.rcon?.disableColors));
            setRconRawOutput(Boolean(server.rconRawOutput ?? server.rcon?.rawOutput));
            if (server.totalMem) {
                setTotalRamMB(Math.floor(server.totalMem / (1024 * 1024)));
            }
        }
    }, [server]);

    // Automatically update Java version whenever Game Version changes
    useEffect(() => {
        if (version) {
            const reqJava = getRequiredJavaVersion(version);
            setJavaVersion(reqJava);
        }
    }, [version]);

    // Fetch Minecraft versions
    useEffect(() => {
        const fetchVersions = async () => {
            setIsLoadingVersions(true);
            try {
                const res = await fetch('/api/control/versions', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setRawVersions(data);
                }
            } catch (err) {
                console.error("Failed to fetch Minecraft versions", err);
            } finally {
                setIsLoadingVersions(false);
            }
        };
        fetchVersions();
    }, []);

    // Filter versions by snapshot toggle
    useEffect(() => {
        if (rawVersions && rawVersions.length > 0) {
            const filtered = showSnapshots ? rawVersions : rawVersions.filter(v => v.type === 'release');
            setAvailableVersions(filtered.map(v => ({ value: v.id, label: `${v.id} (${v.type})` })));
        } else {
            setAvailableVersions([
                { value: '1.21.4', label: '1.21.4 (release)' },
                { value: '1.21.1', label: '1.21.1 (release)' },
                { value: '1.20.4', label: '1.20.4 (release)' },
                { value: '1.20.1', label: '1.20.1 (release)' },
            ]);
        }
    }, [rawVersions, showSnapshots]);

    // Socket listener for installation progress
    useEffect(() => {
        if (!socket) return;

        const handleProgress = (percent) => {
            setUpdateProgress(Math.round(percent));
        };

        const handleStatus = (statusData) => {
            if (statusData.status === 'installing') {
                setIsUpdating(true);
                setUpdateStatus('installing');
            } else {
                if (isUpdating && statusData.status === 'offline') {
                    setIsUpdating(false);
                    setUpdateStatus('completed');
                    showToast('Server update completed successfully!', 'success');
                }
            }
        };

        socket.on('install_progress', handleProgress);
        socket.on('status', handleStatus);

        return () => {
            socket.off('install_progress', handleProgress);
            socket.off('status', handleStatus);
        };
    }, [socket, isUpdating, showToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateServer({
                name,
                ram,
                type,
                version,
                gofileToken,
                buzzheavierToken,
                buzzheavierDomain,
                backupProvider,
                javaVersion: parseInt(javaVersion),
                javaArgs: javaArgs.trim(),
                sleepModeEnabled,
                sleepTimeoutMinutes: parseInt(sleepTimeoutMinutes, 10) || 5,
                sleepingMotd,
                startingMotd,
                wakeKickMessage,
                rconSilent,
                rconDisableColors,
                rconRawOutput
            });
            showToast('Server settings saved successfully!', 'success');
        } catch (err) {
            showToast('Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmUpdate = async () => {
        setIsConfirmUpdateOpen(false);
        setIsUpdating(true);
        setUpdateProgress(0);
        setUpdateStatus('installing');
        try {
            await installServer(version);
        } catch (err) {
            setIsUpdating(false);
            setUpdateStatus('error');
            showToast(err.message || 'Update failed', 'error');
        }
    };

    const ramValueMB = parseRam(ram);

    const handleRamChange = (e) => {
        const valMB = parseInt(e.target.value);
        setRam(formatRam(valMB));
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* HEADER WITH PRIMARY SAVE BUTTON */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Server Settings</h1>
                    <p className="text-obsidian-muted text-sm mt-1">Configure server software, memory allocation, Java version, and sleep mode.</p>
                </div>
                <button
                    ref={topSaveRef}
                    onClick={handleSave}
                    disabled={loading || isSaving}
                    className="glass-button px-6 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 bg-gradient-to-r from-obsidian-accent to-purple-600 text-white font-bold shadow-lg shadow-purple-500/25 shrink-0 self-start sm:self-center"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            <span>Save Settings</span>
                        </>
                    )}
                </button>
            </div>

            {/* SERVER SOFTWARE SELECTION GRID */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Server size={20} className="text-obsidian-accent" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Server Software</h2>
                            <p className="text-xs text-obsidian-muted mt-0.5">Select the Minecraft server software distribution for your instance.</p>
                        </div>
                    </div>
                    {SERVER_SOFTWARE.find(s => s.key === type)?.docs && (
                        <a
                            href={SERVER_SOFTWARE.find(s => s.key === type).docs}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:flex items-center gap-1.5 text-xs text-obsidian-muted hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg"
                        >
                            <span>Documentation</span>
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {SERVER_SOFTWARE.map((item) => {
                        const isCurrentSelected = type.toLowerCase() === item.key.toLowerCase();
                        const isInstalled = (server?.type || 'vanilla').toLowerCase() === item.key.toLowerCase();
                        return (
                            <div
                                key={item.key}
                                onClick={() => setType(item.key)}
                                className={clsx(
                                    "flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer text-left border relative group select-none",
                                    isCurrentSelected
                                        ? "bg-obsidian-accent/15 border-obsidian-accent ring-2 ring-obsidian-accent/30 shadow-lg shadow-obsidian-accent/10"
                                        : "bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/20"
                                )}
                            >
                                <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-sm">
                                    <img
                                        src={item.icon}
                                        alt={item.name}
                                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = '/software/vanilla.png';
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-white text-base tracking-tight">{item.name}</span>
                                        {isInstalled && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                                INSTALLED
                                            </span>
                                        )}
                                        {!isInstalled && item.badge && (
                                            <span className={clsx(
                                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                                                item.badge === 'BETA' ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                            )}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-obsidian-muted mt-1 leading-relaxed line-clamp-2">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {type === 'folia' && (
                    <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-2.5 text-xs text-orange-300 animate-in fade-in duration-200">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-orange-400" />
                        <div>
                            <strong className="font-semibold text-orange-200">Folia Compatibility Notice:</strong> Folia uses regionised multithreading. Only plugins explicitly built for Folia schedulers are supported. Ordinary Bukkit/Paper plugins may crash or corrupt regions.
                        </div>
                    </div>
                )}

                {['neoforge', 'forge', 'fabric', 'quilt', 'arclight'].includes(type) && (
                    <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-300 animate-in fade-in duration-200">
                        <Sparkles size={16} className="shrink-0 mt-0.5 text-blue-400" />
                        <div>
                            <strong className="font-semibold text-blue-200">Mod Loader Selected:</strong> Make sure mods placed in your <span className="font-mono text-white">/mods</span> directory are compatible with this loader and your Minecraft version.
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CORE CONFIGURATION */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6 relative focus-within:z-30 hover:z-10 [&:has([data-open='true'])]:z-40">
                <div className="flex items-center gap-2 pb-4 border-b border-white/5">
                    <Settings size={20} className="text-obsidian-accent" />
                    <h2 className="text-lg font-bold text-white">Core Configuration</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Server Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full px-4 py-3 rounded-xl text-white font-medium focus:ring-2 focus:ring-obsidian-accent/50 transition-all text-sm"
                            placeholder="My Minecraft Server"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Java Version</label>
                        <Select
                            options={[
                                { value: '25', label: 'Java 25' },
                                { value: '21', label: 'Java 21' },
                                { value: '17', label: 'Java 17' },
                                { value: '8', label: 'Java 8' },
                            ]}
                            value={javaVersion}
                            onChange={(val) => setJavaVersion(val)}
                            className="w-full"
                        />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Game Version</label>
                            <button
                                type="button"
                                onClick={() => setShowSnapshots(!showSnapshots)}
                                className="flex items-center space-x-2 text-xs group focus:outline-none"
                            >
                                <div className={clsx(
                                    "w-7 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center border",
                                    showSnapshots
                                        ? "bg-obsidian-accent border-obsidian-accent"
                                        : "bg-black/40 border-white/10 group-hover:border-white/20"
                                )}>
                                    <div className={clsx(
                                        "w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                                        showSnapshots ? "translate-x-3" : "translate-x-0"
                                    )} />
                                </div>
                                <span className={clsx(
                                    "text-xs transition-colors font-medium select-none",
                                    showSnapshots ? "text-white" : "text-obsidian-muted group-hover:text-gray-300"
                                )}>
                                    Show Snapshots
                                </span>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchableSelect
                                    options={availableVersions}
                                    value={version}
                                    onChange={(newVal) => {
                                        setVersion(newVal);
                                        setJavaVersion(getRequiredJavaVersion(newVal));
                                    }}
                                    placeholder={isLoadingVersions ? "Loading..." : "Select Version"}
                                    disabled={isLoadingVersions || isUpdating}
                                    inputFilter={/[^0-9.]/g}
                                />
                            </div>
                            <button
                                onClick={() => setIsConfirmUpdateOpen(true)}
                                disabled={isUpdating || server.status !== 'offline'}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 rounded-xl font-medium transition-all disabled:opacity-50 hover:border-white/20 flex items-center whitespace-nowrap text-sm"
                                title={server.status !== 'offline' ? 'Stop server first' : 'Download & install JAR'}
                            >
                                {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> : <Download size={16} className="mr-1" />}
                                {isUpdating ? 'Updating...' : 'Update'}
                            </button>
                        </div>
                    </div>

                    {/* RAM Allocation */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Cpu size={16} className="text-obsidian-accent" />
                                <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">RAM Allocation</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-obsidian-muted font-mono hidden sm:inline">
                                    {Math.round((ramValueMB / Math.max(totalRamMB, 2048)) * 100)}% of Max
                                </span>
                                <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-obsidian-accent/15 text-obsidian-accent border border-obsidian-accent/30 shadow-sm shadow-obsidian-accent/10">
                                    {Math.floor(ramValueMB / 1024)} GB ({ramValueMB} MB)
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4 shadow-inner">
                            <div className="relative flex items-center">
                                <input
                                    type="range"
                                    min="1024"
                                    max={Math.max(totalRamMB, 2048)}
                                    step="512"
                                    value={ramValueMB}
                                    onChange={handleRamChange}
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #d946ef ${((ramValueMB - 1024) / (Math.max(totalRamMB, 2048) - 1024)) * 100}%, rgba(255, 255, 255, 0.1) ${((ramValueMB - 1024) / (Math.max(totalRamMB, 2048) - 1024)) * 100}%)`
                                    }}
                                    className="w-full h-3.5 rounded-lg appearance-none cursor-pointer focus:outline-none transition-all duration-150"
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-xs text-obsidian-muted font-mono">Quick Presets:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[1024, 2048, 4096, 8192, 12288, 16384, Math.max(totalRamMB, 2048)].filter((v, i, self) => v <= Math.max(totalRamMB, 2048) && self.indexOf(v) === i).map((presetMB) => (
                                        <button
                                            key={presetMB}
                                            type="button"
                                            onClick={() => setRam(formatRam(presetMB))}
                                            className={clsx(
                                                "px-2.5 py-1 text-xs font-mono rounded-lg transition-all border",
                                                ramValueMB === presetMB
                                                    ? "bg-obsidian-accent text-white border-obsidian-accent font-bold shadow-md shadow-obsidian-accent/30 scale-105"
                                                    : "bg-white/5 hover:bg-white/10 text-obsidian-muted hover:text-white border-white/10"
                                            )}
                                        >
                                            {Math.floor(presetMB / 1024)} GB
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Extra Java Arguments (JVM Flags) */}
                    <div className="md:col-span-2 space-y-3 pt-4 border-t border-white/5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Terminal size={16} className="text-obsidian-accent" />
                                <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">
                                    Extra Java Arguments (JVM Flags)
                                </label>
                            </div>

                            {/* Preset Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setJavaArgs(AIKAR_FLAGS)}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                    title="Aikar's Optimized G1GC Flags for high-performance Paper/Purpur/Folia servers"
                                >
                                    <Sparkles size={11} className="text-amber-400" />
                                    Aikar's Flags
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setJavaArgs(ZGC_FLAGS)}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                    title="Generational ZGC for low-latency Java 21+"
                                >
                                    <Zap size={11} className="text-indigo-400" />
                                    Generational ZGC
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setJavaArgs(UTF8_FLAGS)}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                    title="Force UTF-8 file encoding & ANSI color level"
                                >
                                    UTF-8 Flags
                                </button>
                                {javaArgs && (
                                    <button
                                        type="button"
                                        onClick={() => setJavaArgs('')}
                                        className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-obsidian-muted hover:text-white border border-white/10 transition-all cursor-pointer"
                                        title="Clear Java arguments"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <textarea
                            rows={3}
                            value={javaArgs}
                            onChange={(e) => setJavaArgs(e.target.value)}
                            placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -Dfile.encoding=UTF-8"
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-obsidian-accent/50 resize-y"
                        />

                        <p className="text-xs text-obsidian-muted ml-1 opacity-75">
                            Custom JVM flags passed to the Java runtime before launching the server JAR (or saved to <code className="text-white font-mono text-[11px]">user_jvm_args.txt</code> for Forge/NeoForge).
                        </p>
                    </div>
                </div>
            </div>

            {/* RCON REMOTE CONSOLE & MCRCON CONFIGURATION */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <Terminal size={20} className="text-obsidian-accent" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-white">RCON Console (mcrcon)</h2>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    mcrcon
                                </span>
                            </div>
                            <p className="text-xs text-obsidian-muted mt-0.5">
                                Configure Minecraft Remote Console arguments and communication behavior ported from mcrcon.
                            </p>
                        </div>
                    </div>
                    {server?.rconPort > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-obsidian-muted shrink-0 self-start sm:self-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>Port: <strong className="text-white">{server.rconPort}</strong></span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Silent Mode (-s) Toggle */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3",
                        rconSilent
                            ? "bg-obsidian-accent/10 border-obsidian-accent/40 shadow-sm"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                    )}>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-white">Silent Mode</span>
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-purple-300">-s</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRconSilent(!rconSilent)}
                                    className="focus:outline-none cursor-pointer"
                                    title="Toggle Silent Mode (-s)"
                                >
                                    <div className={clsx(
                                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center border",
                                        rconSilent
                                            ? "bg-obsidian-accent border-obsidian-accent"
                                            : "bg-black/40 border-white/10"
                                    )}>
                                        <div className={clsx(
                                            "w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                                            rconSilent ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </div>
                                </button>
                            </div>
                            <p className="text-xs text-obsidian-muted leading-relaxed">
                                Suppresses RCON execution chatter and sets <code className="text-white font-mono text-[11px]">broadcast-rcon-to-ops=false</code> to prevent in-game chat spamming.
                            </p>
                        </div>
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-obsidian-muted">Console chatter:</span>
                            <span className={clsx("font-semibold", rconSilent ? "text-emerald-400" : "text-amber-400")}>
                                {rconSilent ? "Silenced (Clean)" : "Broadcasted"}
                            </span>
                        </div>
                    </div>

                    {/* Disable Colors (-c) Toggle */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3",
                        rconDisableColors
                            ? "bg-obsidian-accent/10 border-obsidian-accent/40 shadow-sm"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                    )}>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-white">Disable Colors</span>
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-purple-300">-c</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRconDisableColors(!rconDisableColors)}
                                    className="focus:outline-none cursor-pointer"
                                    title="Toggle Disable Colors (-c)"
                                >
                                    <div className={clsx(
                                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center border",
                                        rconDisableColors
                                            ? "bg-obsidian-accent border-obsidian-accent"
                                            : "bg-black/40 border-white/10"
                                    )}>
                                        <div className={clsx(
                                            "w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                                            rconDisableColors ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </div>
                                </button>
                            </div>
                            <p className="text-xs text-obsidian-muted leading-relaxed">
                                Strips Minecraft section sign color codes (<code className="text-white font-mono text-[11px]">§</code>) and ANSI escape sequences from command outputs.
                            </p>
                        </div>
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-obsidian-muted">Color formatting:</span>
                            <span className={clsx("font-semibold", rconDisableColors ? "text-blue-400" : "text-purple-400")}>
                                {rconDisableColors ? "Monochrome" : "Colors enabled"}
                            </span>
                        </div>
                    </div>

                    {/* Raw Output (-r) Toggle */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3",
                        rconRawOutput
                            ? "bg-obsidian-accent/10 border-obsidian-accent/40 shadow-sm"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                    )}>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-white">Raw Output</span>
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-purple-300">-r</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRconRawOutput(!rconRawOutput)}
                                    className="focus:outline-none cursor-pointer"
                                    title="Toggle Raw Output (-r)"
                                >
                                    <div className={clsx(
                                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center border",
                                        rconRawOutput
                                            ? "bg-obsidian-accent border-obsidian-accent"
                                            : "bg-black/40 border-white/10"
                                    )}>
                                        <div className={clsx(
                                            "w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                                            rconRawOutput ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </div>
                                </button>
                            </div>
                            <p className="text-xs text-obsidian-muted leading-relaxed">
                                Outputs raw packet payloads as sent by the server without extra post-processing or trimming.
                            </p>
                        </div>
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-obsidian-muted">Packet mode:</span>
                            <span className={clsx("font-semibold", rconRawOutput ? "text-amber-400" : "text-emerald-400")}>
                                {rconRawOutput ? "Raw packets" : "Parsed & trimmed"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* BACKUP CLOUD PROVIDERS & CREDENTIALS */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
                <div className="flex items-center gap-2 pb-4 border-b border-white/5">
                    <Cloud size={20} className="text-obsidian-accent" />
                    <div>
                        <h2 className="text-lg font-bold text-white">Backup Storage Provider</h2>
                        <p className="text-xs text-obsidian-muted">Select your preferred cloud storage service and configure account credentials.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Active Provider Selection Cards */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Active Backup Storage Provider</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setBackupProvider('buzzheavier')}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer",
                                    backupProvider === 'buzzheavier'
                                        ? "bg-obsidian-accent/15 border-obsidian-accent text-white shadow-lg shadow-purple-500/10 ring-1 ring-obsidian-accent"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-sm text-white">Buzzheavier</span>
                                    </div>
                                    <p className="text-xs text-obsidian-muted">Fast uploads via w.bzzhr.co, w.bzzhr.to & w.buzzheavier.com</p>
                                </div>
                                <div className={clsx(
                                    "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5",
                                    backupProvider === 'buzzheavier' ? "border-obsidian-accent bg-obsidian-accent" : "border-white/30"
                                )}>
                                    {backupProvider === 'buzzheavier' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setBackupProvider('gofile')}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer",
                                    backupProvider === 'gofile'
                                        ? "bg-obsidian-accent/15 border-obsidian-accent text-white shadow-lg shadow-purple-500/10 ring-1 ring-obsidian-accent"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-sm text-white">GoFile Cloud</span>
                                    </div>
                                    <p className="text-xs text-obsidian-muted">Official GoFile API storage integration</p>
                                </div>
                                <div className={clsx(
                                    "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5",
                                    backupProvider === 'gofile' ? "border-obsidian-accent bg-obsidian-accent" : "border-white/30"
                                )}>
                                    {backupProvider === 'gofile' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Credentials Configuration Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5">
                        {/* Buzzheavier Domain Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Buzzheavier Upload Domain</label>
                            <Select
                                options={[
                                    { value: 'bzzhr.co', label: 'bzzhr.co (w.bzzhr.co - Recommended)' },
                                    { value: 'bzzhr.to', label: 'bzzhr.to (w.bzzhr.to)' },
                                    { value: 'buzzheavier.com', label: 'buzzheavier.com (w.buzzheavier.com)' }
                                ]}
                                value={buzzheavierDomain}
                                onChange={(val) => setBuzzheavierDomain(val)}
                                className="w-full"
                            />
                            <p className="text-xs text-obsidian-muted ml-1 opacity-70">
                                Select primary proxy domain for Buzzheavier uploads.
                            </p>
                        </div>

                        {/* Buzzheavier Account ID */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Buzzheavier Account ID / Token</label>
                                <a
                                    href="https://buzzheavier.com/login"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-xs text-obsidian-accent hover:underline font-semibold"
                                >
                                    <span>Get Account ID</span>
                                    <ExternalLink size={12} className="ml-1" />
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showBuzzheavierToken ? "text" : "password"}
                                    value={buzzheavierToken}
                                    onChange={(e) => setBuzzheavierToken(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-white font-medium text-sm pr-12 focus:ring-2 focus:ring-obsidian-accent/50 transition-all font-mono"
                                    placeholder="YOUR_ACCOUNT_ID (Bearer Token)"
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowBuzzheavierToken(!showBuzzheavierToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-muted hover:text-white transition-colors"
                                    title={showBuzzheavierToken ? "Hide token" : "Show token"}
                                >
                                    {showBuzzheavierToken ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-obsidian-muted ml-1 opacity-70">
                                Enter your Buzzheavier Account ID for user directory uploads.
                            </p>
                        </div>

                        {/* GoFile API Token */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">GoFile API Token</label>
                                <a
                                    href="https://gofile.io/my-profile"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-xs text-obsidian-accent hover:underline font-semibold"
                                >
                                    <span>Get Token</span>
                                    <ExternalLink size={12} className="ml-1" />
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showGofileToken ? "text" : "password"}
                                    value={gofileToken}
                                    onChange={(e) => setGofileToken(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-white font-medium text-sm pr-12 focus:ring-2 focus:ring-obsidian-accent/50 transition-all font-mono"
                                    placeholder="Enter your GoFile API Token"
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowGofileToken(!showGofileToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-muted hover:text-white transition-colors"
                                    title={showGofileToken ? "Hide token" : "Show token"}
                                >
                                    {showGofileToken ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-obsidian-muted ml-1 opacity-70">
                                Enter your GoFile API Token for authenticated GoFile uploads.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SLEEP MODE & JOIN-TO-START */}
            <SleepModeCard
                enabled={sleepModeEnabled}
                setEnabled={setSleepModeEnabled}
                timeoutMinutes={sleepTimeoutMinutes}
                setTimeoutMinutes={setSleepTimeoutMinutes}
                sleepingMotd={sleepingMotd}
                setSleepingMotd={setSleepingMotd}
                startingMotd={startingMotd}
                setStartingMotd={setStartingMotd}
                wakeKickMessage={wakeKickMessage}
                setWakeKickMessage={setWakeKickMessage}
                server={server}
            />

            {/* FLOATING SAVE BUTTON (Shown when the top save button is scrolled out of view) */}
            <div
                className={clsx(
                    "fixed bottom-6 right-6 md:right-8 z-30 transition-all duration-300 transform",
                    isTopSaveVisible
                        ? "opacity-0 translate-y-6 pointer-events-none scale-95"
                        : "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                )}
            >
                <button
                    onClick={handleSave}
                    disabled={loading || isSaving}
                    className="glass-button px-6 py-3 rounded-2xl flex items-center gap-2.5 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 bg-gradient-to-r from-obsidian-accent to-purple-600 text-white font-bold shadow-2xl shadow-purple-500/40 border border-white/20 backdrop-blur-xl group transition-all"
                    title="Save all server settings"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <Save size={18} className="text-white group-hover:rotate-6 transition-transform" />
                            <span>Save Settings</span>
                        </>
                    )}
                </button>
            </div>

            {/* CONFIRMATION MODAL FOR UPDATE */}
            <Modal
                isOpen={isConfirmUpdateOpen}
                onClose={() => setIsConfirmUpdateOpen(false)}
                title="Confirm Server Software Update"
                footer={(
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={() => setIsConfirmUpdateOpen(false)}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-obsidian-muted hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmUpdate}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-lg shadow-purple-500/25 flex items-center transition-all"
                        >
                            <Download size={16} className="mr-2" />
                            Start Update & Download
                        </button>
                    </div>
                )}
            >
                <div className="space-y-3 text-sm text-gray-300">
                    <p>
                        You are about to download and install <strong className="text-white">{type.toUpperCase()}</strong> version <strong className="text-white">{version}</strong>.
                    </p>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                        This action will replace the existing server JAR file. Please ensure your server is stopped before updating.
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ServerSettings;
