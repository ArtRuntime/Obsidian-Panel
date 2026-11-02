import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { serverApi } from '../api/server';
import {
    Folder, FileText, ChevronRight, Home, Download, Trash2, FileCode, FileJson,
    FileImage, Upload, Save, X, Archive, CheckSquare, Check, FolderPlus, RefreshCw,
    ArrowLeft, Loader2, FolderOpen, Edit2, Globe, Eye, EyeOff, Copy, FolderInput,
    ExternalLink, Package, List, LayoutGrid, Puzzle, Cpu, Flame, Moon, Sliders,
    Terminal, HardDrive, Layers, Palette, Compass, ArrowUpCircle, Sparkles, Wrench
} from 'lucide-react';
import clsx from 'clsx';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const JarToggleSwitch = ({ file, onToggle, isToggling }) => {
    const isEnabled = file.pluginInfo ? file.pluginInfo.enabled : !file.name.toLowerCase().endsWith('.disabled');
    return (
        <button
            type="button"
            disabled={isToggling}
            onClick={(e) => onToggle(file, e)}
            className={clsx(
                "w-10 h-5.5 rounded-full p-0.5 transition-colors relative inline-flex items-center shrink-0 cursor-pointer focus:outline-none",
                isEnabled ? "bg-[#E5A93C]" : "bg-white/20 hover:bg-white/30",
                isToggling && "opacity-60 cursor-wait"
            )}
            title={isEnabled ? "Enabled (click to disable)" : "Disabled (click to enable)"}
        >
            <span
                className={clsx(
                    "w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 block",
                    isEnabled ? "translate-x-4.5" : "translate-x-0.5"
                )}
            />
        </button>
    );
};

const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('obsidian_files_view_mode') || 'list');
    const [togglingJars, setTogglingJars] = useState(new Set());
    const [updatingFiles, setUpdatingFiles] = useState(new Set());
    const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorFile, setEditorFile] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [isCopyDrag, setIsCopyDrag] = useState(false);

    // Rename State
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [itemToRename, setItemToRename] = useState(null);
    const [renameName, setRenameName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('0 B/s');

    // Remote cURL Download State
    const [isRemoteDownloadOpen, setIsRemoteDownloadOpen] = useState(false);
    const [remoteUrl, setRemoteUrl] = useState('');
    const [remoteFilename, setRemoteFilename] = useState('');
    const [remoteHeaders, setRemoteHeaders] = useState('');
    const [isDownloadingRemote, setIsDownloadingRemote] = useState(false);

    // Archive password state
    const [extractTarget, setExtractTarget] = useState(null); // file being extracted
    const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
    const [extractPassword, setExtractPassword] = useState('');
    const [showExtractPassword, setShowExtractPassword] = useState(false);
    const [compressPassword, setCompressPassword] = useState('');
    const [showCompressPassword, setShowCompressPassword] = useState(false);

    // Copy / Move Modal State
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [itemToCopy, setItemToCopy] = useState(null);
    const [copyTargetFolder, setCopyTargetFolder] = useState('.');
    const [copyNewName, setCopyNewName] = useState('');
    const [isCopying, setIsCopying] = useState(false);

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [itemToMove, setItemToMove] = useState(null);
    const [moveTargetFolder, setMoveTargetFolder] = useState('.');
    const [isMoving, setIsMoving] = useState(false);

    // Prevent page refresh during upload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (uploading) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [uploading]);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await serverApi.getFiles(currentPath);
            setFiles(data);
        } catch (err) {
            console.error(err);
            showToast('Failed to load files', 'error');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [currentPath, showToast]);

    useEffect(() => {
        loadFiles();
        setSelectedFiles(new Set());
    }, [loadFiles]);

    const _navigateTo = (path) => {
        if (path === '/') {
            setCurrentPath([]);
        } else {
            const parts = path.split('/').filter(Boolean);
            setCurrentPath(parts);
        }
    };

    const handleNavigate = (folderName) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleGoUp = () => {
        if (currentPath.length > 0) {
            setCurrentPath(currentPath.slice(0, -1));
        }
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            setCurrentPath([]);
        } else {
            setCurrentPath(currentPath.slice(0, index + 1));
        }
    };

    const handleExtract = (file) => {
        setExtractTarget(file);
        setExtractPassword('');
        setShowExtractPassword(false);
        setIsExtractModalOpen(true);
    };

    const handleExtractConfirm = async () => {
        if (!extractTarget) return;
        setIsExtractModalOpen(false);
        setLoading(true);
        try {
            await serverApi.extractFile(currentPath, extractTarget.name, extractPassword || undefined);
            showToast(`Extracted ${extractTarget.name}`, 'success');
            await loadFiles();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
            setExtractTarget(null);
            setExtractPassword('');
        }
    };

    const getLanguage = (fileName) => {
        if (!fileName) return 'plaintext';
        const ext = fileName.split('.').pop().toLowerCase();
        if (fileName.startsWith('.') && fileName.split('.').length === 2) return 'ini';

        switch (ext) {
            case 'json': return 'json';
            case 'js': case 'jsx': return 'javascript';
            case 'ts': case 'tsx': return 'typescript';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'yml': case 'yaml': return 'yaml';
            case 'xml': return 'xml';
            case 'md': return 'markdown';
            case 'properties': case 'ini': case 'env': case 'conf': case 'config': return 'ini';
            case 'sql': return 'sql';
            case 'py': return 'python';
            case 'sh': return 'shell';
            case 'java': return 'java';
            case 'log': return 'plaintext';
            default: return 'plaintext';
        }
    };

    const isJarFile = (name) => {
        if (!name) return false;
        const lower = name.toLowerCase();
        return lower.endsWith('.jar') || lower.endsWith('.jar.disabled');
    };

    const isJarEnabled = (file) => {
        if (file.pluginInfo && typeof file.pluginInfo.enabled === 'boolean') {
            return file.pluginInfo.enabled;
        }
        return !file.name.toLowerCase().endsWith('.disabled');
    };

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem('obsidian_files_view_mode', mode);
    };

    const handleToggleJar = async (file, e) => {
        if (e) e.stopPropagation();
        if (togglingJars.has(file.name)) return;

        setTogglingJars(prev => new Set(prev).add(file.name));
        try {
            const res = await serverApi.toggleJar(currentPath, file.name);
            showToast(
                `${file.pluginInfo?.title || file.name} ${res.enabled ? 'enabled' : 'disabled'}`,
                'success'
            );
            await loadFiles();
        } catch (err) {
            showToast(err.message || 'Failed to toggle jar', 'error');
        } finally {
            setTogglingJars(prev => {
                const next = new Set(prev);
                next.delete(file.name);
                return next;
            });
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';

            const now = new Date();
            const diffMs = now - d;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 1) return '1 day ago';
            if (diffDays > 1 && diffDays < 4) return `${diffDays} days ago`;

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[d.getMonth()];
            const day = d.getDate();
            const year = d.getFullYear();
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12 || 12;

            const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                (day === 2 || day === 22) ? 'nd' :
                (day === 3 || day === 23) ? 'rd' : 'th';

            return `${month} ${day}${suffix}, ${year} ${hours}:${minutes}${ampm}`;
        } catch {
            return '-';
        }
    };

    const getFolderIcon = (name, size = 18) => {
        const n = (name || '').toLowerCase();

        // Plugins (utility puzzle icon)
        if (n === 'plugins' || n === 'plugin') {
            return <Puzzle size={size} className="text-emerald-400 fill-emerald-400/20" />;
        }

        // Mods (cpu / modding icon)
        if (n === 'mods' || n === 'mod') {
            return <Cpu size={size} className="text-purple-400 fill-purple-400/20" />;
        }

        // Nether dimension
        if (n === 'world_nether' || n === 'dim-1' || n.includes('nether')) {
            return <Flame size={size} className="text-rose-500 fill-rose-500/20" />;
        }

        // The End dimension
        if (n === 'world_the_end' || n === 'dim1' || n.includes('the_end') || n.includes('the-end') || n === 'end') {
            return <Moon size={size} className="text-violet-400 fill-violet-400/20" />;
        }

        // Overworld / World / Dimensions
        if (n === 'world' || n === 'world_overworld' || n.endsWith('_world') || n.includes('overworld')) {
            return <Globe size={size} className="text-cyan-400 fill-cyan-400/20" />;
        }

        // Configs & settings
        if (n === 'config' || n === 'configs' || n === 'defaultconfigs') {
            return <Sliders size={size} className="text-sky-400 fill-sky-400/20" />;
        }

        // Logs & crash reports
        if (n === 'logs' || n === 'crash-reports' || n === 'debug') {
            return <Terminal size={size} className="text-amber-400 fill-amber-400/20" />;
        }

        // Backups
        if (n === 'backups' || n === 'backup') {
            return <HardDrive size={size} className="text-teal-400 fill-teal-400/20" />;
        }

        // Libraries & versions
        if (n === 'libraries' || n === 'versions' || n === 'bundler') {
            return <Layers size={size} className="text-indigo-400 fill-indigo-400/20" />;
        }

        // Resource packs & data packs
        if (n === 'datapacks' || n === 'resourcepacks' || n === 'packs') {
            return <Palette size={size} className="text-pink-400 fill-pink-400/20" />;
        }

        // Schematics & blueprints
        if (n === 'schematics' || n === 'blueprints') {
            return <Compass size={size} className="text-yellow-400 fill-yellow-400/20" />;
        }

        // Default folder fallback
        return <Folder size={size} className="text-amber-400 fill-amber-400/20" />;
    };

    const getFolderContainerClass = (name) => {
        const n = (name || '').toLowerCase();
        if (n === 'plugins' || n === 'plugin') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
        if (n === 'mods' || n === 'mod') return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
        if (n === 'world_nether' || n === 'dim-1' || n.includes('nether')) return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
        if (n === 'world_the_end' || n === 'dim1' || n.includes('the_end') || n.includes('the-end') || n === 'end') return 'bg-violet-500/10 border-violet-500/30 text-violet-400';
        if (n === 'world' || n === 'world_overworld' || n.endsWith('_world') || n.includes('overworld')) return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
        if (n === 'config' || n === 'configs' || n === 'defaultconfigs') return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
        if (n === 'logs' || n === 'crash-reports' || n === 'debug') return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
        if (n === 'backups' || n === 'backup') return 'bg-teal-500/10 border-teal-500/30 text-teal-400';
        if (n === 'libraries' || n === 'versions' || n === 'bundler') return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
        if (n === 'datapacks' || n === 'resourcepacks' || n === 'packs') return 'bg-pink-500/10 border-pink-500/30 text-pink-400';
        if (n === 'schematics' || n === 'blueprints') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    };

    const getFileIcon = (name, type, pluginInfo = null, size = 18) => {
        if (type === 'folder') return getFolderIcon(name, size);
        if (pluginInfo?.iconUrl) {
            return (
                <img
                    src={pluginInfo.iconUrl}
                    alt={pluginInfo.title || name}
                    className="w-full h-full object-contain rounded-md"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                    }}
                />
            );
        }
        const lower = name.toLowerCase();
        if (lower.endsWith('.jar') || lower.endsWith('.jar.disabled')) {
            return <Package className="text-amber-400" size={size} />;
        }
        if (lower.endsWith('.json')) return <FileJson className="text-yellow-400" size={size} />;
        if (lower.endsWith('.zip') || lower.endsWith('.tar.gz')) return <Archive className="text-orange-400" size={size} />;
        if (lower.endsWith('.log') || lower.endsWith('.txt')) return <FileText className="text-gray-400" size={size} />;
        if (lower.endsWith('.properties') || lower.endsWith('.yml') || lower.endsWith('.yaml')) return <FileCode className="text-blue-400" size={size} />;
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return <FileImage className="text-purple-400" size={size} />;
        return <FileText className="text-gray-400" size={size} />;
    };

    const handleUpdateJar = async (file) => {
        if (!file || !file.pluginInfo?.latestDownloadUrl) {
            showToast('No update download link available for this item', 'error');
            return;
        }
        setUpdatingFiles(prev => new Set(prev).add(file.name));
        try {
            const res = await serverApi.updatePluginJar(
                currentPath,
                file.name,
                file.pluginInfo.latestDownloadUrl,
                file.pluginInfo.latestFileName
            );
            showToast(`Updated ${file.pluginInfo?.title || file.name} to ${file.pluginInfo?.latestVersion || 'latest version'}! Restart server to apply.`, 'success');
            await loadFiles();
        } catch (err) {
            console.error('Update jar error:', err);
            showToast(err.message || 'Failed to update plugin', 'error');
        } finally {
            setUpdatingFiles(prev => {
                const next = new Set(prev);
                next.delete(file.name);
                return next;
            });
        }
    };

    // ... File Operations (Create, Delete, Upload etc) ...
    const handleCreateFolder = async () => {
        if (!newItemName) return;
        setLoading(true);
        try {
            await serverApi.createFile(currentPath, newItemName, 'folder');
            await loadFiles();
            showToast(`Folder "${newItemName}" created`, 'success');
            setIsCreateFolderOpen(false);
            setNewItemName('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFile = async () => {
        if (!newItemName) return;
        setLoading(true);
        try {
            await serverApi.createFile(currentPath, newItemName, 'file');
            await loadFiles();
            showToast(`File "${newItemName}" created`, 'success');
            setIsCreateFileOpen(false);
            setNewItemName('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (itemName) => { // Changed to take argument for direct call
        const target = itemName || itemToDelete;
        if (!target) return;
        setLoading(true);
        try {
            await serverApi.deleteFile(currentPath, target);
            await loadFiles();
            showToast(`${target} deleted`, 'success');
            setIsDeleteOpen(false);
            setItemToDelete(null);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async () => {
        if (!itemToRename || !renameName) return;
        setLoading(true);
        try {
            await serverApi.renameFile(currentPath, itemToRename, renameName);
            await loadFiles();
            showToast(`Renamed to "${renameName}"`, 'success');
            setIsRenameOpen(false);
            setItemToRename(null);
            setRenameName('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const openRenameModal = (name) => {
        setItemToRename(name);
        setRenameName(name);
        setIsRenameOpen(true);
    };

    const confirmDelete = (name) => {
        setItemToDelete(name);
        setIsDeleteOpen(true);
    };

    const openCopyModal = (name) => {
        setItemToCopy(name);
        setCopyTargetFolder('.');
        const parsed = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) + '_copy' + name.substring(name.lastIndexOf('.')) : name + '_copy';
        setCopyNewName(parsed);
        setIsCopyModalOpen(true);
    };

    const handleCopyConfirm = async () => {
        if (!itemToCopy) return;
        setIsCopying(true);
        try {
            const target = copyTargetFolder.trim() || '.';
            const newName = copyNewName.trim();
            const res = await serverApi.copyFile(currentPath, itemToCopy, target, newName);
            showToast(res.message || `Copied "${itemToCopy}" successfully`, 'success');
            setIsCopyModalOpen(false);
            setItemToCopy(null);
            await loadFiles();
        } catch (err) {
            showToast(err.message || 'Failed to copy item', 'error');
        } finally {
            setIsCopying(false);
        }
    };

    const openMoveModal = (name) => {
        setItemToMove(name);
        setMoveTargetFolder('.');
        setIsMoveModalOpen(true);
    };

    const handleMoveConfirm = async () => {
        if (!itemToMove) return;
        setIsMoving(true);
        try {
            const target = moveTargetFolder.trim() || '.';
            await serverApi.moveFile(currentPath, itemToMove, target);
            showToast(`Moved "${itemToMove}" to "${target}"`, 'success');
            setIsMoveModalOpen(false);
            setItemToMove(null);
            await loadFiles();
        } catch (err) {
            showToast(err.message || 'Failed to move item', 'error');
        } finally {
            setIsMoving(false);
        }
    };

    const handleRemoteDownload = async () => {
        if (!remoteUrl || !remoteUrl.trim().startsWith('http')) {
            showToast('Please enter a valid HTTP/HTTPS URL', 'error');
            return;
        }
        setIsDownloadingRemote(true);
        try {
            const res = await serverApi.downloadRemoteFile(currentPath, remoteUrl, remoteFilename, remoteHeaders);
            showToast(res.message || 'File downloaded successfully!', 'success');
            setIsRemoteDownloadOpen(false);
            setRemoteUrl('');
            setRemoteFilename('');
            setRemoteHeaders('');
            await loadFiles();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Remote download failed', 'error');
        } finally {
            setIsDownloadingRemote(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadProgress(0);
        setUploadSpeed('0 B/s');
        try {
            await serverApi.uploadFileChunked(currentPath, file, (progress, speed) => {
                setUploadProgress(progress);
                if (speed) setUploadSpeed(speed);
            });
            showToast('File uploaded successfully', 'success');
            await loadFiles();
        } catch (err) {
            console.error(err);
            showToast('Upload failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileClick = async (file) => {
        if (file.type === 'folder') {
            handleNavigate(file.name);
            return;
        }
        const isEditable = /\.(txt|log|properties|json|yml|yaml|md|js|xml|sh|env|conf)$/i.test(file.name);
        if (!isEditable) {
            showToast('This file type is not editable', 'error');
            return;
        }
        setLoading(true);
        try {
            const path = [...currentPath, file.name];
            const data = await serverApi.readFile(path);
            setEditorFile({ name: file.name, path });
            setEditorContent(data.content);
            setIsEditorOpen(true);
        } catch (err) {
            showToast('Failed to read file: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFile = useCallback(async () => {
        if (!editorFile) return;
        setIsSaving(true);
        try {
            await serverApi.saveFile(editorFile.path, editorContent);
            showToast('File saved successfully', 'success');
            setIsEditorOpen(false);
            setEditorFile(null);
            loadFiles();
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [editorFile, editorContent, loadFiles, showToast]);

    // Keyboard shortcut: Ctrl+S / Cmd+S to save currently open file in editor
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                if (isEditorOpen && editorFile) {
                    e.preventDefault();
                    handleSaveFile();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditorOpen, editorFile, handleSaveFile]);

    const handleDropItem = async (sourceName, targetFolder, isCopy = false) => {
        if (!sourceName || !targetFolder) return;
        if (!isCopy && sourceName === targetFolder) return;
        setLoading(true);
        try {
            const destLabel = targetFolder === '..' ? 'parent directory' : `"${targetFolder}"`;
            if (isCopy) {
                const res = await serverApi.copyFile(currentPath, sourceName, targetFolder);
                showToast(res.message || `Copied "${sourceName}" to ${destLabel}`, 'success');
            } else {
                await serverApi.moveFile(currentPath, sourceName, targetFolder);
                showToast(`Moved "${sourceName}" to ${destLabel}`, 'success');
            }
            await loadFiles();
        } catch (err) {
            showToast(err.message || `Failed to ${isCopy ? 'copy' : 'move'} file`, 'error');
        } finally {
            setLoading(false);
            setDraggedItem(null);
            setDragOverFolder(null);
            setIsCopyDrag(false);
        }
    };

    const toggleSelectMode = () => {
        setIsSelectMode(prev => {
            if (prev) setSelectedFiles(new Set());
            return !prev;
        });
    };

    const handleSelect = (file, e) => {
        e.stopPropagation();
        const newSet = new Set(selectedFiles);
        if (newSet.has(file.name)) {
            newSet.delete(file.name);
        } else {
            newSet.add(file.name);
        }
        setSelectedFiles(newSet);
    };

    const handleCompress = async () => {
        if (selectedFiles.size === 0) return;
        setLoading(true);
        try {
            await serverApi.compressFiles(currentPath, Array.from(selectedFiles), compressPassword || undefined);
            showToast('Files compressed successfully', 'success');
            setSelectedFiles(new Set());
            setIsSelectMode(false);
            setCompressPassword('');
            await loadFiles();
        } catch (err) {
            showToast('Compression failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = () => {
        if (selectedFiles.size === 0) return;
        setIsBulkDeleteOpen(true);
    };

    const executeBulkDelete = async () => {
        setIsBulkDeleteOpen(false);
        setLoading(true);
        try {
            const items = Array.from(selectedFiles);
            const res = await serverApi.deleteFiles(currentPath, items);
            if (res.successCount > 0) showToast(`Deleted ${res.successCount} items`, 'success');
            if (res.failCount > 0) showToast(`Failed to delete ${res.failCount} items`, 'error');
        } catch (err) {
            console.error('Bulk delete error:', err);
            showToast('Failed to delete items: ' + err.message, 'error');
        } finally {
            setSelectedFiles(new Set());
            setIsSelectMode(false);
            await loadFiles();
            setLoading(false);
        }
    };

    const handleDownload = async (file) => {
        setLoading(true);
        try {
            const blob = await serverApi.downloadFile(currentPath, file.name);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast(`Downloaded ${file.name}`, 'success');
        } catch (err) {
            showToast('Download failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === undefined || bytes === null) return '-';
        // If it's already a formatted string (from backend), return it
        if (typeof bytes === 'string' && isNaN(Number(bytes))) return bytes;

        const numBytes = Number(bytes);
        if (isNaN(numBytes)) return '-';
        if (numBytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(numBytes) / Math.log(k));
        return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Drag and Drop for External File Uploads
    const handleDragOver = (e) => {
        // Do not trigger external upload overlay if user is dragging an internal item to move it
        if (draggedItem) return;
        const types = e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
        if (!types.includes('Files')) return;
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        // Prevent backdrop flicker when hovering over child elements
        if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        if (draggedItem) return;
        const types = e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
        if (!types.includes('Files')) return;
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) return;
        setUploading(true);
        setUploadProgress(0);
        setUploadSpeed('0 B/s');
        let successCount = 0;
        let failCount = 0;

        // Note: For multi-file drag-drop, total progress is hard to estimate with single bar
        // We will show progress for the *currently uploading field* or just generic loading
        // For simplicity in this implementation, we'll process sequentially and show progress for each

        for (const file of files) {
            try {
                // Reset progress for each file
                setUploadProgress(0);
                setUploadSpeed('0 B/s');
                await serverApi.uploadFileChunked(currentPath, file, (progress, speed) => {
                    setUploadProgress(progress);
                    if (speed) setUploadSpeed(speed);
                });
                successCount++;
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }
        if (successCount > 0) showToast(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`, 'success');
        if (failCount > 0) showToast(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`, 'error');
        await loadFiles();
        setUploading(false);
        setUploadProgress(0);
    };

    const handleSelectAll = () => {
        if (selectedFiles.size === files.length) {
            setSelectedFiles(new Set());
        } else {
            const allFileNames = new Set(files.map(f => f.name));
            setSelectedFiles(allFileNames);
        }
    };

    return (
        <div className="glass-panel rounded-2xl p-0 overflow-hidden shadow-2xl animate-fade-in flex flex-col h-[calc(100vh-8rem)] relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-obsidian-accent/20 backdrop-blur-sm border-2 border-dashed border-obsidian-accent flex items-center justify-center pointer-events-none">
                    <div className="text-center text-obsidian-accent animate-pulse">
                        <Upload size={48} className="mx-auto mb-2" />
                        <h3 className="text-xl font-bold">Drop files to upload</h3>
                    </div>
                </div>
            )}


            {/* Toolbar */}

            {/* Top Bar */}
            <div className="p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 backdrop-blur-md z-10">
                <div className="flex items-center space-x-3 overflow-hidden w-full md:w-auto">
                    <button
                        onClick={handleGoUp}
                        disabled={currentPath.length === 0}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center space-x-2 text-sm text-obsidian-muted overflow-x-auto custom-scrollbar whitespace-nowrap mask-linear-fade">
                        <FolderOpen size={16} className="shrink-0" />
                        <span className="font-mono text-white/70">root</span>
                        {currentPath.map((part, i) => (
                            <React.Fragment key={i}>
                                <ChevronRight size={14} className="shrink-0 text-white/30" />
                                <span
                                    className={`cursor-pointer hover:text-white transition-colors ${i === currentPath.length - 1 ? 'text-white font-bold' : ''}`}
                                    onClick={() => handleBreadcrumbClick(i)}
                                >
                                    {part}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    {selectedFiles.size > 0 && (
                        <>
                            <div className="relative flex items-center">
                                <input
                                    type={showCompressPassword ? 'text' : 'password'}
                                    value={compressPassword}
                                    onChange={(e) => setCompressPassword(e.target.value)}
                                    placeholder="Encrypt password (optional)"
                                    className="glass-input text-xs px-3 py-1.5 rounded-lg font-mono w-44 pr-8 focus:ring-1 focus:ring-obsidian-accent/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCompressPassword(p => !p)}
                                    className="absolute right-2 text-obsidian-muted hover:text-white"
                                    title={showCompressPassword ? 'Hide' : 'Show'}
                                >
                                    {showCompressPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                            <button
                                onClick={handleCompress}
                                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg flex items-center text-sm border border-blue-500/20 whitespace-nowrap"
                            >
                                <Archive size={16} className="md:mr-2" />
                                <span className="hidden md:inline">Compress</span>
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg flex items-center text-sm border border-red-500/20 whitespace-nowrap"
                            >
                                <Trash2 size={16} className="md:mr-2" />
                                <span className="hidden md:inline">Delete ({selectedFiles.size})</span>
                            </button>
                        </>
                    )}
                    {isSelectMode && (
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center whitespace-nowrap"
                        >
                            <CheckSquare size={16} className="md:mr-2 opacity-70" />
                            <span className="hidden md:inline">{selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}</span>
                        </button>
                    )}
                    <button
                        onClick={toggleSelectMode}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center whitespace-nowrap",
                            isSelectMode ? "bg-obsidian-accent text-white border-obsidian-accent" : "bg-white/5 hover:bg-white/10 text-white border-white/10"
                        )}
                    >
                        {isSelectMode ? <Check size={16} className="md:mr-2" /> : <CheckSquare size={16} className="md:mr-2" />}
                        <span className="hidden md:inline">{isSelectMode ? 'Done' : 'Select'}</span>
                    </button>
                    <button
                        onClick={() => document.getElementById('file-upload').click()}
                        disabled={uploading}
                        className="glass-button px-4 py-2 rounded-lg flex items-center text-sm whitespace-nowrap overflow-hidden relative"
                    >
                        {uploading && (
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-obsidian-accent/20 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        )}
                        <Upload size={16} className="md:mr-2 z-10" />
                        <span className={`z-10 ${uploading ? 'inline' : 'hidden md:inline'}`}>
                            {uploading ? (
                                <span className="md:hidden">{uploadProgress}% ({uploadSpeed})</span>
                            ) : null}
                            <span className="hidden md:inline">
                                {uploading ? `Uploading ${uploadProgress}% (${uploadSpeed})...` : 'Upload'}
                            </span>
                            {!uploading && <span className="md:hidden">Upload</span>}
                        </span>
                    </button>
                    <input
                        type="file"
                        id="file-upload"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                        ref={fileInputRef}
                    />
                    <button
                        onClick={() => setIsRemoteDownloadOpen(true)}
                        disabled={isDownloadingRemote}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors flex items-center text-sm font-medium whitespace-nowrap disabled:opacity-50"
                        title="cURL Remote File Download"
                    >
                        {isDownloadingRemote ? (
                            <Loader2 size={16} className="animate-spin md:mr-2" />
                        ) : (
                            <Globe size={16} className="md:mr-2 text-obsidian-accent" />
                        )}
                        <span className="hidden md:inline">
                            {isDownloadingRemote ? 'Downloading...' : 'Remote URL'}
                        </span>
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <button
                        onClick={() => setIsCreateFolderOpen(true)}
                        className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors border border-transparent hover:border-white/10"
                        title="New Folder"
                    >
                        <FolderPlus size={18} />
                    </button>
                    <button
                        onClick={() => setIsCreateFileOpen(true)}
                        className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors border border-transparent hover:border-white/10"
                        title="New File"
                    >
                        <FileText size={18} />
                    </button>
                    <button
                        onClick={loadFiles}
                        className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors border border-transparent hover:border-white/10"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-1"></div>
                    <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                        <button
                            onClick={() => handleViewModeChange('list')}
                            className={clsx(
                                "p-1.5 rounded-md transition-colors",
                                viewMode === 'list' ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                            )}
                            title="List View"
                        >
                            <List size={16} />
                        </button>
                        <button
                            onClick={() => handleViewModeChange('grid')}
                            className={clsx(
                                "p-1.5 rounded-md transition-colors",
                                viewMode === 'grid' ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                            )}
                            title="Grid View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                        <Loader2 className="w-8 h-8 text-obsidian-accent animate-spin" />
                    </div>
                )}

                {viewMode === 'list' ? (
                    <div className="w-full">
                        <table className="w-full text-left text-sm text-obsidian-muted relative z-0">
                            <thead className="text-xs text-obsidian-muted uppercase border-b border-white/5 bg-white/[0.02] sticky top-0 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="py-3 px-4 w-12 text-center">
                                        <button
                                            type="button"
                                            onClick={handleSelectAll}
                                            className={clsx(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto",
                                                selectedFiles.size === files.length && files.length > 0
                                                    ? "bg-obsidian-accent border-obsidian-accent text-white"
                                                    : "border-white/20 bg-white/5 hover:border-white/40"
                                            )}
                                            title={selectedFiles.size === files.length ? "Deselect all" : "Select all"}
                                        >
                                            {selectedFiles.size === files.length && files.length > 0 && <Check size={11} strokeWidth={3} />}
                                        </button>
                                    </th>
                                    <th className="py-3 px-4 font-medium">Name</th>
                                    <th className="py-3 px-4 font-medium hidden sm:table-cell w-32">Size</th>
                                    <th className="py-3 px-4 font-medium hidden md:table-cell w-48">Modified</th>
                                    <th className="py-3 px-4 font-medium w-24 text-center">Status</th>
                                    <th className="py-3 px-4 font-medium w-36 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {!loading && files.length === 0 && currentPath.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-obsidian-muted">
                                            <div className="flex flex-col items-center opacity-50">
                                                <FolderOpen size={48} className="mb-4" />
                                                <p>This folder is empty</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {currentPath.length > 0 && (
                                    <tr
                                        className={clsx(
                                            "hover:bg-white/5 transition-colors group cursor-pointer border-b border-white/5",
                                            dragOverFolder === '..' && (isCopyDrag ? "bg-emerald-500/20 border-emerald-500/50" : "bg-purple-500/20 border-purple-500/50")
                                        )}
                                        onClick={handleGoUp}
                                        onDragOver={(e) => {
                                            if (draggedItem) {
                                                e.preventDefault();
                                                const isCopy = e.ctrlKey || e.metaKey;
                                                e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
                                                setDragOverFolder('..');
                                                setIsCopyDrag(isCopy);
                                            }
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverFolder === '..') setDragOverFolder(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOverFolder(null);
                                            const source = e.dataTransfer.getData('text/plain') || draggedItem;
                                            const isCopy = e.ctrlKey || e.metaKey;
                                            if (source) handleDropItem(source, '..', isCopy);
                                        }}
                                    >
                                        <td className="py-3.5 px-4 text-center"></td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center text-white">
                                                <div className="w-8 h-8 rounded-lg mr-3 bg-white/5 text-white/50 flex items-center justify-center shrink-0">
                                                    <Folder size={18} fill="currentColor" className="opacity-80" />
                                                </div>
                                                <span className="font-medium">.. ({isCopyDrag && dragOverFolder === '..' ? 'Copy up' : 'Move up'})</span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 hidden sm:table-cell text-white/30 font-mono text-sm">-</td>
                                        <td className="py-3.5 px-4 hidden md:table-cell text-white/30 text-sm">-</td>
                                        <td className="py-3.5 px-4 text-center text-white/30">-</td>
                                        <td className="py-3.5 px-4"></td>
                                    </tr>
                                )}
                                {files.map((file) => {
                                    const isSelected = selectedFiles.has(file.name);
                                    const isJar = isJarFile(file.name);
                                    return (
                                        <tr
                                            key={file.name}
                                            draggable={!isSelectMode}
                                            onDragStart={(e) => {
                                                if (isSelectMode) return;
                                                e.dataTransfer.setData('text/plain', file.name);
                                                e.dataTransfer.effectAllowed = 'copyMove';
                                                setDraggedItem(file.name);
                                            }}
                                            onDragEnd={() => {
                                                setDraggedItem(null);
                                                setDragOverFolder(null);
                                                setIsCopyDrag(false);
                                            }}
                                            onDragOver={(e) => {
                                                if (file.type === 'folder' && draggedItem && (e.ctrlKey || e.metaKey || draggedItem !== file.name)) {
                                                    e.preventDefault();
                                                    const isCopy = e.ctrlKey || e.metaKey;
                                                    e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
                                                    setDragOverFolder(file.name);
                                                    setIsCopyDrag(isCopy);
                                                }
                                            }}
                                            onDragLeave={() => {
                                                if (dragOverFolder === file.name) setDragOverFolder(null);
                                            }}
                                            onDrop={(e) => {
                                                if (file.type === 'folder') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setDragOverFolder(null);
                                                    const source = e.dataTransfer.getData('text/plain') || draggedItem;
                                                    const isCopy = e.ctrlKey || e.metaKey;
                                                    if (source && (isCopy || source !== file.name)) {
                                                        handleDropItem(source, file.name, isCopy);
                                                    }
                                                }
                                            }}
                                            className={clsx(
                                                "hover:bg-white/5 transition-colors group",
                                                isSelected && "bg-white/[0.07]",
                                                draggedItem === file.name && "opacity-40",
                                                dragOverFolder === file.name && (isCopyDrag ? "bg-emerald-500/20 ring-2 ring-emerald-500/50" : "bg-purple-500/20 ring-2 ring-purple-500/50"),
                                                isJar && !isJarEnabled(file) && "opacity-75"
                                            )}
                                        >
                                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleSelect(file, e)}
                                                    className={clsx(
                                                        "w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto",
                                                        isSelected
                                                            ? "bg-obsidian-accent border-obsidian-accent text-white"
                                                            : "border-white/20 bg-white/5 hover:border-white/40"
                                                    )}
                                                >
                                                    {isSelected && <Check size={11} strokeWidth={3} />}
                                                </button>
                                            </td>
                                            <td
                                                className="py-3.5 px-4 cursor-pointer"
                                                onClick={() => {
                                                    if (isSelectMode) {
                                                        handleSelect(file, { stopPropagation: () => { } });
                                                    } else {
                                                        file.type === 'folder' ? handleNavigate(file.name) : handleFileClick(file);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center min-w-0">
                                                    <div className={clsx(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 mr-3 border transition-colors",
                                                        file.type === 'folder'
                                                            ? getFolderContainerClass(file.name)
                                                            : "bg-black/40 border-white/10"
                                                    )}>
                                                        {getFileIcon(file.name, file.type, file.pluginInfo, 18)}
                                                        {file.pluginInfo?.iconUrl && (
                                                            <div style={{ display: 'none' }} className="w-full h-full items-center justify-center text-amber-400">
                                                                <Package size={18} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                                                        <span className="font-medium text-sm text-white group-hover:text-obsidian-accent transition-colors truncate">
                                                            {file.pluginInfo?.title || file.name}
                                                        </span>
                                                        {file.pluginInfo?.webUrl && (
                                                            <a
                                                                href={file.pluginInfo.webUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-white/40 hover:text-white transition-colors p-0.5 rounded shrink-0 inline-flex items-center"
                                                                title={`View on ${file.pluginInfo.source || 'Modrinth'}`}
                                                            >
                                                                <ExternalLink size={13} />
                                                            </a>
                                                        )}
                                                        {file.pluginInfo?.title && isJar && (
                                                            <span className="text-xs text-white/40 font-mono truncate hidden sm:inline" title={file.name}>
                                                                {file.name}
                                                            </span>
                                                        )}
                                                        {file.pluginInfo?.updateAvailable && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateJar(file);
                                                                }}
                                                                disabled={updatingFiles.has(file.name)}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 active:scale-95 transition-all shadow-sm shrink-0"
                                                                title={`Update available: ${file.pluginInfo.latestVersion || 'Newer version'}\nClick to update directly`}
                                                            >
                                                                {updatingFiles.has(file.name) ? (
                                                                    <Loader2 size={12} className="animate-spin text-emerald-300" />
                                                                ) : (
                                                                    <ArrowUpCircle size={13} className="text-emerald-400" />
                                                                )}
                                                                <span>
                                                                    {updatingFiles.has(file.name)
                                                                        ? 'Updating...'
                                                                        : `Update ${file.pluginInfo.latestVersion ? `(v${file.pluginInfo.latestVersion})` : 'Available'}`}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 text-sm text-white/70 font-mono whitespace-nowrap hidden sm:table-cell">
                                                {file.type === 'folder' ? file.size : formatSize(file.sizeBytes || file.size)}
                                            </td>

                                            <td className="py-3.5 px-4 text-sm text-white/50 whitespace-nowrap hidden md:table-cell">
                                                {formatDate(file.modified)}
                                            </td>

                                            <td className="py-3.5 px-4 text-center">
                                                {isJar ? (
                                                    <div className="flex justify-center">
                                                        <JarToggleSwitch
                                                            file={file}
                                                            onToggle={handleToggleJar}
                                                            isToggling={togglingJars.has(file.name)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-white/20">-</span>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {file.pluginInfo?.updateAvailable && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateJar(file); }}
                                                            disabled={updatingFiles.has(file.name)}
                                                            className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded transition-all"
                                                            title={`Update to ${file.pluginInfo.latestVersion || 'latest version'}`}
                                                        >
                                                            {updatingFiles.has(file.name) ? (
                                                                <Loader2 size={15} className="animate-spin" />
                                                            ) : (
                                                                <ArrowUpCircle size={15} />
                                                            )}
                                                        </button>
                                                    )}
                                                    {file.type !== 'folder' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                            className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
                                                            title="Download"
                                                        >
                                                            <Download size={15} />
                                                        </button>
                                                    )}
                                                    {(file.name.endsWith('.zip') || file.name.endsWith('.tar.gz')) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleExtract(file); }}
                                                            className="p-1.5 hover:bg-orange-500/20 hover:text-orange-400 rounded text-obsidian-muted transition-colors"
                                                            title="Extract"
                                                        >
                                                            <Archive size={15} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openCopyModal(file.name); }}
                                                        className="p-1.5 hover:bg-purple-500/20 hover:text-purple-400 rounded text-obsidian-muted transition-colors"
                                                        title="Copy"
                                                    >
                                                        <Copy size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openMoveModal(file.name); }}
                                                        className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded text-obsidian-muted transition-colors"
                                                        title="Move"
                                                    >
                                                        <FolderInput size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openRenameModal(file.name); }}
                                                        className="p-1.5 hover:bg-blue-500/20 hover:text-blue-400 rounded text-obsidian-muted transition-colors"
                                                        title="Rename"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); confirmDelete(file.name); }}
                                                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-obsidian-muted transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Grid View */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
                        {currentPath.length > 0 && (
                            <div
                                className={clsx(
                                    "flex flex-col items-center p-4 rounded-xl hover:bg-white/5 transition-all text-white/50 hover:text-white cursor-pointer group border border-dashed border-transparent",
                                    dragOverFolder === '..' && (isCopyDrag ? "bg-emerald-500/20 border-emerald-500/50 text-white" : "bg-purple-500/20 border-purple-500/50 text-white")
                                )}
                                onClick={handleGoUp}
                                onDragOver={(e) => {
                                    if (draggedItem) {
                                        e.preventDefault();
                                        const isCopy = e.ctrlKey || e.metaKey;
                                        e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
                                        setDragOverFolder('..');
                                        setIsCopyDrag(isCopy);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverFolder === '..') setDragOverFolder(null);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverFolder(null);
                                    const source = e.dataTransfer.getData('text/plain') || draggedItem;
                                    const isCopy = e.ctrlKey || e.metaKey;
                                    if (source) handleDropItem(source, '..', isCopy);
                                }}
                            >
                                <Folder size={48} className="mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                                <span className="text-sm font-medium">.. ({isCopyDrag && dragOverFolder === '..' ? 'Copy up' : 'Move up'})</span>
                            </div>
                        )}
                        {files.map((file) => {
                            const isSelected = selectedFiles.has(file.name);
                            const isJar = isJarFile(file.name);
                            const isEnabled = isJarEnabled(file);
                            return (
                                <div
                                    key={file.name}
                                    draggable={!isSelectMode}
                                    onDragStart={(e) => {
                                        if (isSelectMode) return;
                                        e.dataTransfer.setData('text/plain', file.name);
                                        e.dataTransfer.effectAllowed = 'copyMove';
                                        setDraggedItem(file.name);
                                    }}
                                    onDragEnd={() => {
                                        setDraggedItem(null);
                                        setDragOverFolder(null);
                                        setIsCopyDrag(false);
                                    }}
                                    onDragOver={(e) => {
                                        if (file.type === 'folder' && draggedItem && (e.ctrlKey || e.metaKey || draggedItem !== file.name)) {
                                            e.preventDefault();
                                            const isCopy = e.ctrlKey || e.metaKey;
                                            e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';
                                            setDragOverFolder(file.name);
                                            setIsCopyDrag(isCopy);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverFolder === file.name) setDragOverFolder(null);
                                    }}
                                    onDrop={(e) => {
                                        if (file.type === 'folder') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOverFolder(null);
                                            const source = e.dataTransfer.getData('text/plain') || draggedItem;
                                            const isCopy = e.ctrlKey || e.metaKey;
                                            if (source && (isCopy || source !== file.name)) {
                                                handleDropItem(source, file.name, isCopy);
                                            }
                                        }
                                    }}
                                    className={clsx(
                                        "flex flex-col items-center text-center p-4 rounded-xl transition-all cursor-pointer group relative",
                                        isSelected ? "bg-obsidian-accent/20 border border-obsidian-accent/50" : "hover:bg-white/5 border border-transparent",
                                        draggedItem === file.name && "opacity-40",
                                        dragOverFolder === file.name && (isCopyDrag ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/50" : "bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/50"),
                                        isJar && !isEnabled && "opacity-60"
                                    )}
                                    onClick={(e) => {
                                        if (isSelectMode) {
                                            handleSelect(file, e);
                                        } else {
                                            file.type === 'folder' ? handleNavigate(file.name) : handleFileClick(file);
                                        }
                                    }}
                                >
                                    <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={(e) => handleSelect(file, e)}
                                            className={clsx(
                                                "w-5 h-5 rounded-full border flex items-center justify-center transition-all bg-black/40",
                                                isSelected ? "bg-obsidian-accent border-obsidian-accent" : "border-white/20 opacity-0 group-hover:opacity-100"
                                            )}
                                        >
                                            {isSelected && <Check size={11} className="text-white" />}
                                        </button>
                                    </div>
                                    {!isSelectMode && (
                                        <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            {file.type !== 'folder' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                    className="p-1.5 bg-black/40 hover:bg-obsidian-accent rounded-lg text-white transition-colors backdrop-blur-sm"
                                                    title="Download"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            )}
                                            {(file.name.endsWith('.zip') || file.name.endsWith('.tar.gz')) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleExtract(file); }}
                                                    className="p-1.5 bg-black/40 hover:bg-orange-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                    title="Extract"
                                                >
                                                    <Archive size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openCopyModal(file.name); }}
                                                className="p-1.5 bg-black/40 hover:bg-purple-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                title="Copy"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openMoveModal(file.name); }}
                                                className="p-1.5 bg-black/40 hover:bg-emerald-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                title="Move"
                                            >
                                                <FolderInput size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRenameModal(file.name); }}
                                                className="p-1.5 bg-black/40 hover:bg-blue-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                title="Rename"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); confirmDelete(file.name); }}
                                                className="p-1.5 bg-black/40 hover:bg-red-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            {file.pluginInfo?.updateAvailable && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleUpdateJar(file); }}
                                                    disabled={updatingFiles.has(file.name)}
                                                    className="p-1.5 bg-emerald-500/80 hover:bg-emerald-500 rounded-lg text-white transition-colors backdrop-blur-sm"
                                                    title={`Update to ${file.pluginInfo.latestVersion || 'latest'}`}
                                                >
                                                    {updatingFiles.has(file.name) ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <ArrowUpCircle size={14} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className={clsx(
                                        "w-16 h-16 rounded-2xl mb-3 p-2 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 overflow-hidden border",
                                        file.type === 'folder'
                                            ? getFolderContainerClass(file.name)
                                            : isJar
                                            ? "bg-gradient-to-br from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20"
                                            : "bg-gradient-to-br from-blue-500/20 to-blue-600/5 text-blue-400 border-white/10"
                                    )}>
                                        {file.pluginInfo?.iconUrl ? (
                                            <img
                                                src={file.pluginInfo.iconUrl}
                                                alt={file.pluginInfo.title || file.name}
                                                className="w-full h-full object-contain rounded-xl"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fallback = e.currentTarget.nextElementSibling;
                                                    if (fallback) fallback.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div style={{ display: file.pluginInfo?.iconUrl ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
                                            {getFileIcon(file.name, file.type, null, 36)}
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-white truncate w-full px-2 group-hover:text-obsidian-accent transition-colors">
                                        {file.pluginInfo?.title || file.name}
                                    </span>
                                    {file.pluginInfo?.title && isJar && (
                                        <span className="text-xs text-white/40 font-mono truncate w-full px-2" title={file.name}>
                                            {file.name}
                                        </span>
                                    )}
                                    <span className="text-xs text-obsidian-muted mt-1 opacity-70">
                                        {file.type === 'folder' ? file.size : formatSize(file.sizeBytes || file.size)}
                                    </span>
                                    {file.pluginInfo?.updateAvailable && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateJar(file);
                                            }}
                                            disabled={updatingFiles.has(file.name)}
                                            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 active:scale-95 transition-all shadow-sm shrink-0"
                                            title={`Update to ${file.pluginInfo.latestVersion || 'latest'}`}
                                        >
                                            {updatingFiles.has(file.name) ? (
                                                <Loader2 size={11} className="animate-spin text-emerald-300" />
                                            ) : (
                                                <ArrowUpCircle size={12} className="text-emerald-400" />
                                            )}
                                            <span>
                                                {updatingFiles.has(file.name)
                                                    ? 'Updating...'
                                                    : `Update ${file.pluginInfo.latestVersion ? `(v${file.pluginInfo.latestVersion})` : ''}`}
                                            </span>
                                        </button>
                                    )}
                                    {isJar && (
                                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                            <JarToggleSwitch
                                                file={file}
                                                onToggle={handleToggleJar}
                                                isToggling={togglingJars.has(file.name)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Editor Modal */}
            {isEditorOpen && (
                <div className="fixed inset-0 z-50 bg-obsidian-bg/95 flex flex-col animate-in fade-in duration-200">
                    <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-obsidian-surface">
                        <div className="flex items-center">
                            <FileCode className="text-obsidian-accent mr-3" size={20} />
                            <span className="font-bold text-white">{editorFile?.name}</span>
                        </div>


                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => { setIsEditorOpen(false); setEditorFile(null); }}
                                className="px-4 py-1.5 text-obsidian-muted hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFile}
                                disabled={isSaving}
                                className="glass-button px-4 py-1.5 rounded-lg flex items-center disabled:opacity-50"
                            >
                                <Save size={16} className="mr-2" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
                        <Editor
                            height="100%"
                            language={getLanguage(editorFile?.name)}
                            value={editorContent}
                            theme="vs-dark"
                            onChange={(value) => setEditorContent(value || '')}
                            onMount={(editor, monaco) => {
                                // Bind Ctrl+S (or Cmd+S on Mac) to save
                                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
                                    if (!editorFile) return;
                                    const content = editor.getValue();
                                    setIsSaving(true);
                                    try {
                                        await serverApi.saveFile(editorFile.path, content);
                                        showToast('File saved successfully (Shortcut)', 'success');
                                        loadFiles();
                                    } catch (err) {
                                        showToast('Failed to save: ' + err.message, 'error');
                                    } finally {
                                        setIsSaving(false);
                                    }
                                });
                            }}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 16, bottom: 16 },
                                insertSpaces: true,
                                tabSize: 2
                            }}
                            loading={<div className="text-white p-4">Loading editor...</div>}
                        />


                    </div>
                </div>
            )}

            <Modal
                isOpen={isCreateFileOpen}
                onClose={() => setIsCreateFileOpen(false)}
                title="Create New File"
                footer={
                    <>
                        <button onClick={() => setIsCreateFileOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateFile} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg">Create</button>
                    </>
                }
            >
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Enter file name (e.g. config.yml)"
                    className="w-full glass-input px-4 py-2"
                    autoFocus
                />
            </Modal>

            <Modal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                title="Create New Folder"
                footer={
                    <>
                        <button onClick={() => setIsCreateFolderOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateFolder} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg">Create</button>
                    </>
                }
            >
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Enter folder name"
                    className="w-full glass-input px-4 py-2"
                    autoFocus
                />
            </Modal>

            <Modal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                title="Confirm Deletion"
                footer={
                    <>
                        <button onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={() => handleDelete()} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Delete</button>
                    </>
                }
            >
                <p>Are you sure you want to delete <span className="font-bold text-white">{itemToDelete}</span>? This action cannot be undone.</p>
            </Modal>

            <Modal
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                title="Confirm Bulk Deletion"
                footer={
                    <>
                        <button onClick={() => setIsBulkDeleteOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={executeBulkDelete} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Delete {selectedFiles.size} Items</button>
                    </>
                }
            >
                <div className="text-gray-300">
                    <p className="mb-2">Are you sure you want to delete these <span className="font-bold text-white">{selectedFiles.size}</span> items?</p>
                    <ul className="list-disc list-inside text-sm text-obsidian-muted max-h-32 overflow-y-auto custom-scrollbar">
                        {Array.from(selectedFiles).slice(0, 5).map(name => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                    {selectedFiles.size > 5 && <p className="text-sm text-obsidian-muted mt-1">...and {selectedFiles.size - 5} more</p>}
                </div>
            </Modal>

            {/* Extract with Password Modal */}
            <Modal
                isOpen={isExtractModalOpen}
                onClose={() => setIsExtractModalOpen(false)}
                title={`Extract: ${extractTarget?.name || ''}`}
                footer={
                    <>
                        <button onClick={() => setIsExtractModalOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleExtractConfirm} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center gap-2">
                            <Archive size={16} /> Extract
                        </button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-sm text-obsidian-muted">
                        Leave the password field blank if the archive is not encrypted.
                    </p>
                    <div className="relative">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider mb-1.5 block">Password (optional)</label>
                        <input
                            type={showExtractPassword ? 'text' : 'password'}
                            value={extractPassword}
                            onChange={(e) => setExtractPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleExtractConfirm()}
                            placeholder="Enter archive password..."
                            className="w-full glass-input px-4 py-2.5 rounded-xl font-mono text-sm pr-10 focus:ring-2 focus:ring-obsidian-accent/50"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowExtractPassword(p => !p)}
                            className="absolute right-3 bottom-3 text-obsidian-muted hover:text-white transition-colors"
                        >
                            {showExtractPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isRenameOpen}
                onClose={() => setIsRenameOpen(false)}
                title="Rename Item"
                footer={
                    <>
                        <button onClick={() => setIsRenameOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleRename} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg">Rename</button>
                    </>
                }
            >
                <input
                    type="text"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    placeholder="Enter new name"
                    className="w-full glass-input px-4 py-2"
                    autoFocus
                />
            </Modal>

            {/* Copy File/Folder Modal */}
            <Modal
                isOpen={isCopyModalOpen}
                onClose={() => !isCopying && setIsCopyModalOpen(false)}
                title={`Copy: ${itemToCopy || ''}`}
                footer={
                    <>
                        <button
                            onClick={() => setIsCopyModalOpen(false)}
                            disabled={isCopying}
                            className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCopyConfirm}
                            disabled={isCopying}
                            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                            {isCopying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                            {isCopying ? 'Copying...' : 'Copy Item'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Destination Folder</label>
                        <input
                            type="text"
                            value={copyTargetFolder}
                            onChange={(e) => setCopyTargetFolder(e.target.value)}
                            placeholder="'.' for current, '..' for parent, or enter folder name (e.g. backups)"
                            className="w-full glass-input px-4 py-2 text-white font-mono text-sm"
                            disabled={isCopying}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">New Name (Optional)</label>
                        <input
                            type="text"
                            value={copyNewName}
                            onChange={(e) => setCopyNewName(e.target.value)}
                            placeholder="Target file/folder name"
                            className="w-full glass-input px-4 py-2 text-white font-mono text-sm"
                            disabled={isCopying}
                        />
                    </div>

                    {isCopying && (
                        <div className="p-3 bg-obsidian-accent/10 border border-obsidian-accent/30 rounded-xl flex items-center gap-3 animate-pulse">
                            <Loader2 size={18} className="text-obsidian-accent animate-spin shrink-0" />
                            <div className="text-xs text-obsidian-muted">
                                <span className="font-bold text-white block">Copying in progress...</span>
                                Duplicating <span className="font-mono text-white">{itemToCopy}</span>. Please wait.
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Move File/Folder Modal */}
            <Modal
                isOpen={isMoveModalOpen}
                onClose={() => !isMoving && setIsMoveModalOpen(false)}
                title={`Move: ${itemToMove || ''}`}
                footer={
                    <>
                        <button
                            onClick={() => setIsMoveModalOpen(false)}
                            disabled={isMoving}
                            className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMoveConfirm}
                            disabled={isMoving}
                            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                            {isMoving ? <Loader2 size={16} className="animate-spin" /> : <FolderInput size={16} />}
                            {isMoving ? 'Moving...' : 'Move Item'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Target Folder</label>
                        <input
                            type="text"
                            value={moveTargetFolder}
                            onChange={(e) => setMoveTargetFolder(e.target.value)}
                            placeholder="Use '..' for parent folder or enter subfolder name (e.g. plugins)"
                            className="w-full glass-input px-4 py-2 text-white font-mono text-sm"
                            disabled={isMoving}
                            autoFocus
                        />
                    </div>
                </div>
            </Modal>

            {/* Remote cURL File Download Modal */}
            <Modal
                isOpen={isRemoteDownloadOpen}
                onClose={() => !isDownloadingRemote && setIsRemoteDownloadOpen(false)}
                title="Remote cURL File Download"
                footer={
                    <>
                        <button
                            onClick={() => setIsRemoteDownloadOpen(false)}
                            disabled={isDownloadingRemote}
                            className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRemoteDownload}
                            disabled={isDownloadingRemote || !remoteUrl.trim()}
                            className="px-5 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                            {isDownloadingRemote && <Loader2 size={16} className="animate-spin" />}
                            {isDownloadingRemote ? 'Downloading via cURL...' : 'Start Download'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-xs text-obsidian-muted">
                        Download any file directly into <span className="font-mono text-white">/{currentPath.join('/') || 'root'}</span> using cURL.
                    </p>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Direct File URL (Required)</label>
                        <input
                            type="text"
                            value={remoteUrl}
                            onChange={(e) => setRemoteUrl(e.target.value)}
                            placeholder="https://w.bzzhr.co/f/xyz OR https://example.com/file.zip"
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-white text-sm font-mono focus:ring-2 focus:ring-obsidian-accent/50"
                            disabled={isDownloadingRemote}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider">Target Filename (Optional)</label>
                        <input
                            type="text"
                            value={remoteFilename}
                            onChange={(e) => setRemoteFilename(e.target.value)}
                            placeholder="e.g. world_backup.zip (Leave blank to auto-detect)"
                            className="w-full glass-input px-4 py-2 rounded-xl text-white text-sm font-mono focus:ring-2 focus:ring-obsidian-accent/50"
                            disabled={isDownloadingRemote}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider flex justify-between items-center">
                            <span>Optional Headers (One per line)</span>
                            <span className="text-[10px] text-obsidian-muted opacity-70 font-normal">e.g. Authorization: Bearer TOKEN</span>
                        </label>
                        <textarea
                            value={remoteHeaders}
                            onChange={(e) => setRemoteHeaders(e.target.value)}
                            placeholder={`Authorization: Bearer YOUR_ACCOUNT_ID\nCookie: accountToken=xyz`}
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-obsidian-accent/50 resize-none"
                            rows={3}
                            disabled={isDownloadingRemote}
                        />
                    </div>

                    {isDownloadingRemote && (
                        <div className="p-3 bg-obsidian-accent/10 border border-obsidian-accent/30 rounded-xl flex items-center gap-3">
                            <Loader2 size={18} className="text-obsidian-accent animate-spin shrink-0" />
                            <div className="text-xs text-obsidian-muted">
                                <span className="font-bold text-white block">Download in progress...</span>
                                Streaming file via cURL into current directory. Please wait.
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default FileManager;
