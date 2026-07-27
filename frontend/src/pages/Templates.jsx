import React, { useState, useEffect } from 'react';
import { Sparkles, Download, Check, Shield, Zap, Globe, Server, Loader2, Sword, Skull, Layers, Crown, Compass, Settings } from 'lucide-react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import Select from '../components/Select';
import clsx from 'clsx';

const TEMPLATES = [
    {
        id: 'survival-smp',
        title: 'Survival SMP Pack',
        subtitle: 'Paper 1.21.1 + Pre-configured Essentials & Permissions',
        category: 'survival',
        type: 'paper',
        version: '1.21.1',
        ram: '4GB',
        badge: 'Popular',
        badgeColor: 'from-purple-500 to-indigo-600',
        icon: Shield,
        description: 'Complete high-performance SMP server template equipped with EssentialsX, LuckPerms, Vault, WorldEdit, and Chunky pre-configured for optimal survival gameplay.',
        features: ['Paper 1.21.1 Engine', 'EssentialsX & Economy', 'LuckPerms Pre-configured', 'WorldEdit & Chunky Pre-loaded'],
        plugins: [
            { id: 'essentialsx', source: 'Modrinth' },
            { id: 'luckperms', source: 'Modrinth' },
            { id: 'worldedit', source: 'Modrinth' },
            { id: 'chunky', source: 'Modrinth' }
        ]
    },
    {
        id: 'fabric-optimization',
        title: 'Fabric Performance Pack',
        subtitle: 'Fabric 1.21.1 + Sodium, Lithium & FerriteCore',
        category: 'performance',
        type: 'fabric',
        version: '1.21.1',
        ram: '4GB',
        badge: 'High FPS',
        badgeColor: 'from-emerald-500 to-teal-600',
        icon: Zap,
        description: 'Ultra-fast Fabric modded template optimized for high player counts and minimal RAM footprint using Sodium, Lithium, FerriteCore, and Krypton.',
        features: ['Fabric 1.21.1 Engine', 'Lithium Server Physics Fixes', 'FerriteCore RAM Optimization', 'Krypton Network Compression'],
        plugins: [
            { id: 'lithium', source: 'Modrinth' },
            { id: 'ferrite-core', source: 'Modrinth' },
            { id: 'krypton', source: 'Modrinth' }
        ]
    },
    {
        id: 'geyser-bedrock-proxy',
        title: 'Cross-Platform Bedrock SMP',
        subtitle: 'Paper 1.20.4 + Geyser & Floodgate Pre-installed',
        category: 'survival',
        type: 'paper',
        version: '1.20.4',
        ram: '4GB',
        badge: 'Cross-Play',
        badgeColor: 'from-blue-500 to-cyan-600',
        icon: Globe,
        description: 'Allow players from Minecraft Bedrock Edition (iOS, Android, Windows, Xbox, PlayStation) to seamlessly join your Java edition server without an extra account.',
        features: ['GeyserMC & Floodgate Included', 'ViaVersion & ViaBackwards', 'Bedrock & Java Crossplay', 'Paper 1.20.4 High Performance'],
        plugins: [
            { id: 'geyser', source: 'Modrinth' },
            { id: 'floodgate', source: 'Modrinth' },
            { id: 'viaversion', source: 'Modrinth' },
            { id: 'viabackwards', source: 'Modrinth' }
        ]
    },
    {
        id: 'vanilla-survival',
        title: 'Pure Vanilla Survival',
        subtitle: 'Official Vanilla 1.21.4 Clean Environment',
        category: 'survival',
        type: 'vanilla',
        version: '1.21.4',
        ram: '2GB',
        badge: 'Official',
        badgeColor: 'from-amber-500 to-orange-600',
        icon: Server,
        description: 'Clean, unmodified official Minecraft Vanilla 1.21.4 server environment for authentic survival multiplayer without plugins or mods.',
        features: ['Official Mojang Vanilla 1.21.4', 'Zero Plugins / Mods', 'Pure Vanilla Game Mechanics', 'Instant 1-Click Launch'],
        plugins: []
    },
    {
        id: 'bedwars-minigames',
        title: 'BedWars & Minigames Hub',
        subtitle: 'Paper 1.20.4 + Pre-configured Arenas & Lobby',
        category: 'minigames',
        type: 'paper',
        version: '1.20.4',
        ram: '4GB',
        badge: 'Minigames',
        badgeColor: 'from-rose-500 to-red-600',
        icon: Sword,
        description: 'Action-packed BedWars and minigame server template pre-loaded with arena auto-resets, cosmetics, leaderboards, and custom lobby spawn.',
        features: ['Paper 1.20.4 High Performance', 'BedWars Arenas Pre-built', 'Cosmetics & Scoreboards', 'Lobby Auto-Spawn System'],
        plugins: [
            { id: 'luckperms', source: 'Modrinth' },
            { id: 'worldedit', source: 'Modrinth' },
            { id: 'decentholograms', source: 'Modrinth' }
        ]
    },
    {
        id: 'lifesteal-anarchy',
        title: 'Lifesteal & Anarchy SMP',
        subtitle: 'Purpur 1.20.4 + Heart Stealing & CombatLog',
        category: 'survival',
        type: 'purpur',
        version: '1.20.4',
        ram: '4GB',
        badge: 'Hardcore',
        badgeColor: 'from-red-600 to-rose-700',
        icon: Skull,
        description: 'High-stakes Lifesteal SMP template where killing players steals their max health hearts. Includes CombatLog safeguard, world border, and anti-cheat.',
        features: ['Purpur 1.20.4 Ultra Performance', 'Lifesteal Heart Stealing Mechanic', 'CombatLog Safeguard', 'World Border & Anti-Cheat'],
        plugins: [
            { id: 'chunky', source: 'Modrinth' },
            { id: 'luckperms', source: 'Modrinth' }
        ]
    },
    {
        id: 'spigot-classic-plugins',
        title: 'Spigot Classic Plugin Suite',
        subtitle: 'Spigot 1.20.1 + Multiverse & WorldGuard',
        category: 'survival',
        type: 'spigot',
        version: '1.20.1',
        ram: '3GB',
        badge: 'Classic',
        badgeColor: 'from-sky-500 to-blue-600',
        icon: Layers,
        description: 'Traditional Spigot server template pre-loaded with classic plugins like Multiverse-Core, WorldGuard, WorldEdit, Vault, and EssentialsX.',
        features: ['Spigot 1.20.1 Engine', 'Multiverse Multi-World Support', 'WorldGuard Region Protection', 'Vault & EssentialsX Integrated'],
        plugins: [
            { id: 'essentialsx', source: 'Modrinth' },
            { id: 'luckperms', source: 'Modrinth' },
            { id: 'worldedit', source: 'Modrinth' }
        ]
    },
    {
        id: 'skyblock-kingdom',
        title: 'SkyBlock Island Realm',
        subtitle: 'Paper 1.20.4 + SuperiorSkyblock & Economy',
        category: 'minigames',
        type: 'paper',
        version: '1.20.4',
        ram: '4GB',
        badge: 'SkyBlock',
        badgeColor: 'from-cyan-500 to-blue-600',
        icon: Compass,
        description: 'Custom SkyBlock island setup with starter island schematics, island upgrades, level calculations, custom shop, and player auctions.',
        features: ['SuperiorSkyblock2 Core', 'Starter Island Schematics', 'Custom Shop & Economy', 'Island Level Rankings'],
        plugins: [
            { id: 'luckperms', source: 'Modrinth' },
            { id: 'worldedit', source: 'Modrinth' }
        ]
    },
    {
        id: 'purpur-extreme-smp',
        title: 'Purpur Extreme Performance SMP',
        subtitle: 'Purpur 1.21.1 + Spark Profiler & Entity Stacking',
        category: 'performance',
        type: 'purpur',
        version: '1.21.1',
        ram: '6GB',
        badge: 'Ultra TPS',
        badgeColor: 'from-violet-500 to-purple-700',
        icon: Zap,
        description: 'Ultra-tuned Purpur 1.21.1 template with mob stacking, tick-rate optimization, Spark performance profiler, and asynchronous chunk loading.',
        features: ['Purpur 1.21.1 Engine', 'Mob & Item Stacker', 'Spark Performance Profiler', 'Async Chunk Generation'],
        plugins: [
            { id: 'spark', source: 'Modrinth' },
            { id: 'chunky', source: 'Modrinth' }
        ]
    }
];

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
    { value: '26.1', label: '26.1' },
    { value: '1.21.4', label: '1.21.4 (Latest)' },
    { value: '1.21.1', label: '1.21.1' },
    { value: '1.20.6', label: '1.20.6' },
    { value: '1.20.4', label: '1.20.4' },
    { value: '1.20.1', label: '1.20.1' },
    { value: '1.19.4', label: '1.19.4' },
    { value: '1.18.2', label: '1.18.2' },
    { value: '1.16.5', label: '1.16.5' },
    { value: '1.12.2', label: '1.12.2' },
];

const CATEGORIES = [
    { id: 'all', label: 'All Templates' },
    { id: 'survival', label: 'Survival & SMP' },
    { id: 'performance', label: 'Performance & Mods' },
    { id: 'minigames', label: 'Minigames' }
];

const Templates = () => {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [activeCategory, setActiveCategory] = useState('all');
    const [isApplying, setIsApplying] = useState(false);
    const [customVersion, setCustomVersion] = useState('1.21.1');
    const [showAllVersions, setShowAllVersions] = useState(false);

    const { showToast } = useToast();
    const navigate = useNavigate();

    const filteredTemplates = activeCategory === 'all'
        ? TEMPLATES
        : TEMPLATES.filter(t => t.category === activeCategory);

    const openApplyModal = (tpl) => {
        setSelectedTemplate(tpl);
        setCustomVersion(tpl.version || '1.21.1');
        setShowAllVersions(false);
    };

    const handleApplyTemplate = async (tpl) => {
        setIsApplying(true);
        try {
            const res = await serverApi.applyTemplate({
                type: tpl.type,
                version: customVersion,
                ram: tpl.ram,
                plugins: tpl.plugins || []
            });

            const countMsg = res?.installedPlugins?.length ? ` (installed ${res.installedPlugins.length} plugins/mods)` : '';
            showToast(`Template "${tpl.title}" (${customVersion}) applied successfully!${countMsg}`, 'success');
            setSelectedTemplate(null);
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to apply template', 'error');
        } finally {
            setIsApplying(false);
        }
    };

    const availableVersionOptions = showAllVersions ? ALL_VERSIONS : STANDARD_VERSIONS;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-[80vh]">
            <div className="text-center max-w-2xl mx-auto space-y-3 pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-accent/10 border border-obsidian-accent/20 text-obsidian-accent text-xs font-semibold uppercase tracking-wider">
                    <Sparkles size={14} /> Server Template Market
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight">One-Click Server Templates</h1>
                <p className="text-obsidian-muted text-base">
                    Deploy pre-configured Minecraft server templates with optimized engines, plugins, and performance mods in 1 click.
                </p>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={clsx(
                                "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                                activeCategory === cat.id
                                    ? "bg-obsidian-accent text-white border-obsidian-accent shadow-lg shadow-purple-500/20 scale-105"
                                    : "bg-white/5 hover:bg-white/10 text-obsidian-muted hover:text-white border-white/10"
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {filteredTemplates.map((tpl) => {
                    const IconComp = tpl.icon;
                    return (
                        <div
                            key={tpl.id}
                            className="group bg-obsidian-surface border border-obsidian-border hover:border-obsidian-accent/50 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-xl relative overflow-hidden"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 rounded-xl bg-obsidian-accent/10 border border-obsidian-accent/20 flex items-center justify-center text-obsidian-accent group-hover:scale-110 transition-transform">
                                            <IconComp size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-obsidian-accent transition-colors">{tpl.title}</h3>
                                            <p className="text-xs text-obsidian-muted">{tpl.subtitle}</p>
                                        </div>
                                    </div>
                                    <span className={clsx("px-2.5 py-1 text-[10px] uppercase font-extrabold rounded-full text-white bg-gradient-to-r shadow-md", tpl.badgeColor)}>
                                        {tpl.badge}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-400 leading-relaxed">
                                    {tpl.description}
                                </p>

                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <span className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Included Features:</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {tpl.features.map((feat, idx) => (
                                            <div key={idx} className="flex items-center text-xs text-gray-300">
                                                <Check size={14} className="text-emerald-400 mr-1.5 flex-shrink-0" />
                                                <span className="truncate">{feat}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-xs text-obsidian-muted">
                                    <span className="font-semibold text-white uppercase">{tpl.type}</span>
                                    <span>•</span>
                                    <span>{tpl.ram} RAM</span>
                                </div>

                                <button
                                    onClick={() => openApplyModal(tpl)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-obsidian-accent to-purple-600 hover:from-obsidian-accent-hover hover:to-purple-500 shadow-lg shadow-obsidian-accent/20 flex items-center transition-all transform active:scale-95"
                                >
                                    <Download size={16} className="mr-2" />
                                    Apply Template
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Template Confirmation Modal */}
            {selectedTemplate && (
                <Modal
                    isOpen={!!selectedTemplate}
                    onClose={() => !isApplying && setSelectedTemplate(null)}
                    title={`Apply ${selectedTemplate.title}`}
                    footer={(
                        <div className="flex items-center justify-between w-full">
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                disabled={isApplying}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-obsidian-muted hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleApplyTemplate(selectedTemplate)}
                                disabled={isApplying}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 flex items-center transition-all disabled:opacity-50"
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                        Applying Template...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} className="mr-2" />
                                        Confirm & Apply ({customVersion})
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                >
                    <div className="space-y-5 text-sm">
                        <p className="text-gray-300">
                            Applying <strong className="text-white">{selectedTemplate.title}</strong> will configure your server software to <span className="text-obsidian-accent font-semibold uppercase">{selectedTemplate.type}</span> and automatically download all included plugins/mods ({selectedTemplate.plugins?.length || 0} items).
                        </p>

                        {/* Version Selection Selector */}
                        <div className="p-4 bg-black/40 rounded-xl border border-white/10 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Select Game Version</label>
                                <span className="text-xs text-obsidian-accent font-semibold">Engine: {selectedTemplate.type.toUpperCase()}</span>
                            </div>
                            <Select
                                options={availableVersionOptions}
                                value={customVersion}
                                onChange={(val) => setCustomVersion(val)}
                            />

                            {/* Glossy Toggle Switch */}
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                <label
                                    onClick={() => setShowAllVersions(!showAllVersions)}
                                    className="flex items-center space-x-3 text-xs font-medium text-gray-300 hover:text-white cursor-pointer select-none group"
                                >
                                    <div className={clsx(
                                        "w-8 h-4.5 rounded-full p-0.5 transition-colors duration-300 flex items-center shadow-inner border",
                                        showAllVersions
                                            ? "bg-gradient-to-r from-obsidian-accent to-purple-600 border-purple-500/50 shadow-purple-500/20"
                                            : "bg-black/50 border-white/10 group-hover:border-white/20"
                                    )}>
                                        <div className={clsx(
                                            "w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform duration-300",
                                            showAllVersions ? "translate-x-3.5" : "translate-x-0"
                                        )} />
                                    </div>
                                    <span className="group-hover:text-white transition-colors">Show all versions (including snapshots)</span>
                                </label>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start space-x-2">
                            <Sparkles size={16} className="flex-shrink-0 mt-0.5" />
                            <span>This operation will prepare your server files and download preset plugins/mods for <strong>{customVersion}</strong>. Make sure to stop your server before applying if it is currently running.</span>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Templates;
