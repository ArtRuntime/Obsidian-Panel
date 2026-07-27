import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const Select = ({ value, onChange, options, label, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        if (!disabled) {
            onChange(val);
            setIsOpen(false);
        }
    };

    return (
        <div className={`relative ${isOpen ? 'z-50' : ''}`} data-open={isOpen} ref={containerRef}>
            {label && <label className="block text-sm font-medium text-obsidian-muted mb-2">{label}</label>}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                    ${isOpen
                        ? 'bg-white/10 border border-purple-500/50 ring-1 ring-purple-500/30 text-white'
                        : 'bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                    }`}
            >
                <span className="truncate">{selectedOption?.label || value}</span>
                <ChevronDown size={15} className={`text-gray-500 ml-2 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1.5 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors
                                    ${option.value === value
                                        ? 'bg-purple-500/15 text-purple-300 font-medium'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className="truncate text-left">{option.label}</span>
                                {option.value === value && <Check size={14} className="flex-shrink-0 ml-2" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Select;
