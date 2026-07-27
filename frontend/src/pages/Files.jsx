import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { serverApi } from '../api/server';
import { Folder, FileText, ChevronRight, Home, Download, Trash2, FileCode, FileJson, FileImage, Upload, Save, X, Archive, CheckSquare, Check, FolderPlus, RefreshCw, ArrowLeft, Loader2, FolderOpen, Edit2, Globe, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
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

    const getFileIcon = (name, type) => {
        if (type === 'folder') return <Folder className="text-obsidian-accent fill-obsidian-accent/20" size={24} />;
        if (name.endsWith('.json')) return <FileJson className="text-yellow-400" size={24} />;
        if (name.endsWith('.zip') || name.endsWith('.tar.gz')) return <Archive className="text-orange-400" size={24} />;
        if (name.endsWith('.log') || name.endsWith('.txt')) return <FileText className="text-gray-400" size={24} />;
        if (name.endsWith('.properties') || name.endsWith('.yml') || name.endsWith('.yaml')) return <FileCode className="text-blue-400" size={24} />;
        if (name.endsWith('.png') || name.endsWith('.jpg')) return <FileImage className="text-purple-400" size={24} />;
        return <FileText className="text-gray-400" size={24} />;
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

    const handleSaveFile = async () => {
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

    // Drag and Drop
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
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
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                        <Loader2 className="w-8 h-8 text-obsidian-accent animate-spin" />
                    </div>
                )}

                {/* Mobile View: List */}
                <div className="block md:hidden">
                    <table className="w-full text-left text-sm text-obsidian-muted relative z-0">
                        <tbody className="divide-y divide-white/5">
                            {!loading && files.length === 0 && currentPath.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-obsidian-muted">
                                        <div className="flex flex-col items-center opacity-50">
                                            <FolderOpen size={48} className="mb-4" />
                                            <p>This folder is empty</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {currentPath.length > 0 && (
                                <tr
                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                    onClick={handleGoUp}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-white">
                                            <div className="p-2 rounded-lg mr-3 bg-white/5 text-white/50">
                                                <Folder size={18} fill="currentColor" className="opacity-80" />
                                            </div>
                                            <span className="font-medium">..</span>
                                        </div>
                                    </td>
                                    <td colSpan="3"></td>
                                </tr>
                            )}
                            {files.map((file) => {
                                const isSelected = selectedFiles.has(file.name);
                                return (
                                    <tr key={file.name}
                                        className={clsx("hover:bg-white/5 transition-colors group", isSelected && "bg-white/5")}
                                        onClick={() => isSelectMode ? handleSelect(file, { stopPropagation: () => { } }) : null}
                                    >
                                        <td className="px-6 py-4">
                                            <div
                                                className="flex items-center cursor-pointer text-white"
                                                onClick={(e) => {
                                                    if (isSelectMode) {
                                                        handleSelect(file, e);
                                                    } else {
                                                        file.type === 'folder' ? handleNavigate(file.name) : handleFileClick(file)
                                                    }
                                                }}
                                            >
                                                {isSelectMode && (
                                                    <div className="mr-3 flex-shrink-0">
                                                        <div className={clsx(
                                                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                            isSelected ? "bg-obsidian-accent border-obsidian-accent" : "border-white/20 bg-black/20"
                                                        )}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className={`p-2 rounded-lg mr-3 ${file.type === 'folder' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                    {getFileIcon(file.name, file.type)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium group-hover:text-obsidian-accent transition-colors">{file.name}</span>
                                                    <span className="text-xs text-obsidian-muted opacity-70 font-mono">{formatSize(file.size)}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {file.type !== 'folder' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                        className="p-1.5 hover:bg-white/10 rounded text-white transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                                {(file.name.endsWith('.zip') || file.name.endsWith('.tar.gz')) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleExtract(file); }}
                                                        className="p-1.5 hover:bg-orange-500/20 hover:text-orange-400 rounded text-obsidian-muted transition-colors"
                                                        title="Extract"
                                                    >
                                                        <Archive size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openRenameModal(file.name); }}
                                                    className="p-1.5 hover:bg-blue-500/20 hover:text-blue-400 rounded text-obsidian-muted transition-colors"
                                                    title="Rename"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); confirmDelete(file.name); }}
                                                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-obsidian-muted transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Desktop View: Grid */}
                <div className="hidden md:grid grid-cols-4 lg:grid-cols-6 gap-4 p-4">
                    {currentPath.length > 0 && (
                        <div
                            className="flex flex-col items-center p-4 rounded-xl hover:bg-white/5 transition-all text-white/50 hover:text-white cursor-pointer group"
                            onClick={handleGoUp}
                        >
                            <Folder size={48} className="mb-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                            <span className="text-sm font-medium">..</span>
                        </div>
                    )}
                    {files.map((file) => {
                        const isSelected = selectedFiles.has(file.name);
                        return (
                            <div
                                key={file.name}
                                className={clsx(
                                    "flex flex-col items-center text-center p-4 rounded-xl transition-all cursor-pointer group relative",
                                    isSelected ? "bg-obsidian-accent/20 border border-obsidian-accent/50" : "hover:bg-white/5 border border-transparent"
                                )}
                                onClick={(e) => {
                                    if (isSelectMode) {
                                        handleSelect(file, e);
                                    } else {
                                        file.type === 'folder' ? handleNavigate(file.name) : handleFileClick(file)
                                    }
                                }}
                            >
                                {isSelectMode && (
                                    <div className="absolute top-2 right-2 z-10">
                                        <div className={clsx(
                                            "w-5 h-5 rounded-full border flex items-center justify-center transition-all bg-black/40",
                                            isSelected ? "bg-obsidian-accent border-obsidian-accent" : "border-white/20"
                                        )}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                    </div>
                                )}
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
                                    </div>
                                )}
                                <div className={clsx(
                                    "p-3 rounded-2xl mb-3 shadow-lg transition-transform group-hover:scale-105",
                                    file.type === 'folder' ? "bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 text-yellow-400" : "bg-gradient-to-br from-blue-500/20 to-blue-600/5 text-blue-400"
                                )}>
                                    {/* Improve icon scaling here if needed, defaulting to inheriting size or explicit */}
                                    {React.cloneElement(getFileIcon(file.name, file.type), { size: 48 })}
                                </div>
                                <span className="text-sm font-medium text-white truncate w-full px-2 group-hover:text-obsidian-accent transition-colors">
                                    {file.name}
                                </span>
                                <span className="text-xs text-obsidian-muted mt-1 opacity-70">
                                    {formatSize(file.size)}
                                </span>
                            </div>
                        )
                    })}
                </div>
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
