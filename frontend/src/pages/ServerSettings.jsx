import React, { useState, useEffect, useRef } from 'react';
import { useServer } from '../context/ServerContext';
import { Save, Download, Settings, Eye, EyeOff, ExternalLink, Cpu, Cloud } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import Select from '../components/Select';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import clsx from 'clsx';

const serverTypes = [
    { value: 'vanilla', label: 'Vanilla Minecraft' },
    { value: 'paper', label: 'Paper (High Performance)' },
    { value: 'purpur', label: 'Purpur (Ultra Performance)' },
    { value: 'spigot', label: 'Spigot (Plugins Support)' },
    { value: 'fabric', label: 'Fabric (Lightweight Mods)' },
];

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
    const [showGofileToken, setShowGofileToken] = useState(false);
    const [showBuzzheavierToken, setShowBuzzheavierToken] = useState(false);

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
                javaVersion: parseInt(javaVersion)
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
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Server Settings</h1>
                <p className="text-obsidian-muted text-sm mt-1">Configure server software, memory allocation, and Java version.</p>
            </div>

            {/* MAIN CORE CONFIGURATION */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
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
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Software Type</label>
                        <Select
                            options={serverTypes}
                            value={type}
                            onChange={(val) => setType(val)}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
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

            {/* SAVE BUTTON */}
            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading || isSaving}
                    className="glass-button px-8 py-3 rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 bg-gradient-to-r from-obsidian-accent to-purple-600 text-white font-bold shadow-lg shadow-purple-500/25"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Settings
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
