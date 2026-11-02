const express = require('express');
const router = express.Router();
const { exec, execSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const minecraftService = require('../services/minecraftService');
const rconService = require('../services/rconService');
const sleepModeService = require('../services/sleepModeService');
const { auth, checkPermission } = require('../middleware');

const get7zBinary = () => {
    try {
        execSync('which 7z', { stdio: 'ignore' });
        return '7z';
    } catch (e) {
        try {
            execSync('which 7za', { stdio: 'ignore' });
            return '7za';
        } catch (e2) {
            return '7z';
        }
    }
};

router.get('/status', auth, (req, res) => {
    res.json(minecraftService.getStatus());
});

// Returns the deployment's public IP using ifconfig.me (cached 60s) and server port from server.properties
let _cachedIp = null;
let _cachedIpTime = 0;
router.get('/public-ip', auth, (req, res) => {
    const now = Date.now();
    const port = minecraftService.getServerPort();
    if (_cachedIp && now - _cachedIpTime < 60000) {
        return res.json({ ip: _cachedIp, port });
    }
    execFile('curl', ['-s', 'ipinfo.io/ip'], (error, stdout) => {
        if (error || !stdout.trim()) {
            // Fallback: try ip route to get the local/external-facing IP
            exec("ip route get 8.8.8.8 | awk '{print $7; exit}'", (err2, stdout2) => {
                const ip = (stdout2 || '').trim() || 'Unavailable';
                _cachedIp = ip;
                _cachedIpTime = now;
                res.json({ ip, port });
            });
            return;
        }
        const ip = stdout.trim();
        _cachedIp = ip;
        _cachedIpTime = now;
        res.json({ ip, port });
    });
});

router.post('/action', auth, checkPermission('overview.control'), async (req, res) => {
    const { action } = req.body;
    try {
        switch (action) {
            case 'start':
                minecraftService.start();
                break;
            case 'stop':
                minecraftService.stop();
                break;
            case 'restart':
                await minecraftService.restart();
                break;
            case 'kill':
                minecraftService.kill();
                break;
            case 'sleep':
                if (minecraftService.status === 'online' || minecraftService.status === 'starting') {
                    minecraftService.pushLog('[SleepMode] Server commanded to sleep by administrator. Stopping server gracefully first...');
                    minecraftService.pendingSleep = true;
                    minecraftService.stop();
                } else if (minecraftService.status === 'stopping') {
                    minecraftService.pushLog('[SleepMode] Server is already stopping. Will enter sleep mode upon stop.');
                    minecraftService.pendingSleep = true;
                } else if (minecraftService.status === 'offline') {
                    minecraftService.pushLog('[SleepMode] Server is offline. Activating sleep mode listener...');
                    sleepModeService.startSleepListener();
                }
                break;
            case 'wake':
                if (sleepModeService.isSleeping) {
                    await sleepModeService.wakeUpServer('Administrator');
                } else if (minecraftService.status === 'offline') {
                    await minecraftService.start();
                }
                break;
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Returns online players list fetched silently via Minecraft RCON
router.get('/players', auth, async (req, res) => {
    try {
        if (minecraftService.status === 'online') {
            const players = await rconService.getOnlinePlayers();
            return res.json(players);
        }
        res.json({ count: 0, max: 20, players: [], raw: 'Server offline' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Sleep Mode settings and status
router.get('/sleep-mode', auth, (req, res) => {
    const cfg = minecraftService.config || {};
    res.json({
        sleepModeEnabled: !!cfg.sleepModeEnabled,
        sleepTimeoutMinutes: cfg.sleepTimeoutMinutes || 5,
        sleepingMotd: cfg.sleepingMotd || '§6§lObsidian Server §7- §eSleeping\n§a✦ Join the server to wake it up! ✦',
        startingMotd: cfg.startingMotd || '§e§lObsidian Server §7- §6Starting up...\n§fPlease wait, server will be ready shortly!',
        wakeKickMessage: cfg.wakeKickMessage || '§e[Server Starting] §fServer is waking up!\n§7Please rejoin in ~30 seconds.',
        isSleeping: Boolean(sleepModeService.isSleeping),
        rconPort: cfg.rconPort || 0,
        rconSilent: true
    });
});

// Update Sleep Mode settings
router.post('/sleep-mode', auth, checkPermission('sleep.manage', 'settings.edit', 'overview.control'), async (req, res) => {
    try {
        const {
            sleepModeEnabled,
            sleepTimeoutMinutes,
            sleepingMotd,
            startingMotd,
            wakeKickMessage
        } = req.body;

        const updateData = {};
        if (typeof sleepModeEnabled === 'boolean') updateData.sleepModeEnabled = sleepModeEnabled;
        if (typeof sleepTimeoutMinutes === 'number' && sleepTimeoutMinutes > 0) {
            updateData.sleepTimeoutMinutes = Math.max(1, Math.min(1440, Math.floor(sleepTimeoutMinutes)));
        }
        if (typeof sleepingMotd === 'string') updateData.sleepingMotd = sleepingMotd;
        if (typeof startingMotd === 'string') updateData.startingMotd = startingMotd;
        if (typeof wakeKickMessage === 'string') updateData.wakeKickMessage = wakeKickMessage;

        await minecraftService.saveConfig(updateData);

        // Adjust sleep listener based on new setting
        if (updateData.sleepModeEnabled === false && sleepModeService.isSleeping) {
            await sleepModeService.stopSleepListener();
        } else if (updateData.sleepModeEnabled === true && (minecraftService.status === 'offline' || minecraftService.status === 'starting') && !sleepModeService.isSleeping) {
            sleepModeService.startSleepListener();
        }

        res.json({
            success: true,
            status: minecraftService.getStatus()
        });
    } catch (err) {
        console.error('[Control] Error saving sleep-mode settings:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/command', auth, checkPermission('console.command'), (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ message: 'Command required' });
    }
    minecraftService.sendCommand(command);
    res.json({ success: true });
});

router.post('/install', auth, checkPermission('settings.edit'), async (req, res) => {
    const { version } = req.body;
    console.log("Install request received. Body:", req.body);
    console.log("Installing version:", version);
    try {
        await minecraftService.install(version);
        if (!res.headersSent) {
            res.json({ message: 'Installation started' });
        }
    } catch (err) {
        console.error("Install failed:", err);
        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
    }
});

router.get('/versions', auth, async (req, res) => {
    try {
        const versions = await minecraftService.getAvailableVersions();
        res.json(versions);
    } catch (err) {
        console.error("Failed to fetch versions:", err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/config', auth, checkPermission('settings.edit'), (req, res) => {
    try {
        console.log("Received config update request:", req.body);
        minecraftService.saveConfig(req.body);
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET Server Properties (In-Game Settings)
router.get('/properties', auth, checkPermission('game.view', 'game.edit', 'settings.view', 'settings.edit'), (req, res) => {
    try {
        const propPath = path.join(minecraftService.serverDir, 'server.properties');
        if (!fs.existsSync(propPath)) {
            return res.json({});
        }
        const content = fs.readFileSync(propPath, 'utf8');
        const properties = {};
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const parts = trimmed.split('=');
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                properties[key] = val;
            }
        });
        res.json(properties);
    } catch (err) {
        console.error('Failed to read server.properties:', err);
        res.status(500).json({ message: err.message });
    }
});

// SAVE Server Properties (In-Game Settings)
router.post('/properties', auth, checkPermission('game.edit', 'settings.edit'), (req, res) => {
    try {
        const { properties } = req.body;
        if (!properties || typeof properties !== 'object') {
            return res.status(400).json({ message: 'Properties object required' });
        }

        const propPath = path.join(minecraftService.serverDir, 'server.properties');
        let lines = [];
        if (fs.existsSync(propPath)) {
            lines = fs.readFileSync(propPath, 'utf8').split(/\r?\n/);
        }

        const updatedKeys = new Set();
        const newLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const key = trimmed.split('=')[0].trim();
                if (key in properties) {
                    updatedKeys.add(key);
                    return `${key}=${properties[key]}`;
                }
            }
            return line;
        });

        // Append any new properties not originally present
        Object.keys(properties).forEach(key => {
            if (!updatedKeys.has(key)) {
                newLines.push(`${key}=${properties[key]}`);
            }
        });

        fs.writeFileSync(propPath, newLines.join('\n'), 'utf8');
        minecraftService.broadcast('status', minecraftService.getStatus());
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to save server.properties:', err);
        res.status(500).json({ message: err.message });
    }
});
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use a temp dir in the server directory to avoid /tmp partition size limits
        const tempDir = path.join(minecraftService.serverDir, '.temp_uploads');
        if (!fs.existsSync(tempDir)) {
            try {
                fs.mkdirSync(tempDir, { recursive: true });
            } catch (e) {
                console.error("Failed to create temp upload dir:", e);
                return cb(e);
            }
        }
        cb(null, tempDir);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: Infinity } // Explicitly remove file size limit
});
const getSafePath = (reqPath) => {
    const serverDir = path.resolve(minecraftService.serverDir);
    const cleanRel = (reqPath || '').replace(/^(\/|\\)+/, '');
    const targetPath = path.resolve(serverDir, cleanRel);
    const rel = path.relative(serverDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('Access denied: Invalid path');
    }
    return targetPath;
};
const jarMetadataService = require('../services/jarMetadataService');

router.post('/files/list', auth, checkPermission('files.view'), async (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) {
            return res.json([]);
        }
        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        const rawFiles = entries.map(entry => {
            let size = '-';
            let sizeBytes = 0;
            let modified = null;
            if (entry.isFile()) {
                try {
                    const stats = fs.statSync(path.join(targetPath, entry.name));
                    sizeBytes = stats.size;
                    modified = stats.mtime;
                    if (stats.size < 1024) size = stats.size + ' B';
                    else if (stats.size < 1024 * 1024) size = (stats.size / 1024).toFixed(1) + ' KB';
                    else size = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
                } catch (e) { }
            } else if (entry.isDirectory()) {
                try {
                    const stats = fs.statSync(path.join(targetPath, entry.name));
                    modified = stats.mtime;
                    const subFiles = fs.readdirSync(path.join(targetPath, entry.name));
                    size = `${subFiles.length} item${subFiles.length !== 1 ? 's' : ''}`;
                } catch (e) {
                    size = 'Unknown';
                }
            }
            return {
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: size,
                sizeBytes: sizeBytes,
                modified: modified
            };
        });

        // Enrich jar files with plugin/mod metadata
        const filesWithMetadata = await jarMetadataService.enrichFilesWithJarMetadata(targetPath, rawFiles);

        filesWithMetadata.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        res.json(filesWithMetadata);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/read', auth, checkPermission('files.view'), (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ message: 'File not found' });
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/save', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, content } = req.body;
        const targetPath = getSafePath(relPath);
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/download', auth, checkPermission('files.view'), (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ message: 'File not found' });
        }
        res.download(targetPath, path.basename(targetPath), (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Download failed' });
                }
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
const uploadMiddleware = upload.single('file');

// Chunked Upload Handler
router.post('/files/upload-chunk', auth, checkPermission('files.upload'), (req, res) => {
    uploadMiddleware(req, res, async function (err) {
        if (err) {
            console.error(`[ChunkUpload] Multer error:`, err);
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        }

        try {
            if (!req.file) return res.status(400).json({ message: 'No chunk uploaded' });

            const { path: relPath, fileName, chunkIndex, totalChunks } = req.body;
            const index = parseInt(chunkIndex);
            const total = parseInt(totalChunks);

            // Validate inputs
            if (!fileName || isNaN(index) || isNaN(total)) {
                return res.status(400).json({ message: 'Missing chunk metadata' });
            }

            // Define paths
            const tempDir = path.join(minecraftService.serverDir, '.temp_uploads');
            const partFilePath = path.join(tempDir, `${fileName}.part`);
            const chunkPath = req.file.path;

            // Ensure temp dir exists (redundant if multer made it, but safe)
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            // Append chunk to .part file
            const chunkBuffer = await fs.promises.readFile(chunkPath);

            // If first chunk, overwrite/create new. Else append.
            if (index === 0) {
                await fs.promises.writeFile(partFilePath, chunkBuffer);
            } else {
                await fs.promises.appendFile(partFilePath, chunkBuffer);
            }

            // Delete the temp chunk file created by Multer
            await fs.promises.unlink(chunkPath);

            // Check if this was the last chunk
            if (index === total - 1) {
                const targetDir = getSafePath(relPath);
                const targetPath = path.join(targetDir, fileName);

                console.log(`[ChunkUpload] Finalizing file: ${targetPath}`);

                // Move .part file to final destination
                await fs.promises.rename(partFilePath, targetPath);
                return res.json({ success: true, completed: true });
            }

            res.json({ success: true, chunkIndex: index });

        } catch (err) {
            console.error("[ChunkUpload] Error:", err);
            // Try to cleanup current chunk
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { }
            }
            res.status(500).json({ message: err.message });
        }
    });
});

// Cancel Chunked Upload Handler & Cleanup .part file
router.post('/files/upload-cancel', auth, checkPermission('files.upload'), async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({ message: 'Missing fileName' });
        }
        const safeName = path.basename(fileName);
        const tempDir = path.join(minecraftService.serverDir, '.temp_uploads');
        const partFilePath = path.join(tempDir, `${safeName}.part`);
        if (fs.existsSync(partFilePath)) {
            try {
                await fs.promises.unlink(partFilePath);
                console.log(`[ChunkUpload] Cleaned up cancelled upload: ${partFilePath}`);
            } catch (err) {
                console.warn(`[ChunkUpload] Failed to delete cancelled part file: ${err.message}`);
            }
        }
        res.json({ success: true, message: 'Upload cancelled and temporary files removed' });
    } catch (err) {
        console.error('[ChunkUpload] Cancel error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Async upload handler to prevent event loop blocking
router.post('/files/upload', auth, checkPermission('files.upload'), (req, res) => {
    console.log(`[Upload] Request received for: ${req.body.path}`);
    uploadMiddleware(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            console.error(`[Upload] Multer error: ${err.message}`, err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large' });
            }
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            console.error(`[Upload] Unknown error: ${err.message}`, err);
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        }

        try {
            if (!req.file) {
                console.error("[Upload] No file in request");
                return res.status(400).json({ message: 'No file uploaded' });
            }

            console.log(`[Upload] File received: ${req.file.originalname} (${req.file.size} bytes) at ${req.file.path}`);
            const { path: relPath } = req.body;
            const targetDir = getSafePath(relPath);
            const tempPath = req.file.path;
            const targetPath = path.join(targetDir, req.file.originalname);

            console.log(`[Upload] Moving from ${tempPath} to ${targetPath}`);

            try {
                // Use async rename to avoid blocking event loop for large files
                await fs.promises.rename(tempPath, targetPath);
                console.log("[Upload] Move successful");
            } catch (error) {
                console.error(`[Upload] Move failed: ${error.message}`);
                if (error.code === 'EXDEV') {
                    // Fallback for cross-device move (though unlikely with our setup)
                    await fs.promises.copyFile(tempPath, targetPath);
                    await fs.promises.unlink(tempPath);
                } else {
                    throw error;
                }
            }
            res.json({ success: true });
        } catch (err) {
            console.error("[Upload] Handler error:", err);
            // Clean up temp file if exists
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { }
            }
            res.status(500).json({ message: err.message });
        }
    });
});

router.post('/files/create', auth, checkPermission('files.upload'), (req, res) => {
    try {
        const { path: relPath, name, type } = req.body;
        const currentDir = getSafePath(relPath);
        const targetPath = path.join(currentDir, name);
        if (type === 'folder') {
            fs.mkdirSync(targetPath);
        } else {
            fs.writeFileSync(targetPath, '', 'utf8');
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/extract', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, password } = req.body;
        const targetPath = getSafePath(relPath);
        const parentDir = path.dirname(targetPath);
        const lowerPath = targetPath.toLowerCase();

        const bin7z = get7zBinary();
        const pw = password ? String(password) : '';

        const handleExtractionResult = (error, stdout, stderr) => {
            if (error) {
                const combined = ((stdout || '') + (stderr || '') + (error.message || '')).toLowerCase();

                if (error.killed || error.signal === 'SIGTERM') {
                    return res.status(500).json({ message: 'Extraction timed out after 120 seconds.' });
                }

                // Detect wrong / missing password across unzip, 7z, and unrar output
                const isWrongPw =
                    combined.includes('wrong password') ||
                    combined.includes('incorrect password') ||
                    combined.includes('bad password') ||
                    combined.includes('wrong passphrase') ||
                    combined.includes('skipping') ||
                    combined.includes('need pk compat') ||
                    combined.includes('data error') ||
                    combined.includes('cannot open encrypted') ||
                    combined.includes('password protected');

                if (isWrongPw) {
                    return res.status(401).json({ message: 'Extraction failed: incorrect or missing password.' });
                }

                console.error(`Extraction error:`, error.message, stderr);
                const detail = (stderr || stdout || error.message || 'Make sure 7z or unzip is installed.').trim();
                return res.status(500).json({ message: `Extraction failed: ${detail}` });
            }
            res.json({ success: true });
        };

        if (lowerPath.endsWith('.zip')) {
            // Try 7z / 7za first, fallback to unzip
            const args7z = ['x', '-y', '-bse1', `-p${pw}`, targetPath, `-o${parentDir}`];
            execFile(bin7z, args7z, { timeout: 120000, maxBuffer: 1024 * 1024 * 5 }, (err7z, stdout7z, stderr7z) => {
                if (!err7z) {
                    return res.json({ success: true });
                }
                const unzipArgs = ['-o'];
                if (pw) unzipArgs.push('-P', pw);
                unzipArgs.push(targetPath, '-d', parentDir);
                execFile('unzip', unzipArgs, { timeout: 120000, maxBuffer: 1024 * 1024 * 5 }, (errUnzip, stdoutU, stderrU) => {
                    handleExtractionResult(errUnzip, (stdout7z || '') + (stdoutU || ''), (stderr7z || '') + (stderrU || ''));
                });
            });
        } else if (lowerPath.endsWith('.tar.gz') || lowerPath.endsWith('.tgz')) {
            execFile('tar', ['-xzf', targetPath, '-C', parentDir], { timeout: 120000 }, handleExtractionResult);
        } else if (lowerPath.endsWith('.tar.bz2')) {
            execFile('tar', ['-xjf', targetPath, '-C', parentDir], { timeout: 120000 }, handleExtractionResult);
        } else if (lowerPath.endsWith('.tar.xz')) {
            execFile('tar', ['-xJf', targetPath, '-C', parentDir], { timeout: 120000 }, handleExtractionResult);
        } else if (lowerPath.endsWith('.tar')) {
            execFile('tar', ['-xf', targetPath, '-C', parentDir], { timeout: 120000 }, handleExtractionResult);
        } else if (lowerPath.endsWith('.7z') || lowerPath.endsWith('.rar')) {
            const args7z = ['x', '-y', '-bse1', `-p${pw}`, targetPath, `-o${parentDir}`];
            execFile(bin7z, args7z, { timeout: 120000, maxBuffer: 1024 * 1024 * 5 }, handleExtractionResult);
        } else if (lowerPath.endsWith('.gz') && !lowerPath.endsWith('.tar.gz')) {
            execFile('gunzip', ['-k', targetPath], { timeout: 120000 }, handleExtractionResult);
        } else {
            return res.status(400).json({ message: 'Unsupported archive format. Supported: .zip, .tar.gz, .tgz, .tar.bz2, .tar.xz, .tar, .7z, .rar, .gz' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/files/compress', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { files, currentPath, password } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ message: 'No files selected' });
        }

        const safeCurrentDir = getSafePath(currentPath);
        const archiveName = `archive_${Date.now()}.zip`;

        // Validate each filename is purely relative and does not escape current directory
        const safeFileList = [];
        for (const f of files) {
            if (typeof f !== 'string' || !f.trim() || f.includes('/') || f.includes('\\') || f === '.' || f === '..') {
                return res.status(400).json({ message: 'Invalid filename in selection' });
            }
            safeFileList.push(f.trim());
        }

        const zipArgs = ['-r'];
        if (password) {
            zipArgs.push('-P', String(password));
        }
        zipArgs.push(archiveName, ...safeFileList);

        execFile('zip', zipArgs, { cwd: safeCurrentDir, timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Zip error:`, error.message, stderr);
                return res.status(500).json({ message: 'Compression failed. Ensure zip is installed.' });
            }
            res.json({ success: true, archiveName });
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Rename File/Folder
router.post('/files/rename', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, oldName, newName } = req.body;
        // relPath is the folder path (e.g. "plugins") where the file exists
        const currentDir = getSafePath(relPath);

        const oldPath = path.join(currentDir, oldName);
        const newPath = path.join(currentDir, newName);

        // Security check: Ensure new path is still within safe directory
        // Although getSafePath checked currentDir, newName could try ".." traversal
        if (!newPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Invalid new name' });
        }

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ message: 'A file with that name already exists' });
        }

        fs.renameSync(oldPath, newPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Toggle Plugin/Mod (.jar <-> .jar.disabled)
router.post('/files/toggle-jar', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, name } = req.body;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'Filename required' });
        }
        if (!name.endsWith('.jar') && !name.endsWith('.jar.disabled')) {
            return res.status(400).json({ message: 'Only .jar and .jar.disabled files can be toggled' });
        }

        const currentDir = getSafePath(relPath || '');
        const currentPath = path.join(currentDir, name);

        if (!currentPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Invalid path' });
        }

        if (!fs.existsSync(currentPath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        const isCurrentlyDisabled = name.endsWith('.disabled');
        const newName = isCurrentlyDisabled ? name.slice(0, -9) : `${name}.disabled`;
        const newPath = path.join(currentDir, newName);

        if (!newPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Invalid new name' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ message: `A file named "${newName}" already exists` });
        }

        fs.renameSync(currentPath, newPath);
        res.json({
            success: true,
            oldName: name,
            newName,
            enabled: isCurrentlyDisabled
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Move File/Folder into another directory
router.post('/files/move', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, sourceName, targetFolder } = req.body;
        const currentDir = getSafePath(relPath);
        const sourcePath = path.join(currentDir, sourceName);

        let destDir;
        if (targetFolder === '..') {
            destDir = path.dirname(currentDir);
        } else {
            destDir = path.join(currentDir, targetFolder);
        }

        const destPath = path.join(destDir, sourceName);

        if (!sourcePath.startsWith(minecraftService.serverDir) || !destPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Access denied: Invalid path' });
        }

        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ message: 'Source file/folder not found' });
        }

        if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
            return res.status(400).json({ message: 'Target folder does not exist' });
        }

        if (fs.existsSync(destPath)) {
            return res.status(400).json({ message: `"${sourceName}" already exists in target folder` });
        }

        if (sourcePath === destDir || destDir.startsWith(sourcePath + path.sep)) {
            return res.status(400).json({ message: 'Cannot move a folder into itself' });
        }

        fs.renameSync(sourcePath, destPath);
        res.json({ success: true, message: `Moved "${sourceName}" successfully` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Copy File/Folder (with recursive directory copy support)
router.post('/files/copy', auth, checkPermission('files.edit'), async (req, res) => {
    try {
        const { path: relPath, sourceName, targetFolder, newName } = req.body;
        const currentDir = getSafePath(relPath);
        const sourcePath = path.join(currentDir, sourceName);

        let destDir;
        if (!targetFolder || targetFolder === '.') {
            destDir = currentDir;
        } else if (targetFolder === '..') {
            destDir = path.dirname(currentDir);
        } else {
            destDir = path.join(currentDir, targetFolder);
        }

        let destFileName = newName ? newName.trim() : sourceName;
        if (destDir === currentDir && !newName) {
            const parsed = path.parse(sourceName);
            destFileName = parsed.ext ? `${parsed.name}_copy${parsed.ext}` : `${parsed.name}_copy`;
        }

        const destPath = path.join(destDir, destFileName);

        if (!sourcePath.startsWith(minecraftService.serverDir) || !destPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Access denied: Invalid path' });
        }

        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ message: 'Source file/folder not found' });
        }

        if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
            return res.status(400).json({ message: 'Target directory does not exist' });
        }

        if (fs.existsSync(destPath)) {
            return res.status(400).json({ message: `"${destFileName}" already exists in destination` });
        }

        const stats = await fs.promises.stat(sourcePath);
        if (stats.isDirectory()) {
            await fs.promises.cp(sourcePath, destPath, { recursive: true });
        } else {
            await fs.promises.copyFile(sourcePath, destPath);
        }

        res.json({ success: true, message: `Copied "${sourceName}" to "${destFileName}"` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.post('/files/delete', auth, checkPermission('files.delete'), (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        if (!fs.existsSync(targetPath)) {
            return res.json({ success: true });
        }
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/files/batch-delete', auth, checkPermission('files.delete'), (req, res) => {
    try {
        const { path: relPath, items } = req.body;
        const baseDir = getSafePath(relPath);
        const itemList = Array.isArray(items) ? items : [items];

        let successCount = 0;
        let failCount = 0;

        for (const item of itemList) {
            try {
                const targetPath = path.join(baseDir, item);
                if (!targetPath.startsWith(minecraftService.serverDir)) {
                    failCount++;
                    continue;
                }
                if (fs.existsSync(targetPath)) {
                    const stats = fs.statSync(targetPath);
                    if (stats.isDirectory()) {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(targetPath);
                    }
                }
                successCount++;
            } catch (err) {
                console.error(`[BatchDelete] Error deleting ${item}:`, err.message);
                failCount++;
            }
        }
        res.json({ success: true, successCount, failCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

let isRemoteDownloadInProgress = false;

// Remote cURL File Download to Server Directory
router.post('/files/remote-download', auth, checkPermission('files.upload'), async (req, res) => {
    if (isRemoteDownloadInProgress) {
        return res.status(409).json({ message: 'Another remote download is currently in progress. Please wait for it to complete.' });
    }

    isRemoteDownloadInProgress = true;
    try {
        const { url, currentPath = '/', filename: customFilename, headers: customHeaders } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'Valid URL is required' });
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return res.status(400).json({ message: 'Only HTTP and HTTPS URLs are supported' });
            }
        } catch {
            return res.status(400).json({ message: 'Invalid URL format provided' });
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
            return res.status(403).json({ message: 'Access to metadata services is forbidden' });
        }

        const baseDir = getSafePath(currentPath || '/');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        // Build array of headers safely for execFile (no shell)
        const headerArgs = [];
        if (customHeaders) {
            let headerLines = [];
            if (typeof customHeaders === 'string') {
                headerLines = customHeaders.split('\n');
            } else if (typeof customHeaders === 'object') {
                headerLines = Object.entries(customHeaders).map(([k, v]) => `${k}: ${v}`);
            }
            for (const line of headerLines) {
                const trimmed = line.trim();
                if (trimmed) {
                    headerArgs.push('-H', trimmed);
                }
            }
        }

        // Determine target filename: user-provided > Content-Disposition > URL path
        let targetFilename = customFilename ? String(customFilename).trim() : '';

        if (!targetFilename) {
            // HEAD request to try and read Content-Disposition header
            try {
                const headOutput = await new Promise((resolve) => {
                    execFile('curl', ['-sI', '-L', ...headerArgs, url], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
                        resolve(stdout || '');
                    });
                });

                // Try to parse Content-Disposition: attachment; filename="..."
                const cdMatch = headOutput.match(/content-disposition:.*filename[*]?=(?:UTF-8''|")?([^"\r\n;]+)/i);
                if (cdMatch && cdMatch[1]) {
                    targetFilename = decodeURIComponent(cdMatch[1].trim().replace(/"/g, ''));
                }
            } catch (e) {
                // HEAD failed silently, fall back below
            }
        }

        // Final fallback: use URL path segment
        if (!targetFilename) {
            try {
                const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
                targetFilename = pathSegments.pop() || 'downloaded_file';
            } catch (e) {
                targetFilename = 'downloaded_file';
            }
        }

        targetFilename = path.basename(targetFilename.replace(/[/\\?%*:|"<>]/g, '_'));
        if (!targetFilename || targetFilename === '.' || targetFilename === '..') {
            targetFilename = 'downloaded_file';
        }

        // Avoid overwriting: if file exists, append (1), (2), ...
        const resolveUniqueFilename = (dir, filename) => {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            let candidate = filename;
            let counter = 1;
            while (fs.existsSync(path.join(dir, candidate))) {
                candidate = `${base} (${counter})${ext}`;
                counter++;
            }
            return candidate;
        };

        targetFilename = resolveUniqueFilename(baseDir, targetFilename);
        const savePath = path.join(baseDir, targetFilename);

        const relCheck = path.relative(minecraftService.serverDir, savePath);
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
            return res.status(403).json({ message: 'Access denied: Target path outside server directory' });
        }

        console.log(`[RemoteDownload] Downloading ${url} -> ${targetFilename}...`);

        const downloadArgs = ['-s', '-S', '-L', ...headerArgs, '-o', savePath, url];

        await new Promise((resolve, reject) => {
            execFile('curl', downloadArgs, { maxBuffer: 1024 * 1024 * 10, timeout: 600000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Download failed: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });

        if (!fs.existsSync(savePath)) {
            throw new Error('Downloaded file was not created. Please check URL and headers.');
        }

        const stats = fs.statSync(savePath);
        console.log(`[RemoteDownload] Download completed: ${targetFilename} (${stats.size} bytes)`);

        res.json({
            success: true,
            message: `Downloaded ${targetFilename} successfully!`,
            filename: targetFilename,
            size: stats.size
        });
    } catch (err) {
        console.error('[RemoteDownload] Error:', err);
        res.status(500).json({ message: err.message || 'Remote download failed' });
    } finally {
        isRemoteDownloadInProgress = false;
    }
});

// ── Server Icon Upload ──────────────────────────────────────────────────────
router.post('/files/server-icon', auth, checkPermission('files.edit'), upload.single('icon'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file uploaded.' });
        }

        const tempPath = req.file.path;
        const iconPath = path.join(minecraftService.serverDir, 'server-icon.png');

        // Use ImageMagick directly via execFile (no shell)
        execFile('convert', [tempPath, '-resize', '64x64!', '-strip', iconPath], { timeout: 15000 }, (error, stdout, stderr) => {
            // Clean up temp file
            try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }

            if (error) {
                console.error('ImageMagick error:', error.message, stderr);
                return res.status(500).json({ message: 'Failed to convert image. Make sure ImageMagick is installed.' });
            }
            res.json({ success: true, message: 'Server icon updated!' });
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET current server icon (base64)
router.get('/files/server-icon', auth, checkPermission('settings.view', 'settings.edit', 'files.view'), (req, res) => {
    try {
        const iconPath = path.join(minecraftService.serverDir, 'server-icon.png');
        if (!fs.existsSync(iconPath)) {
            return res.status(404).json({ message: 'No server icon found.' });
        }
        const data = fs.readFileSync(iconPath);
        const base64 = data.toString('base64');
        res.json({ icon: `data:image/png;base64,${base64}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── Update Plugin / Mod Jar File Directly ──────────────────────────────────
router.post('/files/update-jar', auth, checkPermission('files.edit'), async (req, res) => {
    try {
        const { currentPath, oldFileName, downloadUrl, newFileName } = req.body;
        if (!oldFileName || !downloadUrl) {
            return res.status(400).json({ message: 'oldFileName and downloadUrl are required' });
        }

        const cleanRel = Array.isArray(currentPath) ? currentPath.join('/') : (currentPath || '');
        const targetDir = getSafePath(cleanRel);

        // Security check on download URL
        let parsedUrl;
        try {
            parsedUrl = new URL(downloadUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return res.status(400).json({ message: 'Only HTTP and HTTPS URLs are allowed' });
            }
        } catch {
            return res.status(400).json({ message: 'Invalid download URL format' });
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'localhost' || hostname === '127.0.0.1') {
            return res.status(403).json({ message: 'Forbidden destination host' });
        }

        const effectiveNewFileName = path.basename(newFileName || oldFileName);
        const oldFilePath = path.join(targetDir, path.basename(oldFileName));
        const finalFilePath = path.join(targetDir, effectiveNewFileName);
        const tempFilePath = path.join(targetDir, `.${effectiveNewFileName}.tmp_update_${Date.now()}`);

        const fetchRes = await fetch(downloadUrl, {
            headers: { 'User-Agent': 'ObsidianPanel/2.1' },
            signal: AbortSignal.timeout(90000)
        });

        if (!fetchRes.ok) {
            throw new Error(`Download failed with status ${fetchRes.status}: ${fetchRes.statusText}`);
        }

        const { pipeline } = require('stream/promises');
        const { Readable } = require('stream');
        await pipeline(Readable.fromWeb(fetchRes.body), fs.createWriteStream(tempFilePath));

        const stats = fs.statSync(tempFilePath);
        if (stats.size === 0) {
            fs.unlinkSync(tempFilePath);
            throw new Error('Downloaded jar is 0 bytes');
        }

        // If old file exists and has a different name, delete it to prevent duplicates
        if (fs.existsSync(oldFilePath) && oldFilePath !== finalFilePath) {
            try {
                fs.unlinkSync(oldFilePath);
            } catch (err) {
                console.warn(`[UpdateJar] Failed to unlink old file ${oldFilePath}:`, err.message);
            }
        }

        // Rename temp file to final destination
        fs.renameSync(tempFilePath, finalFilePath);

        // Invalidate jar metadata cache
        jarMetadataService.clearCacheForPath(oldFilePath);
        jarMetadataService.clearCacheForPath(finalFilePath);

        res.json({
            success: true,
            oldFileName,
            newFileName: effectiveNewFileName,
            message: `Successfully updated to ${effectiveNewFileName}`
        });
    } catch (err) {
        console.error('[UpdateJar] Error updating jar:', err);
        res.status(500).json({ message: err.message || 'Failed to update jar file' });
    }
});

module.exports = router;
