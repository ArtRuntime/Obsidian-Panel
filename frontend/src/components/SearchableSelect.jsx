import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import clsx from 'clsx';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", disabled = false, inputFilter = null }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    const safeOptions = Array.isArray(options) ? options : [];
    const selectedOption = safeOptions.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        } else {
            setSearchQuery('');
        }
    }, [isOpen]);

    const filteredOptions = safeOptions.filter(opt => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (opt.label && opt.label.toLowerCase().includes(q)) ||
            (opt.value && opt.value.toString().toLowerCase().includes(q));
    });

    const handleSearchChange = (e) => {
        let newVal = e.target.value;
        if (inputFilter) {
            newVal = newVal.replace(inputFilter, '');
        }
        setSearchQuery(newVal);
    };

    const handleOptionSelect = (opt) => {
        onChange(opt.value);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${isOpen ? 'z-50' : ''}`} data-open={isOpen} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={clsx(
                    "w-full flex items-center justify-between bg-obsidian-bg border rounded-lg px-4 py-2.5 text-white transition-all focus:outline-none",
                    isOpen ? "border-obsidian-accent ring-1 ring-obsidian-accent" : "border-obsidian-border hover:border-obsidian-accent",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-2 truncate text-left text-sm font-medium">
                    <span className="truncate">{selectedOption ? selectedOption.label : (value || placeholder)}</span>
                    {selectedOption?.javaVersion && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-obsidian-muted font-mono font-normal flex-shrink-0">
                            Java {selectedOption.javaVersion}
                        </span>
                    )}
                </div>
                <ChevronDown size={16} className={clsx("text-obsidian-muted transition-transform duration-200 ml-2 flex-shrink-0", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-obsidian-surface border border-obsidian-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {/* Search Input Bar inside Dropdown */}
                    <div className="p-2 border-b border-obsidian-border/50 bg-black/20">
                        <div className="relative flex items-center">
                            <Search size={14} className="absolute left-3 text-obsidian-muted pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                placeholder="Search versions..."
                                autoComplete="off"
                                className="w-full bg-obsidian-bg border border-obsidian-border/60 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-obsidian-muted focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                    </div>

                    {/* Scrollable Options List */}
                    <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                        {searchQuery.trim() && !safeOptions.some(opt => opt.value === searchQuery.trim() || opt.label === searchQuery.trim()) && (
                            <button
                                type="button"
                                onClick={() => handleOptionSelect({ value: searchQuery.trim(), label: searchQuery.trim() })}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md bg-obsidian-accent/15 text-obsidian-accent hover:bg-obsidian-accent/25 transition-colors font-medium text-left mb-1"
                            >
                                <span className="truncate">Use custom version "{searchQuery.trim()}"</span>
                                <Check size={14} className="ml-2 flex-shrink-0" />
                            </button>
                        )}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleOptionSelect(opt)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-colors text-left font-medium group",
                                        value === opt.value
                                            ? "bg-obsidian-accent/15 text-obsidian-accent"
                                            : "text-gray-200 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="truncate">{opt.label}</span>
                                        {opt.javaVersion && (
                                            <span className={clsx(
                                                "text-[10px] px-1.5 py-0.5 rounded font-mono font-normal transition-colors flex-shrink-0",
                                                value === opt.value
                                                    ? "bg-obsidian-accent/20 text-obsidian-accent"
                                                    : "bg-white/5 text-obsidian-muted group-hover:bg-white/10 group-hover:text-gray-300"
                                            )}>
                                                Java {opt.javaVersion}
                                            </span>
                                        )}
                                    </div>
                                    {value === opt.value && <Check size={14} className="text-obsidian-accent ml-2 flex-shrink-0" />}
                                </button>
                            ))
                        ) : !searchQuery.trim() ? (
                            <div className="px-3 py-4 text-center text-xs text-obsidian-muted">
                                Loading versions...
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
