import React, { useState, useRef, useEffect } from 'react';
import { serverApi } from '../api/server';
import {
    Moon,
    Zap,
    ShieldCheck,
    Clock,
    Copy,
    Check,
    RotateCcw,
    Eye,
    Sparkles,
    Terminal,
    Info,
    ChevronRight,
    Server,
    Wifi
} from 'lucide-react';
import clsx from 'clsx';

export const MINECRAFT_COLORS = [
    { code: '§0', name: 'Black', hex: '#000000', dark: true },
    { code: '§1', name: 'Dark Blue', hex: '#0000AA' },
    { code: '§2', name: 'Dark Green', hex: '#00AA00' },
    { code: '§3', name: 'Dark Aqua', hex: '#00AAAA' },
    { code: '§4', name: 'Dark Red', hex: '#AA0000' },
    { code: '§5', name: 'Dark Purple', hex: '#AA00AA' },
    { code: '§6', name: 'Gold', hex: '#FFAA00' },
    { code: '§7', name: 'Gray', hex: '#AAAAAA' },
    { code: '§8', name: 'Dark Gray', hex: '#555555' },
    { code: '§9', name: 'Blue', hex: '#5555FF' },
    { code: '§a', name: 'Green', hex: '#55FF55' },
    { code: '§b', name: 'Aqua', hex: '#55FFFF' },
    { code: '§c', name: 'Red', hex: '#FF5555' },
    { code: '§d', name: 'Light Purple', hex: '#FF55FF' },
    { code: '§e', name: 'Yellow', hex: '#FFFF55' },
    { code: '§f', name: 'White', hex: '#FFFFFF' },
];

export const MINECRAFT_FORMATS = [
    { code: '§l', name: 'Bold', label: 'B', className: 'font-bold' },
    { code: '§o', name: 'Italic', label: 'I', className: 'italic' },
    { code: '§n', name: 'Underline', label: 'U', className: 'underline' },
    { code: '§m', name: 'Strikethrough', label: 'S', className: 'line-through' },
    { code: '§r', name: 'Reset', label: '↺ Reset', className: '' }
];

export const parseMinecraftText = (text) => {
    if (!text) return [];
    const normalized = String(text).replace(/\\n/g, '\n');
    const lines = normalized.split('\n');

    const COLOR_MAP = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    return lines.map((line) => {
        const spans = [];
        let curColor = '#ffffff';
        let bold = false;
        let italic = false;
        let underline = false;
        let strikethrough = false;
        let buffer = '';

        const flush = () => {
            if (buffer.length > 0) {
                spans.push({
                    text: buffer,
                    color: curColor,
                    bold,
                    italic,
                    underline,
                    strikethrough
                });
                buffer = '';
            }
        };

        for (let i = 0; i < line.length; i++) {
            if ((line[i] === '§' || line[i] === '&') && i + 1 < line.length) {
                const code = line[i + 1].toLowerCase();
                if (COLOR_MAP[code]) {
                    flush();
                    curColor = COLOR_MAP[code];
                    bold = false;
                    italic = false;
                    underline = false;
                    strikethrough = false;
                    i++;
                    continue;
                } else if (code === 'l') {
                    flush();
                    bold = true;
                    i++;
                    continue;
                } else if (code === 'o') {
                    flush();
                    italic = true;
                    i++;
                    continue;
                } else if (code === 'n') {
                    flush();
                    underline = true;
                    i++;
                    continue;
                } else if (code === 'm') {
                    flush();
                    strikethrough = true;
                    i++;
                    continue;
                } else if (code === 'r') {
                    flush();
                    curColor = '#ffffff';
                    bold = false;
                    italic = false;
                    underline = false;
                    strikethrough = false;
                    i++;
                    continue;
                }
            }
            buffer += line[i];
        }
        flush();
        return spans;
    });
};

const DEFAULT_SLEEPING_MOTD = '§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦';
const DEFAULT_STARTING_MOTD = '§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!';
const DEFAULT_WAKE_KICK = '§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.';

const TIMEOUT_PRESETS = [2, 5, 10, 15, 30];

export default function SleepModeCard({
    enabled,
    setEnabled,
    timeoutMinutes,
    setTimeoutMinutes,
    sleepingMotd,
    setSleepingMotd,
    startingMotd,
    setStartingMotd,
    wakeKickMessage,
    setWakeKickMessage,
    server
}) {
    const [previewTab, setPreviewTab] = useState('sleeping'); // 'sleeping' | 'starting' | 'kick'
    const [activeField, setActiveField] = useState('sleeping'); // 'sleeping' | 'starting' | 'kick'
    const [copiedPort, setCopiedPort] = useState(false);
    const [copiedSymbol, setCopiedSymbol] = useState(false);
    const [serverIcon, setServerIcon] = useState(null);

    useEffect(() => {
        let isMounted = true;
        serverApi.getServerIcon()
            .then((res) => {
                if (isMounted && res && res.icon) {
                    setServerIcon(res.icon);
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    const sleepingTextareaRef = useRef(null);
    const startingTextareaRef = useRef(null);
    const kickTextareaRef = useRef(null);

    const getActiveRef = () => {
        if (activeField === 'sleeping') return sleepingTextareaRef.current;
        if (activeField === 'starting') return startingTextareaRef.current;
        return kickTextareaRef.current;
    };

    const insertCode = (code) => {
        const textarea = getActiveRef();
        let value = '';
        let setter = null;

        if (activeField === 'sleeping') {
            value = sleepingMotd;
            setter = setSleepingMotd;
        } else if (activeField === 'starting') {
            value = startingMotd;
            setter = setStartingMotd;
        } else {
            value = wakeKickMessage;
            setter = setWakeKickMessage;
        }

        if (textarea && typeof textarea.selectionStart === 'number') {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const updated = value.substring(0, start) + code + value.substring(end);
            setter(updated);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + code.length, start + code.length);
            }, 10);
        } else {
            setter(value + code);
        }
    };

    const handleCopyPort = () => {
        const port = String(server?.rconPort || server?.sleepMode?.rconPort || '28413');
        navigator.clipboard.writeText(port);
        setCopiedPort(true);
        setTimeout(() => setCopiedPort(false), 2000);
    };

    const handleCopySymbol = () => {
        navigator.clipboard.writeText('§');
        setCopiedSymbol(true);
        setTimeout(() => setCopiedSymbol(false), 2000);
    };

    const previewMotdText = previewTab === 'sleeping' ? sleepingMotd : startingMotd;
    const parsedMotdLines = parseMinecraftText(previewMotdText);
    const parsedKickLines = parseMinecraftText(wakeKickMessage);

    return (
        <div className={clsx(
            "glass-panel rounded-2xl border transition-all duration-300 overflow-hidden",
            enabled
                ? "border-indigo-500/30 shadow-2xl shadow-indigo-950/20 bg-gradient-to-b from-indigo-950/15 via-black/40 to-black/60"
                : "border-white/10 bg-black/30"
        )}>
            {/* TOP HEADER & SWITCH */}
            <div className="p-6 pb-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className={clsx(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                        enabled
                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-lg shadow-indigo-500/20"
                            : "bg-white/5 border-white/10 text-obsidian-muted"
                    )}>
                        <Moon size={24} className={clsx(enabled && "animate-pulse text-indigo-400")} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-lg font-bold text-white tracking-tight">Sleep Mode (Join to Start)</h2>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shadow-sm">
                                <Sparkles size={10} className="text-indigo-400" />
                                Power Saver
                            </span>
                            <span className={clsx(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-colors",
                                enabled
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-white/5 text-obsidian-muted border border-white/10"
                            )}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full", enabled ? "bg-emerald-400 animate-ping" : "bg-obsidian-muted")} />
                                {enabled ? "Active & Listening" : "Disabled"}
                            </span>
                        </div>
                        <p className="text-xs text-obsidian-muted mt-1 leading-relaxed max-w-2xl">
                            Automatically hibernates your Minecraft server to 0% CPU & RAM after idle timeout. When any player pings or joins, it instantly wakes up!
                        </p>
                    </div>
                </div>

                {/* Sleek Master Toggle Switch */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={clsx(
                            "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner",
                            enabled ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/30" : "bg-white/15"
                        )}
                        role="switch"
                        aria-checked={enabled}
                    >
                        <span
                            className={clsx(
                                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center text-indigo-700",
                                enabled ? "translate-x-7" : "translate-x-0"
                            )}
                        >
                            {enabled ? <Check size={13} className="text-indigo-600 stroke-[3]" /> : <Moon size={11} className="text-obsidian-muted" />}
                        </span>
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider text-white select-none min-w-[55px]">
                        {enabled ? <span className="text-indigo-400">Enabled</span> : <span className="text-obsidian-muted">Off</span>}
                    </span>
                </div>
            </div>

            {/* MAIN CONTENT BODY */}
            <div className={clsx("p-6 space-y-6 transition-all duration-300", !enabled && "opacity-45 pointer-events-none grayscale-[30%]")}>
                
                {/* 1. AUTHENTIC MINECRAFT LIVE PREVIEW CARD */}
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 space-y-3 shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Eye size={15} className="text-indigo-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                                Live Minecraft In-Game Preview
                            </span>
                            <span className="text-[10px] text-obsidian-muted font-medium hidden sm:inline">
                                (What players see in their client)
                            </span>
                        </div>

                        {/* Preview Mode Switcher */}
                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                            <button
                                type="button"
                                onClick={() => { setPreviewTab('sleeping'); setActiveField('sleeping'); }}
                                className={clsx(
                                    "px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5",
                                    previewTab === 'sleeping'
                                        ? "bg-indigo-600 text-white shadow-sm font-semibold"
                                        : "text-obsidian-muted hover:text-white"
                                )}
                            >
                                <Moon size={12} />
                                Sleeping MOTD
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPreviewTab('starting'); setActiveField('starting'); }}
                                className={clsx(
                                    "px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5",
                                    previewTab === 'starting'
                                        ? "bg-indigo-600 text-white shadow-sm font-semibold"
                                        : "text-obsidian-muted hover:text-white"
                                )}
                            >
                                <Zap size={12} />
                                Booting MOTD
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPreviewTab('kick'); setActiveField('kick'); }}
                                className={clsx(
                                    "px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5",
                                    previewTab === 'kick'
                                        ? "bg-indigo-600 text-white shadow-sm font-semibold"
                                        : "text-obsidian-muted hover:text-white"
                                )}
                            >
                                <ChevronRight size={12} />
                                Wake Kick Screen
                            </button>
                        </div>
                    </div>

                    {/* PREVIEW CONTAINER */}
                    {previewTab !== 'kick' ? (
                        /* Authentic Minecraft Multiplayer Server Entry */
                        <div className="p-3.5 rounded-lg bg-[#0e0f12] border border-black/80 shadow-2xl flex items-start gap-3.5 font-mono select-none">
                            {/* Server Icon */}
                            <div className="w-16 h-16 rounded bg-black/60 border border-white/10 shrink-0 overflow-hidden relative flex items-center justify-center">
                                <img
                                    src={serverIcon || (server?.type ? `/software/${server.type}.png` : '/software/vanilla.png')}
                                    alt="Minecraft Server"
                                    className="w-12 h-12 object-contain"
                                    style={{ imageRendering: 'pixelated' }}
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = '/software/vanilla.png';
                                    }}
                                />
                                {previewTab === 'sleeping' && (
                                    <div className="absolute bottom-0 inset-x-0 bg-indigo-950/80 text-[8px] text-indigo-300 font-sans font-bold text-center py-0.5 border-t border-indigo-500/40">
                                        SLEEP
                                    </div>
                                )}
                                {previewTab === 'starting' && (
                                    <div className="absolute bottom-0 inset-x-0 bg-amber-950/80 text-[8px] text-amber-300 font-sans font-bold text-center py-0.5 border-t border-amber-500/40 animate-pulse">
                                        WAKING
                                    </div>
                                )}
                            </div>

                            {/* Server Details & MOTD */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className="font-bold text-sm text-white truncate"
                                        style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.85)' }}
                                    >
                                        {server?.name || 'Obsidian Minecraft Server'}
                                    </span>

                                    {/* Minecraft Ping Bar & Player Count */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span
                                            className="text-xs font-mono font-medium"
                                            style={{ color: '#AAAAAA', textShadow: '2px 2px 0px rgba(0,0,0,0.85)' }}
                                        >
                                            {previewTab === 'sleeping' ? '0/0' : '...'}
                                        </span>
                                        {/* 5-Bar Minecraft Signal Bar */}
                                        <div className="flex items-end gap-[1.5px] h-3.5" title="Ping: 12ms">
                                            <div className="w-[2px] h-[3px] bg-[#55FF55]"></div>
                                            <div className="w-[2px] h-[6px] bg-[#55FF55]"></div>
                                            <div className="w-[2px] h-[9px] bg-[#55FF55]"></div>
                                            <div className="w-[2px] h-[12px] bg-[#55FF55]"></div>
                                            <div className="w-[2px] h-[15px] bg-[#55FF55]"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rendered 2-Line Minecraft MOTD */}
                                <div className="mt-1 space-y-0.5 text-xs sm:text-[13px] leading-snug">
                                    {parsedMotdLines.map((lineSpans, lineIdx) => (
                                        <div key={lineIdx} className="leading-normal whitespace-pre-wrap break-words">
                                            {lineSpans.length === 0 ? (
                                                <span className="opacity-0">&nbsp;</span>
                                            ) : (
                                                lineSpans.map((span, sIdx) => (
                                                    <span
                                                        key={sIdx}
                                                        style={{
                                                            color: span.color,
                                                            textShadow: '2px 2px 0px rgba(0,0,0,0.9)'
                                                        }}
                                                        className={clsx(
                                                            span.bold && 'font-bold',
                                                            span.italic && 'italic',
                                                            span.underline && 'underline',
                                                            span.strikethrough && 'line-through'
                                                        )}
                                                    >
                                                        {span.text}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Authentic Minecraft "Connection Lost" Kick Screen */
                        <div className="p-6 rounded-lg bg-[#141414] border border-black/80 shadow-2xl flex flex-col items-center justify-center text-center font-mono select-none space-y-4">
                            <span
                                className="text-base sm:text-lg font-bold text-white tracking-wide"
                                style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.9)' }}
                            >
                                Connection Lost
                            </span>

                            <div className="space-y-1 max-w-md text-xs sm:text-sm">
                                {parsedKickLines.map((lineSpans, lineIdx) => (
                                    <div key={lineIdx} className="leading-relaxed whitespace-pre-wrap break-words">
                                        {lineSpans.map((span, sIdx) => (
                                            <span
                                                key={sIdx}
                                                style={{
                                                    color: span.color,
                                                    textShadow: '2px 2px 0px rgba(0,0,0,0.9)'
                                                }}
                                                className={clsx(
                                                    span.bold && 'font-bold',
                                                    span.italic && 'italic',
                                                    span.underline && 'underline',
                                                    span.strikethrough && 'line-through'
                                                )}
                                            >
                                                {span.text}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                disabled
                                className="px-6 py-2 bg-[#333333] border-2 border-t-[#666666] border-l-[#666666] border-b-black border-r-black text-white text-xs font-bold uppercase tracking-wider cursor-default shadow-md"
                            >
                                Back to Server List
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. TIMEOUT & SILENT RCON TELEMETRY (2 COLUMN GRID) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Idle Sleep Timeout */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Clock size={14} className="text-indigo-400" />
                                Idle Sleep Timeout
                            </label>
                            <span className="text-xs font-bold text-indigo-300 font-mono">
                                {timeoutMinutes} {timeoutMinutes === 1 ? 'Minute' : 'Minutes'}
                            </span>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {TIMEOUT_PRESETS.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setTimeoutMinutes(m)}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 border",
                                        timeoutMinutes === m
                                            ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                                            : "bg-white/5 text-obsidian-muted border-white/10 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {m}m {m === 5 && '(Default)'}
                                </button>
                            ))}
                        </div>

                        {/* Numeric Stepper Input */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setTimeoutMinutes(Math.max(1, timeoutMinutes - 1))}
                                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-lg flex items-center justify-center transition-colors"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="1440"
                                value={timeoutMinutes}
                                onChange={(e) => setTimeoutMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                                className="glass-input flex-1 px-4 py-2 rounded-xl text-white font-mono text-center text-sm font-bold focus:ring-2 focus:ring-indigo-500/50"
                                placeholder="5"
                            />
                            <button
                                type="button"
                                onClick={() => setTimeoutMinutes(Math.min(1440, timeoutMinutes + 1))}
                                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-lg flex items-center justify-center transition-colors"
                            >
                                +
                            </button>
                        </div>

                        <p className="text-[11px] text-obsidian-muted leading-relaxed">
                            Automatically shuts down the Minecraft server into sleep mode once 0 players have been online for this duration.
                        </p>
                    </div>

                    {/* Minecraft Silent RCON Telemetry */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck size={15} className="text-emerald-400" />
                                Silent RCON Telemetry
                            </label>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Silent Mode
                            </span>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                                <span className="text-obsidian-muted">Console Logging:</span>
                                <span className="text-emerald-400 font-semibold font-mono text-[11px] flex items-center gap-1">
                                    <Check size={12} className="text-emerald-400" />
                                    broadcast-rcon-to-ops=false (No spam)
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                                <span className="text-obsidian-muted">RCON Port:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white font-mono font-bold">
                                        {server?.rconPort || server?.sleepMode?.rconPort || '28413 (Auto)'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyPort}
                                        title="Copy RCON Port"
                                        className="p-1 rounded hover:bg-white/10 text-obsidian-muted hover:text-white transition-colors"
                                    >
                                        {copiedPort ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                                <span className="text-obsidian-muted">Heartbeat Tracking:</span>
                                <span className="text-indigo-300 font-medium">
                                    Synced every 15s via RCON
                                </span>
                            </div>
                        </div>

                        <p className="text-[11px] text-obsidian-muted leading-relaxed">
                            Obsidian Panel silently monitors online players without cluttering your server console logs.
                        </p>
                    </div>
                </div>

                {/* 3. MINECRAFT FORMATTING & COLOR PALETTE TOOLBAR */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-amber-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                                Minecraft Color & Style Palette
                            </span>
                            <span className="text-[11px] text-obsidian-muted">
                                (Click any chip to insert into active message)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCopySymbol}
                                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white transition-colors flex items-center gap-1"
                                title="Copy § section symbol to clipboard"
                            >
                                {copiedSymbol ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                Copy <span className="text-amber-400 font-bold">§</span>
                            </button>
                        </div>
                    </div>

                    {/* Colors & Formats Bar */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {MINECRAFT_COLORS.map((c) => (
                            <button
                                key={c.code}
                                type="button"
                                onClick={() => insertCode(c.code)}
                                title={`${c.name} (${c.code})`}
                                className="h-6 px-1.5 rounded flex items-center gap-1 bg-black/50 border border-white/15 hover:border-white/50 hover:scale-105 active:scale-95 transition-all text-[11px] font-mono group"
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/40 shadow-xs"
                                    style={{ backgroundColor: c.hex }}
                                />
                                <span className="text-white/80 group-hover:text-white font-semibold">
                                    {c.code}
                                </span>
                            </button>
                        ))}

                        <div className="h-5 w-[1px] bg-white/15 mx-1" />

                        {MINECRAFT_FORMATS.map((f) => (
                            <button
                                key={f.code}
                                type="button"
                                onClick={() => insertCode(f.code)}
                                title={`${f.name} (${f.code})`}
                                className={clsx(
                                    "h-6 px-2 rounded bg-black/50 border border-white/15 hover:border-white/50 hover:scale-105 active:scale-95 transition-all text-xs font-mono font-bold text-white",
                                    f.className
                                )}
                            >
                                {f.code} <span className="text-[10px] text-obsidian-muted font-normal">({f.label})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. MOTD & MESSAGE EDITORS */}
                <div className="space-y-4 pt-1">
                    {/* SLEEPING MOTD */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all duration-200 space-y-2",
                        activeField === 'sleeping' ? "border-indigo-500/50 bg-indigo-950/10" : "border-white/10 bg-white/5"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <Moon size={13} className="text-indigo-400" />
                                    Sleeping MOTD (Server List Description)
                                </label>
                                <span className="text-[10px] text-obsidian-muted hidden sm:inline">
                                    Shown when server is asleep
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSleepingMotd(DEFAULT_SLEEPING_MOTD)}
                                className="text-[11px] text-obsidian-muted hover:text-white flex items-center gap-1 transition-colors"
                                title="Reset to default sleeping MOTD"
                            >
                                <RotateCcw size={11} />
                                Reset Default
                            </button>
                        </div>
                        <textarea
                            ref={sleepingTextareaRef}
                            rows={2}
                            value={sleepingMotd}
                            onFocus={() => { setActiveField('sleeping'); setPreviewTab('sleeping'); }}
                            onChange={(e) => setSleepingMotd(e.target.value)}
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 resize-none"
                            placeholder={DEFAULT_SLEEPING_MOTD}
                        />
                        <div className="flex items-center justify-between text-[11px] text-obsidian-muted">
                            <span>Tip: Keep within 2 lines of ~45 characters for the best appearance in Minecraft client.</span>
                            <span>{sleepingMotd.split('\n').length} / 2 lines</span>
                        </div>
                    </div>

                    {/* STARTING MOTD */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all duration-200 space-y-2",
                        activeField === 'starting' ? "border-indigo-500/50 bg-indigo-950/10" : "border-white/10 bg-white/5"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap size={13} className="text-amber-400" />
                                    Starting MOTD (Booting Description)
                                </label>
                                <span className="text-[10px] text-obsidian-muted hidden sm:inline">
                                    Shown while server is waking up (~20-40s)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStartingMotd(DEFAULT_STARTING_MOTD)}
                                className="text-[11px] text-obsidian-muted hover:text-white flex items-center gap-1 transition-colors"
                                title="Reset to default starting MOTD"
                            >
                                <RotateCcw size={11} />
                                Reset Default
                            </button>
                        </div>
                        <textarea
                            ref={startingTextareaRef}
                            rows={2}
                            value={startingMotd}
                            onFocus={() => { setActiveField('starting'); setPreviewTab('starting'); }}
                            onChange={(e) => setStartingMotd(e.target.value)}
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 resize-none"
                            placeholder={DEFAULT_STARTING_MOTD}
                        />
                        <div className="flex items-center justify-between text-[11px] text-obsidian-muted">
                            <span>Shown to players refreshing server list while boot is in progress.</span>
                            <span>{startingMotd.split('\n').length} / 2 lines</span>
                        </div>
                    </div>

                    {/* WAKE KICK MESSAGE */}
                    <div className={clsx(
                        "p-4 rounded-xl border transition-all duration-200 space-y-2",
                        activeField === 'kick' ? "border-indigo-500/50 bg-indigo-950/10" : "border-white/10 bg-white/5"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <ChevronRight size={13} className="text-emerald-400" />
                                    Join-to-Wake Disconnect Screen Message
                                </label>
                                <span className="text-[10px] text-obsidian-muted hidden sm:inline">
                                    Presented to the player who initiated server wake-up
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWakeKickMessage(DEFAULT_WAKE_KICK)}
                                className="text-[11px] text-obsidian-muted hover:text-white flex items-center gap-1 transition-colors"
                                title="Reset to default wake message"
                            >
                                <RotateCcw size={11} />
                                Reset Default
                            </button>
                        </div>
                        <textarea
                            ref={kickTextareaRef}
                            rows={2}
                            value={wakeKickMessage}
                            onFocus={() => { setActiveField('kick'); setPreviewTab('kick'); }}
                            onChange={(e) => setWakeKickMessage(e.target.value)}
                            className="glass-input w-full px-4 py-2.5 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 resize-none"
                            placeholder={DEFAULT_WAKE_KICK}
                        />
                        <div className="flex items-center justify-between text-[11px] text-obsidian-muted">
                            <span>Tells the connecting player that their join has started the server and to rejoin shortly.</span>
                            <span>{wakeKickMessage.split('\n').length} / 2 lines</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
