import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Sliders, Save, Shield, Radio, Zap, Users, Globe, RefreshCw,
    Skull, Server, Cpu, HardDrive, Package, Settings, Lock,
    Wifi, Database, ChevronRight, ToggleLeft, ToggleRight,
    Map, Layers, Terminal, Upload, ImageIcon
} from 'lucide-react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import Select from '../components/Select';
import clsx from 'clsx';

// ─── Toggle component ──────────────────────────────────────────────────────

const Toggle = ({ value, onChange, colorOn = 'emerald' }) => {
    const isOn = value === 'true' || value === true;
    const colors = {
        emerald: ['bg-emerald-500/20 text-emerald-400 border-emerald-500/40', 'bg-rose-500/20 text-rose-400 border-rose-500/40'],
        amber:   ['bg-amber-500/20 text-amber-400 border-amber-500/40', 'bg-white/10 text-gray-400 border-white/10'],
        purple:  ['bg-purple-500/20 text-purple-300 border-purple-500/40', 'bg-white/10 text-gray-400 border-white/10'],
        blue:    ['bg-blue-500/20 text-blue-400 border-blue-500/40', 'bg-white/10 text-gray-400 border-white/10'],
    };
    const [onCls, offCls] = colors[colorOn] || colors.emerald;
    return (
        <button
            type="button"
            onClick={() => onChange(isOn ? 'false' : 'true')}
            className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex-shrink-0',
                isOn ? onCls : offCls
            )}
        >
            {isOn ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {isOn ? 'ON' : 'OFF'}
        </button>
    );
};

// ─── Input component ────────────────────────────────────────────────────────

const PropInput = ({ value, onChange, type = 'text', placeholder, min, max }) => (
    <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="glass-input w-full px-3 py-2 rounded-xl text-white text-sm font-medium focus:ring-1 focus:ring-obsidian-accent/50"
    />
);

// ─── Section card ───────────────────────────────────────────────────────────

const SectionCard = ({ title, icon: Icon, iconColor = 'text-purple-400', children, className }) => (
    <div className={clsx("glass-panel rounded-2xl border border-white/10 relative focus-within:z-30 hover:z-10 [&:has([data-open='true'])]:z-40", className)}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <Icon size={18} className={iconColor} />
            <h2 className="text-sm font-bold text-white">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
    { id: 'core',         label: 'Core',              icon: Sliders },
    { id: 'network',      label: 'Network',           icon: Wifi    },
    { id: 'world',        label: 'World',             icon: Map     },
    { id: 'performance',  label: 'Performance',       icon: Cpu     },
    { id: 'players',      label: 'Players & Security',icon: Shield  },
    { id: 'resourcepack', label: 'Resource Pack',     icon: Package },
    { id: 'advanced',     label: 'Advanced',          icon: Settings},
];

const TAB_KEYS = {
    core:         ['gamemode','difficulty','hardcore','pvp','online-mode','max-players','force-gamemode'],
    network:      ['server-ip','server-port','query.port','enable-query','enable-status','motd','network-compression-threshold','use-native-transport','enable-rcon','rcon.port','rcon.password','accepts-transfers'],
    world:        ['level-name','level-seed','level-type','generator-settings','generate-structures','max-world-size'],
    performance:  ['view-distance','simulation-distance','max-tick-time','max-chained-neighbor-updates','sync-chunk-writes','entity-broadcast-range-percentage','pause-when-empty-seconds'],
    players:      ['white-list','enforce-whitelist','spawn-protection','allow-flight','op-permission-level','function-permission-level','player-idle-timeout','prevent-proxy-connections','enforce-secure-profile','log-ips','hide-online-players','rate-limit'],
    resourcepack: ['resource-pack','resource-pack-id','resource-pack-sha1','resource-pack-prompt','require-resource-pack','initial-enabled-packs','initial-disabled-packs'],
    advanced:     ['management-server-enabled','management-server-host','management-server-port','management-server-allowed-origins','management-server-tls-enabled','management-server-tls-keystore','management-server-tls-keystore-password','management-server-secret','broadcast-console-to-ops','broadcast-rcon-to-ops','debug','enable-jmx-monitoring','enable-code-of-conduct','chat-spam-threshold-seconds','command-spam-threshold-seconds','status-heartbeat-interval','bug-report-link','region-file-compression','text-filtering-config','text-filtering-version'],
};

// ─── Main component ───────────────────────────────────────────────────────────

const GameSettings = () => {
    const { showToast } = useToast();
    const [serverProps, setServerProps] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fileExists, setFileExists] = useState(false);
    const [activeTab, setActiveTab] = useState('core');
    const [serverIcon, setServerIcon] = useState(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const iconInputRef = useRef(null);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const props = await serverApi.getServerProperties();
            if (props && Object.keys(props).length > 0) {
                setServerProps(props);
                setFileExists(true);
            } else {
                setServerProps({});
                setFileExists(false);
            }
        } catch (e) {
            console.error('Failed to load server.properties:', e.message);
            setFileExists(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProperties(); }, []);

    // Fetch current server icon
    useEffect(() => {
        serverApi.getServerIcon().then(data => {
            if (data?.icon) setServerIcon(data.icon);
        }).catch(() => {});
    }, []);

    const handleIconUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingIcon(true);
        try {
            await serverApi.uploadServerIcon(file);
            showToast('Server icon updated!', 'success');
            // Refresh icon
            const data = await serverApi.getServerIcon();
            if (data?.icon) setServerIcon(data.icon);
        } catch (err) {
            showToast(err.message || 'Failed to upload icon', 'error');
        } finally {
            setUploadingIcon(false);
            if (iconInputRef.current) iconInputRef.current.value = '';
        }
    }, [showToast]);

    const set = (key, val) => setServerProps(prev => ({ ...prev, [key]: String(val) }));
    const has = (key) => key in serverProps;
    const get = (key, def = '') => serverProps[key] ?? def;

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await serverApi.updateServerProperties(serverProps);
            showToast('server.properties saved!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    }, [serverProps, showToast]);

    // Keyboard shortcut: Ctrl+S / Cmd+S to save
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Only show tabs that have at least one key present in the loaded props
    const activeTabs = useMemo(() =>
        TABS.filter(t => TAB_KEYS[t.id]?.some(k => has(k))),
    [serverProps]);

    useEffect(() => {
        if (activeTabs.length > 0 && !activeTabs.find(t => t.id === activeTab)) {
            setActiveTab(activeTabs[0].id);
        }
    }, [activeTabs]);

    // Unknown keys show in Advanced
    const knownKeys = new Set(Object.values(TAB_KEYS).flat());
    const unknownProps = Object.keys(serverProps).filter(k => !knownKeys.has(k));

    // ── Loading state ──
    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-obsidian-muted text-sm">Loading server.properties...</p>
        </div>
    );

    // ── No file state ──
    if (!fileExists) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-lg mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Server size={40} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">No server.properties Found</h2>
                <p className="text-obsidian-muted text-sm">Start or install your server once to generate the file.</p>
            </div>
            <button onClick={fetchProperties} className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-sm font-bold transition-all flex items-center gap-2">
                <RefreshCw size={15} /> Re-check
            </button>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Sliders className="text-purple-400" size={28} />
                        Game Settings
                    </h1>
                    <p className="text-obsidian-muted text-sm mt-1">
                        Visual editor for <code className="text-purple-400 font-mono text-xs bg-purple-500/10 px-1.5 py-0.5 rounded">server.properties</code>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchProperties}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={15} className={clsx(loading && 'animate-spin')} />
                        Refresh
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-obsidian-accent hover:brightness-110 shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                        {saving ? 'Saving...' : 'Save Properties'}
                    </button>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar border-b border-white/10 pb-0">
                {activeTabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px',
                                isActive
                                    ? 'border-purple-500 text-white'
                                    : 'border-transparent text-obsidian-muted hover:text-white hover:border-white/20'
                            )}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ═══════════════ TAB: CORE ═══════════════ */}
            {activeTab === 'core' && (
                <div className="space-y-5">
                    {/* Server Icon */}
                    <SectionCard title="Server Icon" icon={ImageIcon} iconColor="text-pink-400">
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-16 h-16 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                                    {serverIcon ? (
                                        <img src={serverIcon} alt="Server Icon" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={24} className="text-gray-600" />
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-white font-medium mb-1">Server Icon</p>
                                <p className="text-[11px] text-gray-500 mb-3">Upload any image — it will be auto-converted to 64×64 PNG.</p>
                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleIconUpload}
                                    className="hidden"
                                    id="icon-upload"
                                />
                                <button
                                    onClick={() => iconInputRef.current?.click()}
                                    disabled={uploadingIcon}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {uploadingIcon
                                        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                                        : <><Upload size={14} /> Choose Image</>
                                    }
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                    <SectionCard title="Game Mode & Difficulty" icon={Sliders}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {has('gamemode') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Game Mode</label>
                                    <Select
                                        options={[
                                            { value: 'survival',  label: 'Survival'  },
                                            { value: 'creative',  label: 'Creative'  },
                                            { value: 'adventure', label: 'Adventure' },
                                            { value: 'spectator', label: 'Spectator' },
                                        ]}
                                        value={get('gamemode', 'survival')}
                                        onChange={v => set('gamemode', v)}
                                    />
                                    <p className="text-[10px] text-gray-500">Default game mode for new players</p>
                                </div>
                            )}
                            {has('difficulty') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Difficulty</label>
                                    <Select
                                        options={[
                                            { value: 'peaceful', label: 'Peaceful' },
                                            { value: 'easy',     label: 'Easy'     },
                                            { value: 'normal',   label: 'Normal'   },
                                            { value: 'hard',     label: 'Hard'     },
                                        ]}
                                        value={get('difficulty', 'normal')}
                                        onChange={v => set('difficulty', v)}
                                    />
                                    <p className="text-[10px] text-gray-500">Controls mob behaviour and damage</p>
                                </div>
                            )}
                            {has('max-players') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Max Players</label>
                                    <PropInput type="number" min="1" max="9999" value={get('max-players', '20')} onChange={v => set('max-players', v)} />
                                    <p className="text-[10px] text-gray-500">Maximum concurrent players</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Toggles" icon={Zap} iconColor="text-amber-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                { key: 'online-mode',    label: 'Online Mode',    desc: 'Premium / Cracked authentication', colorOn: 'emerald' },
                                { key: 'pvp',            label: 'PVP Combat',     desc: 'Player vs player damage',          colorOn: 'amber'   },
                                { key: 'hardcore',       label: 'Hardcore Mode',  desc: 'Permanent ban on death',           colorOn: 'amber'   },
                                { key: 'force-gamemode', label: 'Force Gamemode', desc: 'Reset to default mode on join',    colorOn: 'blue'    },
                            ].filter(r => has(r.key)).map(row => (
                                <div key={row.key} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-xs font-bold text-white">{row.label}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{row.desc}</p>
                                    </div>
                                    <Toggle value={get(row.key)} onChange={v => set(row.key, v)} colorOn={row.colorOn} />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* ═══════════════ TAB: NETWORK ═══════════════ */}
            {activeTab === 'network' && (
                <div className="space-y-5">
                    <SectionCard title="Server Identity & Connection" icon={Globe} iconColor="text-cyan-400">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {has('server-ip') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Bind IP</label>
                                    <PropInput value={get('server-ip')} onChange={v => set('server-ip', v)} placeholder="Leave blank for all interfaces" />
                                    <p className="text-[10px] text-gray-500">Leave empty to bind on all interfaces</p>
                                </div>
                            )}
                            {has('server-port') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Server Port</label>
                                    <PropInput type="number" min="1" max="65535" value={get('server-port', '25565')} onChange={v => set('server-port', v)} />
                                    <p className="text-[10px] text-gray-500">TCP/UDP port for player connections</p>
                                </div>
                            )}
                            {has('motd') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">MOTD</label>
                                    <PropInput value={get('motd', 'A Minecraft Server')} onChange={v => set('motd', v)} placeholder="A Minecraft Server" />
                                    <p className="text-[10px] text-gray-500">Message shown in server list</p>
                                </div>
                            )}
                            {has('network-compression-threshold') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Compression Threshold</label>
                                    <PropInput type="number" min="-1" value={get('network-compression-threshold', '256')} onChange={v => set('network-compression-threshold', v)} />
                                    <p className="text-[10px] text-gray-500">Packet compression bytes (-1 = off)</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Query & Status" icon={Radio} iconColor="text-blue-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { key: 'enable-query',         label: 'Query Protocol',   desc: 'Enables server query via UDP' },
                                { key: 'enable-status',        label: 'Status Ping',      desc: 'Respond to server list pings' },
                                { key: 'use-native-transport', label: 'Native Transport', desc: "Use Netty native IO (better perf)" },
                                { key: 'accepts-transfers',    label: 'Accept Transfers', desc: 'Allow player transfers (1.20.5+)' },
                            ].filter(r => has(r.key)).map(row => (
                                <div key={row.key} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-xs font-bold text-white">{row.label}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{row.desc}</p>
                                    </div>
                                    <Toggle value={get(row.key)} onChange={v => set(row.key, v)} colorOn="blue" />
                                </div>
                            ))}
                            {has('query.port') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Query Port</label>
                                    <PropInput type="number" min="1" max="65535" value={get('query.port', '25565')} onChange={v => set('query.port', v)} />
                                    <p className="text-[10px] text-gray-500">UDP port for query protocol</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="RCON Remote Console" icon={Terminal} iconColor="text-orange-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {has('enable-rcon') && (
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-white">Enable RCON</p>
                                        <p className="text-[10px] text-gray-500">Remote console access</p>
                                    </div>
                                    <Toggle value={get('enable-rcon')} onChange={v => set('enable-rcon', v)} colorOn="amber" />
                                </div>
                            )}
                            {has('rcon.port') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">RCON Port</label>
                                    <PropInput type="number" min="1" max="65535" value={get('rcon.port', '25575')} onChange={v => set('rcon.port', v)} />
                                </div>
                            )}
                            {has('rcon.password') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">RCON Password</label>
                                    <PropInput type="password" value={get('rcon.password')} onChange={v => set('rcon.password', v)} placeholder="Enter RCON password" />
                                </div>
                            )}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* ═══════════════ TAB: WORLD ═══════════════ */}
            {activeTab === 'world' && (
                <div className="space-y-5">
                    <SectionCard title="World Configuration" icon={Map} iconColor="text-green-400">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {has('level-name') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">World Name</label>
                                    <PropInput value={get('level-name', 'world')} onChange={v => set('level-name', v)} placeholder="world" />
                                    <p className="text-[10px] text-gray-500">Folder name of the world directory</p>
                                </div>
                            )}
                            {has('level-seed') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">World Seed</label>
                                    <PropInput value={get('level-seed')} onChange={v => set('level-seed', v)} placeholder="Random seed" />
                                    <p className="text-[10px] text-gray-500">Leave blank for a random seed</p>
                                </div>
                            )}
                            {has('level-type') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">World Type</label>
                                    <Select
                                        options={[
                                            { value: 'minecraft\\:normal',          label: 'Normal'       },
                                            { value: 'minecraft\\:flat',            label: 'Superflat'    },
                                            { value: 'minecraft\\:large_biomes',    label: 'Large Biomes' },
                                            { value: 'minecraft\\:amplified',       label: 'Amplified'    },
                                            { value: 'minecraft\\:single_biome_surface', label: 'Single Biome' },
                                        ]}
                                        value={get('level-type', 'minecraft\\:normal')}
                                        onChange={v => set('level-type', v)}
                                    />
                                </div>
                            )}
                            {has('max-world-size') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Max World Size</label>
                                    <PropInput type="number" min="1" max="29999984" value={get('max-world-size', '29999984')} onChange={v => set('max-world-size', v)} />
                                    <p className="text-[10px] text-gray-500">World border radius in blocks</p>
                                </div>
                            )}
                            {has('generator-settings') && (
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Generator Settings (JSON)</label>
                                    <PropInput value={get('generator-settings', '{}')} onChange={v => set('generator-settings', v)} placeholder="{}" />
                                    <p className="text-[10px] text-gray-500">Used for custom / superflat generation</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {has('generate-structures') && (
                        <SectionCard title="World Features" icon={Layers} iconColor="text-teal-400">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-white">Generate Structures</p>
                                        <p className="text-[10px] text-gray-500">Spawn villages, temples, etc.</p>
                                    </div>
                                    <Toggle value={get('generate-structures')} onChange={v => set('generate-structures', v)} colorOn="blue" />
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ═══════════════ TAB: PERFORMANCE ═══════════════ */}
            {activeTab === 'performance' && (
                <div className="space-y-5">
                    <SectionCard title="Render Distance" icon={Cpu} iconColor="text-blue-400">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {has('view-distance') && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">View Distance</label>
                                        <span className="text-xs font-mono text-purple-400 font-bold">{get('view-distance', '10')} chunks</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="32"
                                        value={get('view-distance', '10')}
                                        onChange={e => set('view-distance', e.target.value)}
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-gray-500">Distance clients can see (higher = more CPU / RAM)</p>
                                </div>
                            )}
                            {has('simulation-distance') && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Simulation Distance</label>
                                        <span className="text-xs font-mono text-cyan-400 font-bold">{get('simulation-distance', '10')} chunks</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="32"
                                        value={get('simulation-distance', '10')}
                                        onChange={e => set('simulation-distance', e.target.value)}
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-gray-500">Distance at which entities / redstone are ticked</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Tick & Processing" icon={Zap} iconColor="text-yellow-400">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {has('max-tick-time') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Max Tick Time (ms)</label>
                                    <PropInput type="number" min="-1" value={get('max-tick-time', '60000')} onChange={v => set('max-tick-time', v)} />
                                    <p className="text-[10px] text-gray-500">Watchdog timeout (-1 = disabled)</p>
                                </div>
                            )}
                            {has('max-chained-neighbor-updates') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Max Chained Updates</label>
                                    <PropInput type="number" value={get('max-chained-neighbor-updates', '1000000')} onChange={v => set('max-chained-neighbor-updates', v)} />
                                    <p className="text-[10px] text-gray-500">Limits cascading block update chains</p>
                                </div>
                            )}
                            {has('entity-broadcast-range-percentage') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Entity Broadcast %</label>
                                    <PropInput type="number" min="10" max="1000" value={get('entity-broadcast-range-percentage', '100')} onChange={v => set('entity-broadcast-range-percentage', v)} />
                                    <p className="text-[10px] text-gray-500">% of view distance for entity tracking</p>
                                </div>
                            )}
                            {has('pause-when-empty-seconds') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Pause When Empty (s)</label>
                                    <PropInput type="number" min="-1" value={get('pause-when-empty-seconds', '-1')} onChange={v => set('pause-when-empty-seconds', v)} />
                                    <p className="text-[10px] text-gray-500">Pause when no players online (-1 = off)</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {has('sync-chunk-writes') && (
                        <SectionCard title="I/O & Storage" icon={HardDrive} iconColor="text-orange-400">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-white">Sync Chunk Writes</p>
                                        <p className="text-[10px] text-gray-500">Synchronous chunk save I/O</p>
                                    </div>
                                    <Toggle value={get('sync-chunk-writes')} onChange={v => set('sync-chunk-writes', v)} colorOn="blue" />
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ═══════════════ TAB: PLAYERS & SECURITY ═══════════════ */}
            {activeTab === 'players' && (
                <div className="space-y-5">
                    <SectionCard title="Access & Permissions" icon={Shield} iconColor="text-purple-400">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {has('op-permission-level') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">OP Permission Level</label>
                                    <Select
                                        options={[
                                            { value: '1', label: 'Level 1 - Bypass spawn protection' },
                                            { value: '2', label: 'Level 2 - Singleplayer cheats' },
                                            { value: '3', label: 'Level 3 - Most commands' },
                                            { value: '4', label: 'Level 4 - Full OP' },
                                        ]}
                                        value={get('op-permission-level', '4')}
                                        onChange={v => set('op-permission-level', v)}
                                    />
                                    <p className="text-[10px] text-gray-500">Max power level for operators</p>
                                </div>
                            )}
                            {has('function-permission-level') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Function Permission Level</label>
                                    <PropInput type="number" min="1" max="4" value={get('function-permission-level', '2')} onChange={v => set('function-permission-level', v)} />
                                    <p className="text-[10px] text-gray-500">Permission level for data pack functions</p>
                                </div>
                            )}
                            {has('player-idle-timeout') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Idle Timeout (min)</label>
                                    <PropInput type="number" min="0" value={get('player-idle-timeout', '0')} onChange={v => set('player-idle-timeout', v)} />
                                    <p className="text-[10px] text-gray-500">Kick idle players after N min (0 = off)</p>
                                </div>
                            )}
                            {has('spawn-protection') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Spawn Protection Radius</label>
                                    <PropInput type="number" min="0" max="1000" value={get('spawn-protection', '16')} onChange={v => set('spawn-protection', v)} />
                                    <p className="text-[10px] text-gray-500">Non-OPs can't modify blocks in this radius</p>
                                </div>
                            )}
                            {has('rate-limit') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Packet Rate Limit</label>
                                    <PropInput type="number" min="0" value={get('rate-limit', '0')} onChange={v => set('rate-limit', v)} />
                                    <p className="text-[10px] text-gray-500">Max packets/s per player (0 = off)</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Security Toggles" icon={Lock} iconColor="text-red-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                { key: 'white-list',                label: 'Whitelist',              desc: 'Only allow whitelisted players',         colorOn: 'purple' },
                                { key: 'enforce-whitelist',         label: 'Enforce Whitelist',      desc: 'Kick non-whitelisted even if online',    colorOn: 'purple' },
                                { key: 'allow-flight',              label: 'Allow Flight',           desc: 'Prevent anti-cheat flight kicks',        colorOn: 'purple' },
                                { key: 'prevent-proxy-connections', label: 'Block Proxy',            desc: 'Kick VPN / proxy connections',           colorOn: 'amber'  },
                                { key: 'enforce-secure-profile',    label: 'Enforce Secure Profile', desc: 'Require signed chat (1.19+)',            colorOn: 'blue'   },
                                { key: 'log-ips',                   label: 'Log IPs',                desc: 'Log player IPs in server log',           colorOn: 'blue'   },
                                { key: 'hide-online-players',       label: 'Hide Player Count',      desc: 'Hide player list from server ping',      colorOn: 'blue'   },
                            ].filter(r => has(r.key)).map(row => (
                                <div key={row.key} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-xs font-bold text-white">{row.label}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{row.desc}</p>
                                    </div>
                                    <Toggle value={get(row.key)} onChange={v => set(row.key, v)} colorOn={row.colorOn} />
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* ═══════════════ TAB: RESOURCE PACK ═══════════════ */}
            {activeTab === 'resourcepack' && (
                <div className="space-y-5">
                    <SectionCard title="Resource Pack" icon={Package} iconColor="text-pink-400">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {has('resource-pack') && (
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Resource Pack URL</label>
                                    <PropInput value={get('resource-pack')} onChange={v => set('resource-pack', v)} placeholder="https://example.com/pack.zip" />
                                </div>
                            )}
                            {has('resource-pack-id') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Pack UUID</label>
                                    <PropInput value={get('resource-pack-id')} onChange={v => set('resource-pack-id', v)} placeholder="Pack UUID" />
                                </div>
                            )}
                            {has('resource-pack-sha1') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Pack SHA-1 Hash</label>
                                    <PropInput value={get('resource-pack-sha1')} onChange={v => set('resource-pack-sha1', v)} placeholder="40-char hex" />
                                </div>
                            )}
                            {has('resource-pack-prompt') && (
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Pack Prompt Message</label>
                                    <PropInput value={get('resource-pack-prompt')} onChange={v => set('resource-pack-prompt', v)} placeholder='{"text":"Please accept the resource pack"}' />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-5">
                            {has('require-resource-pack') && (
                                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-white">Require Pack</p>
                                        <p className="text-[10px] text-gray-500">Kick players who decline the pack</p>
                                    </div>
                                    <Toggle value={get('require-resource-pack')} onChange={v => set('require-resource-pack', v)} colorOn="amber" />
                                </div>
                            )}
                        </div>
                        {(has('initial-enabled-packs') || has('initial-disabled-packs')) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                {has('initial-enabled-packs') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Enabled Data Packs</label>
                                        <PropInput value={get('initial-enabled-packs', 'vanilla')} onChange={v => set('initial-enabled-packs', v)} />
                                        <p className="text-[10px] text-gray-500">Comma-separated list</p>
                                    </div>
                                )}
                                {has('initial-disabled-packs') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Disabled Data Packs</label>
                                        <PropInput value={get('initial-disabled-packs')} onChange={v => set('initial-disabled-packs', v)} />
                                        <p className="text-[10px] text-gray-500">Comma-separated list</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ═══════════════ TAB: ADVANCED ═══════════════ */}
            {activeTab === 'advanced' && (
                <div className="space-y-5">
                    {/* Management Server section */}
                    {TAB_KEYS.advanced.filter(k => k.startsWith('management-')).some(k => has(k)) && (
                        <SectionCard title="Management Server" icon={Server} iconColor="text-violet-400">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {has('management-server-enabled') && (
                                    <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-xs font-bold text-white">Enabled</p>
                                            <p className="text-[10px] text-gray-500">Experimental Mojang remote management</p>
                                        </div>
                                        <Toggle value={get('management-server-enabled')} onChange={v => set('management-server-enabled', v)} colorOn="purple" />
                                    </div>
                                )}
                                {has('management-server-host') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Host</label>
                                        <PropInput value={get('management-server-host', 'localhost')} onChange={v => set('management-server-host', v)} />
                                    </div>
                                )}
                                {has('management-server-port') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Port</label>
                                        <PropInput type="number" value={get('management-server-port', '0')} onChange={v => set('management-server-port', v)} />
                                    </div>
                                )}
                                {has('management-server-secret') && (
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Secret</label>
                                        <PropInput type="password" value={get('management-server-secret')} onChange={v => set('management-server-secret', v)} />
                                    </div>
                                )}
                                {has('management-server-tls-enabled') && (
                                    <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                        <div><p className="text-xs font-bold text-white">TLS Enabled</p></div>
                                        <Toggle value={get('management-server-tls-enabled')} onChange={v => set('management-server-tls-enabled', v)} colorOn="blue" />
                                    </div>
                                )}
                                {has('management-server-allowed-origins') && (
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Allowed Origins</label>
                                        <PropInput value={get('management-server-allowed-origins')} onChange={v => set('management-server-allowed-origins', v)} placeholder="*" />
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    )}

                    <SectionCard title="Logging & Debug" icon={Database} iconColor="text-gray-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                { key: 'broadcast-console-to-ops', label: 'Broadcast Console to Ops', desc: 'Send console output to op chat' },
                                { key: 'broadcast-rcon-to-ops',    label: 'Broadcast RCON to Ops',   desc: 'Send RCON commands to op chat' },
                                { key: 'debug',                    label: 'Debug Mode',              desc: 'Extra debug output in logs' },
                                { key: 'enable-jmx-monitoring',    label: 'JMX Monitoring',          desc: 'Java JMX metrics endpoint' },
                                { key: 'enable-code-of-conduct',   label: 'Code of Conduct',         desc: 'Mojang CoC enforcement' },
                            ].filter(r => has(r.key)).map(row => (
                                <div key={row.key} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-xs font-bold text-white">{row.label}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{row.desc}</p>
                                    </div>
                                    <Toggle value={get(row.key)} onChange={v => set(row.key, v)} colorOn="blue" />
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                            {has('chat-spam-threshold-seconds') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Chat Spam Threshold (s)</label>
                                    <PropInput type="number" min="0" value={get('chat-spam-threshold-seconds', '10')} onChange={v => set('chat-spam-threshold-seconds', v)} />
                                </div>
                            )}
                            {has('command-spam-threshold-seconds') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Command Spam Threshold (s)</label>
                                    <PropInput type="number" min="0" value={get('command-spam-threshold-seconds', '10')} onChange={v => set('command-spam-threshold-seconds', v)} />
                                </div>
                            )}
                            {has('status-heartbeat-interval') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Status Heartbeat Interval</label>
                                    <PropInput type="number" min="0" value={get('status-heartbeat-interval', '0')} onChange={v => set('status-heartbeat-interval', v)} />
                                </div>
                            )}
                            {has('bug-report-link') && (
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Bug Report Link</label>
                                    <PropInput value={get('bug-report-link')} onChange={v => set('bug-report-link', v)} placeholder="https://..." />
                                </div>
                            )}
                            {has('region-file-compression') && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider">Region Compression</label>
                                    <Select
                                        options={[
                                            { value: 'deflate', label: 'Deflate (default)' },
                                            { value: 'lz4',     label: 'LZ4 (faster)' },
                                            { value: 'none',    label: 'None' },
                                        ]}
                                        value={get('region-file-compression', 'deflate')}
                                        onChange={v => set('region-file-compression', v)}
                                    />
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Unknown / extra properties */}
                    {unknownProps.length > 0 && (
                        <SectionCard title={`Other Properties (${unknownProps.length})`} icon={Settings} iconColor="text-gray-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {unknownProps.map(key => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-obsidian-muted uppercase tracking-wider font-mono">{key}</label>
                                        <PropInput value={get(key)} onChange={v => set(key, v)} />
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}
        </div>
    );
};

export default GameSettings;
