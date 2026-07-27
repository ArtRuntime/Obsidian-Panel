import { API_URL } from '../config';
const BASE_URL = `${API_URL}/api`;
const getHeaders = () => {
    return {
        'Content-Type': 'application/json'
    };
};
export const serverApi = {
    getStatus: async () => {
        const res = await fetch(`${BASE_URL}/control/status`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    },
    getPublicIp: async () => {
        const res = await fetch(`${BASE_URL}/control/public-ip`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch IP');
        return res.json();
    },
    performAction: async (action) => {
        const res = await fetch(`${BASE_URL}/control/action`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action })
        });
        if (!res.ok) throw new Error(`Failed to ${action} server`);
        return res.json();
    },
    sendCommand: async (command) => {
        const res = await fetch(`${BASE_URL}/control/command`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ command })
        });
        if (!res.ok) throw new Error('Failed to send command');
        return res.json();
    },
    install: async (version) => {
        const res = await fetch(`${BASE_URL}/control/install`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ version })
        });
        if (!res.ok) throw new Error('Failed to start installation');
        return res.json();
    },
    installServer: async (version) => {
        const res = await fetch(`${BASE_URL}/control/install`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ version })
        });
        if (!res.ok) throw new Error('Failed to start installation');
        return res.json();
    },
    updateServerConfig: async (config) => {
        const res = await fetch(`${BASE_URL}/control/config`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error('Failed to update config');
        return res.json();
    },
    getServerProperties: async () => {
        const res = await fetch(`${BASE_URL}/control/properties`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch server properties');
        return res.json();
    },
    updateServerProperties: async (properties) => {
        const res = await fetch(`${BASE_URL}/control/properties`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ properties })
        });
        if (!res.ok) throw new Error('Failed to update server properties');
        return res.json();
    },
    uploadServerIcon: async (file) => {
        const formData = new FormData();
        formData.append('icon', file);
        const res = await fetch(`${BASE_URL}/control/files/server-icon`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to upload server icon');
        }
        return res.json();
    },
    getServerIcon: async () => {
        const res = await fetch(`${BASE_URL}/control/files/server-icon`, {
            credentials: 'include'
        });
        if (!res.ok) return null;
        return res.json();
    },
    getFiles: async (path = []) => {
        const res = await fetch(`${BASE_URL}/control/files/list`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/') })
        });
        if (!res.ok) throw new Error('Failed to list files');
        return res.json();
    },
    readFile: async (path) => {
        const res = await fetch(`${BASE_URL}/control/files/read`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/') })
        });
        if (!res.ok) throw new Error('Failed to read file');
        return res.json();
    },
    saveFile: async (path, content) => {
        const res = await fetch(`${BASE_URL}/control/files/save`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/'), content })
        });
        if (!res.ok) throw new Error('Failed to save file');
        return res.json();
    },
    createFile: async (path, name, type) => {
        const res = await fetch(`${BASE_URL}/control/files/create`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/'), name, type })
        });
        if (!res.ok) throw new Error('Failed to create item');
        return res.json();
    },
    deleteFile: async (path, name) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/delete`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) throw new Error('Failed to delete item');
        return res.json();
    },
    deleteFiles: async (path, items) => {
        const res = await fetch(`${BASE_URL}/control/files/batch-delete`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/'), items })
        });
        if (!res.ok) throw new Error('Failed to delete items');
        return res.json();
    },
    renameFile: async (path, oldName, newName) => {
        const res = await fetch(`${BASE_URL}/control/files/rename`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: path.join('/'), oldName, newName })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to rename item');
        }
        return res.json();
    },
    extractFile: async (path, name, password) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/extract`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: fullPath, password: password || undefined })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to extract file');
        }
        return res.json();
    },
    compressFiles: async (path, files, password) => {
        const res = await fetch(`${BASE_URL}/control/files/compress`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ currentPath: path.join('/'), files, password: password || undefined })
        });
        if (!res.ok) throw new Error('Failed to compress files');
        return res.json();
    },
    downloadRemoteFile: async (path, url, filename, headers) => {
        const res = await fetch(`${BASE_URL}/control/files/remote-download`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ currentPath: path.join('/'), url, filename, headers })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Remote download failed');
        }
        return res.json();
    },
    uploadFile: async (path, file, onProgress) => {
        // Use chunked upload for all files
        return serverApi.uploadFileChunked(path, file, onProgress);
    },
    uploadFileChunked: async (path, file, onProgress) => {
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileName = file.name;
        const startTime = Date.now();
        let uploadedBytes = 0;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk);
            formData.append('path', path.join('/'));
            formData.append('fileName', fileName);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', totalChunks.toString());

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${BASE_URL}/control/files/upload-chunk`);
                xhr.withCredentials = true;

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && onProgress) {
                        // Calculate total progress including this partial chunk
                        const currentChunkLoaded = event.loaded;
                        const totalLoaded = uploadedBytes + currentChunkLoaded;
                        const percentComplete = Math.round((totalLoaded / file.size) * 100);

                        // Calculate speed
                        const now = Date.now();
                        const diffTime = (now - startTime) / 1000;
                        let uploadSpeed = '0 B/s';
                        if (diffTime > 0) {
                            const speedBytes = totalLoaded / diffTime;
                            const k = 1024;
                            const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
                            const iSize = Math.floor(Math.log(speedBytes) / Math.log(k));
                            const safeI = Math.min(Math.max(iSize, 0), sizes.length - 1);
                            uploadSpeed = parseFloat((speedBytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + sizes[safeI];
                        }

                        onProgress(percentComplete, uploadSpeed);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        try {
                            const error = JSON.parse(xhr.responseText);
                            reject(new Error(error.message || 'Chunk upload failed'));
                        } catch {
                            reject(new Error(xhr.statusText || 'Chunk upload failed'));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            uploadedBytes += chunk.size;
        }
        return { success: true };
    },
    downloadFile: async (path, name) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/download`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) throw new Error('Failed to download file');
        return res.blob();
    },
    createBackup: async (notes) => {
        const res = await fetch(`${BASE_URL}/backups/create`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: notes ? JSON.stringify({ notes }) : undefined
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Backup failed');
        }
        return res.json();
    },
    getBackupStatus: async () => {
        const res = await fetch(`${BASE_URL}/backups/status`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch backup status');
        return res.json();
    },
    getBackups: async () => {
        const res = await fetch(`${BASE_URL}/backups`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch backups');
        return res.json();
    },
    deleteBackup: async (id) => {
        const res = await fetch(`${BASE_URL}/backups/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete backup');
        return res.json();
    },
    updateBackupNotes: async (id, notes) => {
        const res = await fetch(`${BASE_URL}/backups/${id}/notes`, {
            method: 'PUT',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ notes })
        });
        if (!res.ok) throw new Error('Failed to update notes');
        return res.json();
    },
    restoreBackup: async (id) => {
        const res = await fetch(`${BASE_URL}/backups/${id}/restore`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Restore failed');
        }
        return res.json();
    },
    getBackupConfig: async () => {
        const res = await fetch(`${BASE_URL}/backups/config`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch backup config');
        return res.json();
    },
    updateBackupConfig: async (config) => {
        const res = await fetch(`${BASE_URL}/backups/config`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error('Failed to update config');
        return res.json();
    },
    searchPlugins: async (query) => {
        const res = await fetch(`${BASE_URL}/plugins/search?query=${encodeURIComponent(query)}`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to search plugins');
        return res.json();
    },
    installPlugin: async (projectId, source, customVersion, customLoader) => {
        const res = await fetch(`${BASE_URL}/plugins/install`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ projectId, source, customVersion, customLoader })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Installation failed');
        }
        return res.json();
    },
    applyTemplate: async (templateData) => {
        const res = await fetch(`${BASE_URL}/plugins/apply-template`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(templateData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to apply template');
        }
        return res.json();
    },
    // User Management
    getUsers: async () => {
        const res = await fetch(`${BASE_URL}/users`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    createUser: async (userData) => {
        const res = await fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create user');
        }
        return res.json();
    },
    updateUser: async (id, userData) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update user');
        }
        return res.json();
    },
    deleteUser: async (id) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    },

    // Scheduled Tasks API
    getSchedules: async () => {
        const res = await fetch(`${BASE_URL}/schedules`, {
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch schedules');
        return res.json();
    },
    createSchedule: async (data) => {
        const res = await fetch(`${BASE_URL}/schedules`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create schedule');
        }
        return res.json();
    },
    updateSchedule: async (id, data) => {
        const res = await fetch(`${BASE_URL}/schedules/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update schedule');
        }
        return res.json();
    },
    deleteSchedule: async (id) => {
        const res = await fetch(`${BASE_URL}/schedules/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete schedule');
        return res.json();
    },
    runScheduleNow: async (id) => {
        const res = await fetch(`${BASE_URL}/schedules/${id}/run`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to run schedule');
        return res.json();
    }
};
