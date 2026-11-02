import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }) => {
    const modalRef = useRef(null);
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                ref={modalRef}
                className={`glass-panel w-full ${maxWidth} transform transition-all animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-all p-2 hover:bg-white/10 rounded-full hover:rotate-90 duration-300"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 text-obsidian-muted space-y-4">
                    {children}
                </div>
                {footer && (
                    <div className="p-6 pt-2 flex justify-end gap-3 bg-white/5 border-t border-white/5 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
export default Modal;
