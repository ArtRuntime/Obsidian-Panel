import React, { useState, useEffect } from 'react';
import { serverApi } from '../api/server';
import { Search, Download, Check, AlertCircle, Package, Loader2, ExternalLink, X, SlidersHorizontal } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Select from '../components/Select';
import clsx from 'clsx';

const STANDARD_VERSIONS = [
    { value: '1.21.4', label: '1.21.4 (Latest)' },
    { value: '1.21.1', label: '1.21.1' },
    { value: '1.20.4', label: '1.20.4' },
    { value: '1.20.1', label: '1.20.1' },
    { value: '1.19.4', label: '1.19.4' },
    { value: '1.18.2', label: '1.18.2' },
    { value: '1.16.5', label: '1.16.5' },
    { value: '1.12.2', label: '1.12.2' },
];

const ALL_VERSIONS = [
    { value: '26.2', label: '26.2 (Snapshot)' },
    { value: '26.1.2', label: '26.1.2 (Snapshot)' },
    { value: '26.1.1', label: '26.1.1 (Snapshot)' },
    { value: '26.1', label: '26.1' },
    { value: '1.21.11', label: '1.21.11' },
    { value: '1.21.10', label: '1.21.10' },
    { value: '1.21.9', label: '1.21.9' },
    { value: '1.21.4', label: '1.21.4 (Latest)' },
    { value: '1.21.1', label: '1.21.1' },
    { value: '1.21', label: '1.21' },
    { value: '1.20.6', label: '1.20.6' },
    { value: '1.20.4', label: '1.20.4' },
    { value: '1.20.2', label: '1.20.2' },
    { value: '1.20.1', label: '1.20.1' },
    { value: '1.19.4', label: '1.19.4' },
    { value: '1.19.2', label: '1.19.2' },
    { value: '1.18.2', label: '1.18.2' },
    { value: '1.17.1', label: '1.17.1' },
    { value: '1.16.5', label: '1.16.5' },
    { value: '1.12.2', label: '1.12.2' },
];

const DEFAULT_LOADERS = [
    { value: 'Fabric', label: 'Fabric' },
    { value: 'Paper', label: 'Paper' },
    { value: 'Spigot', label: 'Spigot' },
    { value: 'Purpur', label: 'Purpur' },
    { value: 'Vanilla', label: 'Vanilla' },
];

// Helper to detect snapshot / non-stable version strings
const isSnapshotVersion = (ver) => {
    if (!ver) return false;
    const clean = String(ver).toLowerCase();
    return (
        clean.includes('snapshot') ||
        clean.includes('alpha') ||
        clean.includes('beta') ||
        clean.includes('-rc') ||
        clean.includes('-pre') ||
        /^\d{2}w\d{2}/.test(clean) ||
        !/^\d+\.\d+(\.\d+)?$/.test(clean)
    );
};

const Plugins = () => {
    const [query, setQuery] = useState('');
    const [plugins, setPlugins] = useState([]);
    const [searching, setSearching] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const { showToast } = useToast();

    // Modal State
    const [selectedPlugin, setSelectedPlugin] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAllVersions, setShowAllVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState('1.20.4');
    const [selectedLoader, setSelectedLoader] = useState('Fabric');
    const [rawModrinthVersions, setRawModrinthVersions] = useState([]); // Store raw versions from Modrinth API
    const [modalVersions, setModalVersions] = useState(STANDARD_VERSIONS);
    const [modalLoaders, setModalLoaders] = useState(DEFAULT_LOADERS);
    const [fetchingDetails, setFetchingDetails] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                handleSearch();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = async () => {
        setSearching(true);
        try {
            const results = await serverApi.searchPlugins(query);
            setPlugins(results);
        } catch (err) {
            console.error(err);
            showToast('Failed to search plugins', 'error');
        } finally {
            setSearching(false);
        }
    };

    // Open Modal when clicking Install on any card
    const openInstallModal = async (plugin) => {
        setSelectedPlugin(plugin);
        setIsModalOpen(true);
        setShowAllVersions(false);
        setRawModrinthVersions([]);

        // Set initial default loader based on plugin flags
        if (plugin.isMod && !plugin.isPlugin) {
            setSelectedLoader('Fabric');
        } else if (plugin.isPlugin) {
            setSelectedLoader('Paper');
        } else {
            setSelectedLoader('Fabric');
        }

        // Fetch dynamic versions from Modrinth if available
        if (plugin.source === 'Modrinth') {
            setFetchingDetails(true);
            try {
                const res = await fetch(`https://api.modrinth.com/v2/project/${plugin.id}/version`);
                if (res.ok) {
                    const versionsData = await res.json();
                    setRawModrinthVersions(versionsData);

                    const gVersions = new Set();
                    const loaders = new Set();

                    versionsData.forEach(v => {
                        (v.game_versions || []).forEach(gv => gVersions.add(gv));
                        (v.loaders || []).forEach(l => loaders.add(l.charAt(0).toUpperCase() + l.slice(1)));
                    });

                    const allGArray = Array.from(gVersions);
                    // Filter out snapshots by default
                    const stableGArray = allGArray.filter(v => !isSnapshotVersion(v));
                    const displayG = (stableGArray.length > 0 ? stableGArray : allGArray).map(v => ({ value: v, label: v }));

                    setModalVersions(displayG.length > 0 ? displayG : STANDARD_VERSIONS);
                    if (displayG.length > 0) setSelectedVersion(displayG[0].value);

                    if (loaders.size > 0) {
                        const parsedL = Array.from(loaders).map(l => ({ value: l, label: l }));
                        setModalLoaders(parsedL);
                        if (parsedL.length > 0) setSelectedLoader(parsedL[0].value);
                    } else {
                        setModalLoaders(DEFAULT_LOADERS);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch Modrinth details:', e.message);
                setModalVersions(STANDARD_VERSIONS);
                setModalLoaders(DEFAULT_LOADERS);
            } finally {
                setFetchingDetails(false);
            }
        } else {
            setModalVersions(STANDARD_VERSIONS);
            setModalLoaders(DEFAULT_LOADERS);
        }
    };

    // Toggle "Show all versions" (including snapshots)
    useEffect(() => {
        if (!selectedPlugin) return;

        if (selectedPlugin.source === 'Modrinth' && rawModrinthVersions.length > 0) {
            const gVersions = new Set();
            rawModrinthVersions.forEach(v => {
                (v.game_versions || []).forEach(gv => gVersions.add(gv));
            });

            const allGArray = Array.from(gVersions);
            const stableGArray = allGArray.filter(v => !isSnapshotVersion(v));

            const targetArray = showAllVersions ? allGArray : (stableGArray.length > 0 ? stableGArray : allGArray);
            const parsed = targetArray.map(v => ({ value: v, label: isSnapshotVersion(v) ? `${v} (Snapshot)` : v }));

            setModalVersions(parsed);
            if (parsed.length > 0 && !parsed.some(p => p.value === selectedVersion)) {
                setSelectedVersion(parsed[0].value);
            }
        } else {
            if (showAllVersions) {
                setModalVersions(ALL_VERSIONS);
            } else {
                setModalVersions(STANDARD_VERSIONS);
                setSelectedVersion('1.21.4');
            }
        }
    }, [showAllVersions, rawModrinthVersions, selectedPlugin]);

    // Confirm Installation from Modal
    const handleConfirmInstall = async () => {
        if (!selectedPlugin) return;
        setInstalling(true);
        try {
            const res = await serverApi.installPlugin(
                selectedPlugin.id,
                selectedPlugin.source,
                selectedVersion,
                selectedLoader
            );
            const folderMsg = res?.targetDir ? ` to ${res.targetDir}/ folder` : '';
            showToast(`Successfully installed ${selectedPlugin.name} (${selectedVersion} - ${selectedLoader})${folderMsg}`, 'success');
            setIsModalOpen(false);
        } catch (err) {
            console.error(err);
            showToast(err.message || `Failed to install ${selectedPlugin.name}`, 'error');
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-[80vh] flex flex-col">
            {/* Header & Search Section */}
            <div className={clsx(
                "flex flex-col items-center transition-all duration-500 ease-in-out",
                plugins.length > 0 || query.length > 0 ? "pt-0 mb-6" : "pt-20 mb-12"
            )}>
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-4xl font-bold text-white tracking-tight">Plugin & Mod Store</h1>
                    <p className="text-obsidian-muted text-lg max-w-md mx-auto">
                        Search and install plugins & mods from Modrinth, Hangar, and Spigot.
                    </p>
                </div>

                <div className={clsx(
                    "relative transition-all duration-500 ease-out",
                    isFocused || query.length > 0 ? "w-full max-w-3xl" : "w-full max-w-lg"
                )}>
                    <div className={clsx(
                        "absolute inset-0 bg-obsidian-accent/20 blur-xl rounded-full transition-opacity duration-500 pointer-events-none",
                        isFocused ? "opacity-100" : "opacity-0"
                    )} />
                    <Search
                        className={clsx(
                            "absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-300 z-10 pointer-events-none",
                            isFocused ? "text-obsidian-accent" : "text-obsidian-muted"
                        )}
                        size={24}
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Search for plugins & mods..."
                        className={clsx(
                            "w-full bg-black/40 border-2 rounded-2xl pl-14 pr-6 py-4 text-lg text-white placeholder-obsidian-muted/50",
                            "focus:outline-none focus:border-obsidian-accent focus:bg-black/60 shadow-xl",
                            "transition-all duration-300 ease-out",
                            isFocused ? "border-obsidian-accent scale-105" : "border-obsidian-border hover:border-obsidian-border/80"
                        )}
                    />
                </div>
            </div>

            {/* Results Grid */}
            <div className={clsx(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 delay-100",
                plugins.length > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}>
                {searching && plugins.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-12">
                        <Loader2 className="animate-spin text-obsidian-accent mb-4" size={40} />
                        <p className="text-obsidian-muted">Searching store...</p>
                    </div>
                ) : plugins.length > 0 ? (
                    plugins.map((plugin, idx) => (
                        <div
                            key={`${plugin.source}-${plugin.id}`}
                            className="group bg-obsidian-surface border border-obsidian-border rounded-xl p-5 flex flex-col hover:border-obsidian-accent/50 hover:bg-obsidian-surface/80 transition-all duration-300 hover:-translate-y-1 shadow-lg"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    {plugin.iconUrl ? (
                                        <img src={plugin.iconUrl} alt={plugin.name} className="w-12 h-12 rounded-xl shadow-md bg-black/20" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-obsidian-bg to-obsidian-surface border border-obsidian-border flex items-center justify-center shadow-md">
                                            <Package size={24} className="text-obsidian-muted" />
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                            {plugin.webUrl ? (
                                                <a
                                                    href={plugin.webUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border hover:underline cursor-pointer flex items-center gap-1 ${plugin.source === 'Modrinth' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                        plugin.source === 'Hangar' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                                                            'text-orange-400 border-orange-400/20 bg-orange-400/10'
                                                        }`}
                                                >
                                                    {plugin.source}
                                                </a>
                                            ) : (
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${plugin.source === 'Modrinth' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                    plugin.source === 'Hangar' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                                                        'text-orange-400 border-orange-400/20 bg-orange-400/10'
                                                    }`}>
                                                    {plugin.source}
                                                </span>
                                            )}

                                            {/* Type Indicator: Plugin, Mod, or Plugin & Mod */}
                                            {plugin.isPlugin && plugin.isMod ? (
                                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded border text-purple-300 border-purple-500/30 bg-purple-500/15 shadow-sm">
                                                    ⚡ Plugin & Mod
                                                </span>
                                            ) : plugin.isMod ? (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                                                    🧩 Mod
                                                </span>
                                            ) : (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-sky-400 border-sky-500/20 bg-sky-500/10">
                                                    🔌 Plugin
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-white line-clamp-1 group-hover:text-obsidian-accent transition-colors" title={plugin.name}>{plugin.name}</h3>
                                        <div className="flex items-center text-xs text-obsidian-muted space-x-2 mt-0.5">
                                            <span>by {plugin.author}</span>
                                            <span className="w-1 h-1 rounded-full bg-obsidian-border" />
                                            <span>{Number(plugin.downloads).toLocaleString()} downls</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed flex-1">
                                {plugin.description}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-obsidian-border/40">
                                <span className="text-xs font-medium text-obsidian-muted flex items-center">
                                    {plugin.source === 'Modrinth' && <img src="https://avatars.githubusercontent.com/u/112328906?s=48&v=4" className="w-4 h-4 mr-1.5 grayscale opacity-50" />}
                                    {plugin.source}
                                </span>

                                <button
                                    onClick={() => openInstallModal(plugin)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center transition-all duration-200 transform active:scale-95 bg-gradient-to-r from-obsidian-accent to-purple-600 hover:from-obsidian-accent-hover hover:to-purple-500 text-white shadow-lg hover:shadow-obsidian-accent/25"
                                >
                                    <Download size={16} className="mr-2" />
                                    Install
                                </button>
                            </div>
                        </div>
                    ))
                ) : null}
            </div>

            {/* Empty State */}
            {!searching && plugins.length === 0 && query.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-obsidian-muted/20 animate-in fade-in zoom-in duration-700">
                    <Search size={120} strokeWidth={1} />
                    <p className="mt-4 text-lg font-medium text-obsidian-muted">Type above to search plugins and mods</p>
                </div>
            )}

            {/* INSTALLATION CONFIGURATION MODAL */}
            {selectedPlugin && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => !installing && setIsModalOpen(false)}
                    title={`Install ${selectedPlugin.name}`}
                    footer={(
                        <div className="flex items-center justify-between w-full">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                disabled={installing}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-obsidian-muted hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmInstall}
                                disabled={installing || fetchingDetails}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 flex items-center transition-all disabled:opacity-50"
                            >
                                {installing ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                        Installing...
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} className="mr-2" />
                                        Install Now
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                >
                    <div className="space-y-5">
                        {/* Plugin Header Summary */}
                        <div className="flex items-center space-x-3 p-3 bg-black/40 rounded-xl border border-white/5">
                            {selectedPlugin.iconUrl ? (
                                <img src={selectedPlugin.iconUrl} alt={selectedPlugin.name} className="w-10 h-10 rounded-lg shadow-md bg-black/20" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-obsidian-surface border border-obsidian-border flex items-center justify-center">
                                    <Package size={20} className="text-obsidian-muted" />
                                </div>
                            )}
                            <div>
                                <h4 className="font-bold text-white text-base">{selectedPlugin.name}</h4>
                                <p className="text-xs text-obsidian-muted">by {selectedPlugin.author} • {selectedPlugin.source}</p>
                            </div>
                        </div>

                        {fetchingDetails ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="animate-spin text-obsidian-accent mr-2" size={20} />
                                <span className="text-xs text-obsidian-muted">Loading supported versions & loaders...</span>
                            </div>
                        ) : (
                            <>
                                {/* Two Dropdown Controls */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Select Game Version</label>
                                        <Select
                                            options={modalVersions}
                                            value={selectedVersion}
                                            onChange={(val) => setSelectedVersion(val)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Select Loader</label>
                                        <Select
                                            options={modalLoaders}
                                            value={selectedLoader}
                                            onChange={(val) => setSelectedLoader(val)}
                                        />
                                    </div>
                                </div>

                                {/* Custom Glossy Toggle Switch */}
                                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                                    <label
                                        onClick={() => setShowAllVersions(!showAllVersions)}
                                        className="flex items-center space-x-3 text-xs font-medium text-gray-300 hover:text-white cursor-pointer select-none group"
                                    >
                                        <div className={clsx(
                                            "w-9 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center shadow-inner border",
                                            showAllVersions
                                                ? "bg-gradient-to-r from-obsidian-accent to-purple-600 border-purple-500/50 shadow-purple-500/20"
                                                : "bg-black/50 border-white/10 group-hover:border-white/20"
                                        )}>
                                            <div className={clsx(
                                                "w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300",
                                                showAllVersions ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </div>
                                        <span className="group-hover:text-white transition-colors">Show all versions (including snapshots)</span>
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Plugins;
