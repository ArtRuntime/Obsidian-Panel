const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');
const minecraftService = require('./minecraftService');

let scheduledTask = null;
let isBackupInProgress = false;
const DEFAULT_CONFIG = {
    enabled: false,
    frequency: 'daily',
    cronExpression: '0 0 * * *',
    maxBackups: 10
};
const BackupService = {
    isBackupInProgress: () => isBackupInProgress,
    getGuestToken: async () => {
        try {
            const response = await fetch('https://api.gofile.io/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.status === 'ok') {
                return data.data.token;
            }
            throw new Error('Failed to create guest account');
        } catch (error) {
            throw new Error(`Guest token generation failed: ${error.message}`);
        }
    },
    performBackup: async (manualTrigger = false, notes = '') => {
        if (isBackupInProgress) {
            throw new Error('Backup already in progress');
        }

        const provider = minecraftService.config?.backupProvider || 'buzzheavier';
        let token = minecraftService.config?.gofileToken || process.env.GOFILE_API_TOKEN || '';

        if (provider === 'gofile' && !token) {
            try {
                console.log('[BackupService] No GoFile API token found. Attempting guest token generation...');
                token = await BackupService.getGuestToken();
            } catch (err) {
                console.warn('[BackupService] GoFile guest token generation warning:', err.message);
            }
        }

        const serverDir = minecraftService.serverDir;
        if (!fs.existsSync(serverDir)) {
            throw new Error('Server directory not found');
        }

        const serverFiles = fs.readdirSync(serverDir);
        if (serverFiles.length === 0) {
            throw new Error('Server directory is empty. Please install/run server files before creating a backup.');
        }

        isBackupInProgress = true;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup-${timestamp}${manualTrigger ? '-manual' : '-auto'}.zip`;
        const tempDir = process.env.TEMP_BACKUP_PATH || path.resolve(__dirname, '../../tmp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempZipPath = path.resolve(tempDir, backupName);
        try {
            // Generate a strong, shell-safe password (alphanumeric mixed case)
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const encryptionPassword = Array.from(crypto.randomBytes(32))
                .map(byte => chars[byte % chars.length])
                .join('');

            console.log(`[BackupService] Starting backup: ${backupName}`);
            const zipCmd = `zip -r -q -P "${encryptionPassword}" "${tempZipPath}" .`;
            await new Promise((resolve, reject) => {
                exec(zipCmd, { cwd: serverDir }, (error, stdout, stderr) => {
                    if (error) {
                        const isWarning = stderr && stderr.includes('zip warning');
                        const zipExists = fs.existsSync(tempZipPath);

                        if (isWarning && zipExists) {
                            console.warn(`[BackupService] Zip completed with warnings: ${stderr}`);
                            resolve();
                        } else if (error.code === 12) {
                            reject(new Error('Zip failed: Server directory has no compressable files.'));
                        } else {
                            reject(new Error(`Zip failed (Code ${error.code}): ${stderr || error.message}`));
                        }
                    } else {
                        resolve();
                    }
                });
            });
            const stats = fs.statSync(tempZipPath);
            const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

            const provider = minecraftService.config?.backupProvider || 'buzzheavier';

            if (provider === 'buzzheavier') {
                console.log(`[BackupService] Uploading to Buzzheavier...`);
                const noteParam = notes ? `?note=${encodeURIComponent(Buffer.from(notes).toString('base64'))}` : '';
                const accountToken = minecraftService.config?.buzzheavierToken || process.env.BUZZHEAVIER_ACCOUNT_ID || '';
                const authHeader = accountToken ? `-H "Authorization: Bearer ${accountToken}"` : '';

                const selectedDomain = minecraftService.config?.buzzheavierDomain || 'bzzhr.co';
                const primaryDomain = selectedDomain.startsWith('w.') ? selectedDomain : `w.${selectedDomain}`;
                const allDomains = ['w.bzzhr.co', 'w.bzzhr.to', 'w.buzzheavier.com'];
                const domains = [primaryDomain, ...allDomains.filter(d => d !== primaryDomain)];

                let curlOutput = null;
                let lastErr = null;

                for (const domain of domains) {
                    const uploadUrl = `https://${domain}/${backupName}${noteParam}`;
                    console.log(`[BackupService] Trying upload to ${domain}...`);
                    const curlCmd = `curl -s -X PUT ${authHeader} -T "${tempZipPath}" "${uploadUrl}"`;

                    try {
                        curlOutput = await new Promise((resolve, reject) => {
                            exec(curlCmd, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 }, (error, stdout, stderr) => {
                                if (error || !stdout) {
                                    reject(new Error(`Domain ${domain} failed: ${stderr || error?.message || 'Empty response'}`));
                                } else {
                                    resolve(stdout);
                                }
                            });
                        });
                        if (curlOutput) break;
                    } catch (err) {
                        console.warn(`[BackupService] ${domain} upload attempt failed:`, err.message);
                        lastErr = err;
                    }
                }

                if (!curlOutput) {
                    throw new Error(`Buzzheavier upload failed across all proxy domains: ${lastErr?.message}`);
                }

                let data;
                try {
                    data = JSON.parse(curlOutput);
                } catch (parseErr) {
                    console.error('[BackupService] Failed to parse Buzzheavier response:', curlOutput);
                    throw new Error(`Invalid response from Buzzheavier: ${curlOutput}`);
                }

                // Extract file ID from .data.id, .id, or .data.fileId
                const fileId = data?.data?.id || data?.id || data?.data?.fileId || data?.fileId || '';

                if (!fileId) {
                    console.error('[BackupService] Buzzheavier raw response:', JSON.stringify(data));
                    throw new Error('Buzzheavier upload failed: No file ID returned in response');
                }

                const cleanDomain = selectedDomain.replace(/^w\./, '');
                const downloadPage = `https://${cleanDomain}/${fileId}`;

                const newBackup = new Backup({
                    fileName: backupName,
                    downloadPage: downloadPage,
                    provider: 'buzzheavier',
                    fileId: fileId,
                    size: fileSize,
                    encryptionPassword: encryptionPassword,
                    notes: notes
                });
                await newBackup.save();
                console.log(`[BackupService] Buzzheavier backup success: ${newBackup.fileName} -> ${newBackup.downloadPage} (File ID: ${fileId})`);
                return newBackup;
            } else {
                console.log(`[BackupService] Uploading to GoFile...`);

                const curlCmd = `curl -s -X POST https://upload.gofile.io/uploadfile -H "Authorization: Bearer ${token}" -F "file=@${tempZipPath}"`;

                let curlOutput;
                try {
                    curlOutput = await new Promise((resolve, reject) => {
                        exec(curlCmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                            if (error) {
                                reject(new Error(`Curl upload failed: ${stderr || error.message}`));
                            } else {
                                resolve(stdout);
                            }
                        });
                    });
                } catch (curlErr) {
                    throw new Error(`Upload failed: ${curlErr.message}`);
                }

                let data;
                try {
                    data = JSON.parse(curlOutput);
                } catch (parseErr) {
                    console.error('[BackupService] Failed to parse curl output:', curlOutput);
                    throw new Error(`Invalid response from GoFile: ${curlOutput}`);
                }

                if (data.status === 'ok') {
                    const newBackup = new Backup({
                        fileName: data.data.fileName || backupName,
                        downloadPage: data.data.downloadPage,
                        provider: 'gofile',
                        guestToken: data.data.guestToken,
                        size: fileSize,
                        encryptionPassword: encryptionPassword,
                        notes: notes
                    });
                    await newBackup.save();
                    console.log(`[BackupService] GoFile backup success: ${newBackup.fileName}`);
                    return newBackup;
                } else {
                    throw new Error(JSON.stringify(data));
                }
            }
        } catch (err) {
            console.error('[BackupService] Backup error:', err);
            throw err;
        } finally {
            if (fs.existsSync(tempZipPath)) {
                try { fs.unlinkSync(tempZipPath); } catch (e) { }
            }
            isBackupInProgress = false;
        }
    },
    initScheduler: async () => {
        console.log('[BackupService] Initializing Scheduler...');
        try {
            let setting = await Settings.findOne({ key: 'backup_config' });
            if (!setting) {
                setting = new Settings({ key: 'backup_config', value: DEFAULT_CONFIG });
                await setting.save();
            }
            BackupService.applySchedule(setting.value);
        } catch (err) {
            console.error('[BackupService] Failed to load settings:', err);
        }
    },
    applySchedule: (config) => {
        if (scheduledTask) {
            scheduledTask.stop();
            scheduledTask = null;
        }
        if (!config.enabled) {
            console.log('[BackupService] Auto-backup is disabled.');
            return;
        }
        if (!cron.validate(config.cronExpression)) {
            console.error(`[BackupService] Invalid cron expression: ${config.cronExpression}`);
            return;
        }
        console.log(`[BackupService] Scheduled auto-backup: ${config.cronExpression} (${config.frequency})`);
        scheduledTask = cron.schedule(config.cronExpression, async () => {
            console.log('[BackupService] Triggering auto-backup...');
            try {
                const now = new Date();
                const date = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
                const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const note = `Auto backup - ${date} ${time}`;

                await BackupService.performBackup(false, note);
            } catch (err) {
                console.error('[BackupService] Auto-backup failure:', err.message);
            }
        });
    },
    getSettings: async () => {
        const setting = await Settings.findOne({ key: 'backup_config' });
        return setting ? setting.value : DEFAULT_CONFIG;
    },
    saveSettings: async (newConfig) => {
        const value = { ...DEFAULT_CONFIG, ...newConfig };
        if (value.enabled && !cron.validate(value.cronExpression)) {
            throw new Error('Invalid cron expression');
        }
        await Settings.findOneAndUpdate(
            { key: 'backup_config' },
            { value },
            { upsert: true, new: true }
        );
        BackupService.applySchedule(value);
        return value;
    }
};
module.exports = BackupService;
