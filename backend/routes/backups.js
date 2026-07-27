const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { auth, checkPermission } = require('../middleware');
const minecraftService = require('../services/minecraftService');
const backupService = require('../services/backupService');
const Backup = require('../models/Backup');

let isRestoreInProgress = false;

router.get('/status', auth, (req, res) => {
    res.json({
        isBackupInProgress: backupService.isBackupInProgress(),
        isRestoreInProgress
    });
});

router.post('/:id/restore', auth, checkPermission('backups.restore'), async (req, res) => {
    if (backupService.isBackupInProgress() || isRestoreInProgress) {
        return res.status(409).json({ message: 'A backup or restore operation is already in progress.' });
    }
    // ... rest of restore logic
    // NOTE: keeping restore logic same, just truncated for replace block efficiency if viewing same content
    let downloadPath = null;
    try {
        const backup = await Backup.findById(req.params.id);
        if (!backup) return res.status(404).json({ message: 'Backup not found' });

        isRestoreInProgress = true;
        minecraftService.isOperationLocked = true;
        console.log(`Starting restore for ${backup.fileName}...`);

        if (minecraftService.status !== 'offline') {
            console.log('Stopping server for restore...');
            minecraftService.stop();
            let retries = 30;
            while (minecraftService.status !== 'offline' && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries--;
            }
            if (minecraftService.status !== 'offline') {
                throw new Error('Failed to stop server. Restore aborted.');
            }
        }

        const serverDir = minecraftService.serverDir;
        console.log('Wiping server directory contents...');
        if (fs.existsSync(serverDir)) {
            // Delete content inside instead of the folder itself to avoid EBUSY/EACCES on volume root
            fs.readdirSync(serverDir).forEach(file => {
                const curPath = path.join(serverDir, file);
                fs.rmSync(curPath, { recursive: true, force: true });
            });
        } else {
            fs.mkdirSync(serverDir, { recursive: true });
        }

        const tempDir = process.env.TEMP_BACKUP_PATH || path.resolve(__dirname, '../../tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        downloadPath = path.resolve(tempDir, `restore-${backup.fileName}`);
        if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);

        const isBuzzheavier = backup.provider === 'buzzheavier' || backup.downloadPage.includes('bzzhr') || backup.downloadPage.includes('buzzheavier');

        if (isBuzzheavier) {
            const accountToken = minecraftService.config?.buzzheavierToken || process.env.BUZZHEAVIER_ACCOUNT_ID || '';
            const selectedDomain = minecraftService.config?.buzzheavierDomain || 'bzzhr.co';
            const cleanDomain = selectedDomain.replace(/^w\./, '');
            const fileId = backup.fileId || backup.downloadPage.split('/').pop();
            const downloadUrl = `https://w.${cleanDomain}/${fileId}`;

            console.log(`Starting Buzzheavier download for file ID ${fileId} from ${downloadUrl}...`);

            const headers = { 'User-Agent': 'ObsidianPanel/1.0' };
            if (accountToken) headers['Authorization'] = `Bearer ${accountToken}`;

            const downloadRes = await fetch(downloadUrl, { headers });
            if (!downloadRes.ok) throw new Error(`Buzzheavier Download failed: HTTP ${downloadRes.status}`);

            const fileStream = fs.createWriteStream(downloadPath);
            await new Promise((resolve, reject) => {
                if (downloadRes.body) {
                    const { Readable } = require('stream');
                    Readable.fromWeb(downloadRes.body).pipe(fileStream);
                    fileStream.on('finish', resolve);
                    fileStream.on('error', reject);
                } else {
                    reject(new Error('Buzzheavier download body is empty'));
                }
            });
        } else {
            console.log(`Starting GoFile native download for: ${backup.downloadPage}`);

            let token = minecraftService.config?.gofileToken || backup.guestToken;

            if (!token) {
                console.log("No user or backup token found, attempting guest account creation...");
                const createGuestAccount = async () => {
                    const res = await fetch('https://api.gofile.io/accounts', {
                        method: 'POST',
                        headers: { 'User-Agent': 'ObsidianPanel/1.0', 'Accept': '*/*' }
                    });
                    const json = await res.json();
                    if (json.status !== 'ok') throw new Error('Failed to create guest account');
                    return json.data.token;
                };
                try {
                    token = await createGuestAccount();
                } catch (err) {
                    console.warn("Guest account creation failed/timed out:", err.message);
                }
            }

            const parts = backup.downloadPage.split('/');
            const contentId = parts[parts.length - 1];

            const fetchFolderData = async (id, authToken) => {
                const url = `https://api.gofile.io/contents/${id}?cache=true`;
                const headers = {
                    'Authorization': `Bearer ${authToken}`,
                    'Cookie': `accountToken=${authToken}`,
                    'User-Agent': 'ObsidianPanel/1.0',
                    'X-Website-Token': '4fd6sg89d7s6',
                    'Accept': '*/*'
                };
                const res = await fetch(url, { headers });
                const json = await res.json();
                if (json.status !== 'ok') throw new Error(`GoFile API Error: ${json.status}`);
                return json.data;
            };

            const data = await fetchFolderData(contentId, token);
            if (!data.children) throw new Error('No files found in this content ID');
            const children = Object.values(data.children);
            const targetFile = children.find(f => f.name === backup.fileName);
            if (!targetFile || !targetFile.link) throw new Error(`File ${backup.fileName} not found in GoFile folder`);

            const downloadUrl = targetFile.link;

            const downloadRes = await fetch(downloadUrl, {
                headers: {
                    'Cookie': `accountToken=${token}`,
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'ObsidianPanel/1.0'
                }
            });
            if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

            const fileStream = fs.createWriteStream(downloadPath);
            await new Promise((resolve, reject) => {
                if (downloadRes.body) {
                    const { Readable } = require('stream');
                    Readable.fromWeb(downloadRes.body).pipe(fileStream);
                    fileStream.on('finish', resolve);
                    fileStream.on('error', reject);
                } else {
                    reject(new Error('Download stream failed'));
                }
            });
        }

        let unzipCmd = `unzip -o -q "${downloadPath}" -d "${serverDir}"`;
        if (backup.encryptionPassword) {
            unzipCmd = `unzip -o -q -P "${backup.encryptionPassword}" "${downloadPath}" -d "${serverDir}"`;
        }

        await new Promise((resolve, reject) => {
            exec(unzipCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Unzip failed: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });

        if (!fs.existsSync(minecraftService.jarFile)) {
            console.warn('Warning: Server JAR missing after restore. You may need to reinstall version.');
        } else {
            try { fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true'); } catch (e) { }
        }

        res.json({ success: true, message: 'Server restored successfully.' });

    } catch (err) {
        console.error('Restore Error:', err);
        res.status(500).json({ message: err.message || 'Restore failed' });
    } finally {
        if (downloadPath && fs.existsSync(downloadPath)) {
            try { fs.unlinkSync(downloadPath); } catch (e) { }
        }
        isRestoreInProgress = false;
        minecraftService.isOperationLocked = false;
    }
});

router.get('/', auth, checkPermission('backups.view'), async (req, res) => {
    try {
        const backups = await Backup.find().sort({ createdAt: -1 });
        res.json(backups);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/create', auth, checkPermission('backups.create'), async (req, res) => {
    if (isRestoreInProgress) {
        return res.status(409).json({ message: 'Cannot create backup while restore is in progress.' });
    }
    try {
        const { notes } = req.body;
        const backup = await backupService.performBackup(true, notes);
        res.json(backup);
    } catch (err) {
        if (err.message === 'Backup already in progress') {
            return res.status(409).json({ message: err.message });
        }
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id/notes', auth, checkPermission('backups.create'), async (req, res) => {
    try {
        const { notes } = req.body;
        const backup = await Backup.findByIdAndUpdate(req.params.id, { notes }, { new: true });
        if (!backup) return res.status(404).json({ message: 'Backup not found' });
        res.json(backup);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/config', auth, checkPermission('backups.settings'), async (req, res) => {
    try {
        const settings = await backupService.getSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/config', auth, checkPermission('backups.settings'), async (req, res) => {
    try {
        const newSettings = await backupService.saveSettings(req.body);
        res.json(newSettings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', auth, checkPermission('backups.delete'), async (req, res) => {
    try {
        const backup = await Backup.findById(req.params.id);
        if (!backup) return res.status(404).json({ message: 'Backup not found' });
        await Backup.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
