const express = require('express');
const router = express.Router();
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const minecraftService = require('../services/minecraftService');
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

// Returns the deployment's public IP using ifconfig.me (cached 60s)
let _cachedIp = null;
let _cachedIpTime = 0;
router.get('/public-ip', auth, (req, res) => {
    const now = Date.now();
    if (_cachedIp && now - _cachedIpTime < 60000) {
        return res.json({ ip: _cachedIp });
    }
    exec('curl -s ipinfo.io/ip', (error, stdout) => {
        if (error || !stdout.trim()) {
            // Fallback: try ip route to get the local/external-facing IP
            exec("ip route get 8.8.8.8 | awk '{print $7; exit}'", (err2, stdout2) => {
                const ip = (stdout2 || '').trim() || 'Unavailable';
                _cachedIp = ip;
                _cachedIpTime = now;
                res.json({ ip });
            });
            return;
        }
        const ip = stdout.trim();
        _cachedIp = ip;
        _cachedIpTime = now;
        res.json({ ip });
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
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        res.json(minecraftService.getStatus());
    } catch (err) {
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
router.get('/properties', auth, (req, res) => {
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
router.post('/properties', auth, checkPermission('settings.edit'), (req, res) => {
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
    const serverDir = minecraftService.serverDir;
    const targetPath = path.join(serverDir, reqPath || '');
    if (!targetPath.startsWith(serverDir)) {
        throw new Error('Access denied: Invalid path');
    }
    return targetPath;
};
router.post('/files/list', auth, checkPermission('files.view'), (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) {
            return res.json([]);
        }
        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        const files = entries.map(entry => {
            let size = '-';
            if (entry.isFile()) {
                const stats = fs.statSync(path.join(targetPath, entry.name));
                if (stats.size < 1024) size = stats.size + ' B';
                else if (stats.size < 1024 * 1024) size = (stats.size / 1024).toFixed(1) + ' KB';
                else size = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
            } else if (entry.isDirectory()) {
                try {
                    const subFiles = fs.readdirSync(path.join(targetPath, entry.name));
                    size = `${subFiles.length} item${subFiles.length !== 1 ? 's' : ''}`;
                } catch (e) {
                    size = 'Unknown';
                }
            }
            return {
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: size
            };
        });
        files.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        res.json(files);
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

        // Sanitize password for shell usage
        const pw = (password || '').replace(/'/g, "'\\''");

        // Helper: build a 7z command that never interacts with stdin
        // -y = assume yes on all prompts
        // -bse1 = redirect stderr → stdout (so we capture everything)
        // -p= always set password (empty string if none) — 7z fails fast rather than prompting
        // < /dev/null = hard-block any stdin read
        const bin7z = get7zBinary();
        const make7zCmd = (extraFlags = '') =>
            `${bin7z} x -y -bse1 -p'${pw}' ${extraFlags} "${targetPath}" -o"${parentDir}" < /dev/null`;

        let cmd;

        if (lowerPath.endsWith('.zip')) {
            // Try 7z / 7za first, fallback to unzip
            cmd = `${make7zCmd()} || unzip -o -P '${pw}' "${targetPath}" -d "${parentDir}" < /dev/null`;
        } else if (lowerPath.endsWith('.tar.gz') || lowerPath.endsWith('.tgz')) {
            // tar archives are never encrypted — no password flag needed
            cmd = `tar -xzf "${targetPath}" -C "${parentDir}"`;
        } else if (lowerPath.endsWith('.tar.bz2')) {
            cmd = `tar -xjf "${targetPath}" -C "${parentDir}"`;
        } else if (lowerPath.endsWith('.tar.xz')) {
            cmd = `tar -xJf "${targetPath}" -C "${parentDir}"`;
        } else if (lowerPath.endsWith('.tar')) {
            cmd = `tar -xf "${targetPath}" -C "${parentDir}"`;
        } else if (lowerPath.endsWith('.7z') || lowerPath.endsWith('.rar')) {
            cmd = make7zCmd();
        } else if (lowerPath.endsWith('.gz') && !lowerPath.endsWith('.tar.gz')) {
            // Single .gz file — no password support in gzip
            cmd = `gunzip -k "${targetPath}"`;
        } else {
            return res.status(400).json({ message: 'Unsupported archive format. Supported: .zip, .tar.gz, .tgz, .tar.bz2, .tar.xz, .tar, .7z, .rar, .gz' });
        }

        // 120-second timeout — hard-kill any process that hangs
        exec(cmd, { timeout: 120000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
            if (error) {
                // Merge all output for pattern matching
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
                    combined.includes('data error') ||       // 7z reports this for wrong pw on .7z
                    combined.includes('cannot open encrypted') ||
                    combined.includes('password protected');

                if (isWrongPw) {
                    return res.status(401).json({ message: 'Extraction failed: incorrect or missing password.' });
                }

                console.error(`Extraction error:`, error.message, stderr);
                const detail = (stderr || stdout || error.message || 'Make sure 7z (p7zip/7zip) is installed.').trim();
                return res.status(500).json({ message: `Extraction failed: ${detail}` });
            }
            res.json({ success: true });
        });
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

        // Escape filenames for shell command
        const fileArgs = files.map(f => `"${f}"`).join(' ');

        // Use -P flag for password encryption
        const pwFlag = password ? `-P "${password.replace(/"/g, '\\"')}"` : '';
        const cmd = `cd "${safeCurrentDir}" && zip -r ${pwFlag} "${archiveName}" ${fileArgs}`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Zip error: ${error}`);
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

        if (!url || !url.startsWith('http')) {
            return res.status(400).json({ message: 'Valid HTTP/HTTPS URL is required' });
        }

        const baseDir = getSafePath(currentPath || '/');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        // Build header args helper (used for both HEAD and GET)
        const buildHeaderArgs = (customHeaders) => {
            let headerArgs = '';
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
                        const escaped = trimmed.replace(/"/g, '\\"');
                        headerArgs += ` -H "${escaped}"`;
                    }
                }
            }
            return headerArgs;
        };

        const headerArgs = buildHeaderArgs(customHeaders);

        // Determine target filename: user-provided > Content-Disposition > URL path
        let targetFilename = customFilename ? customFilename.trim() : '';

        if (!targetFilename) {
            // HEAD request to try and read Content-Disposition header
            try {
                const headOutput = await new Promise((resolve) => {
                    exec(`curl -sI -L ${headerArgs} "${url}"`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
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
                const parsedUrl = new URL(url);
                const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
                targetFilename = pathSegments.pop() || 'downloaded_file';
            } catch (e) {
                targetFilename = 'downloaded_file';
            }
        }

        targetFilename = targetFilename.replace(/[/\\?%*:|"<>]/g, '_');

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

        if (!savePath.startsWith(minecraftService.serverDir)) {
            return res.status(403).json({ message: 'Access denied: Target path outside server directory' });
        }

        console.log(`[RemoteDownload] Downloading ${url} -> ${targetFilename}...`);

        const curlCmd = `curl -s -S -L ${headerArgs} -o "${savePath}" "${url}"`;

        await new Promise((resolve, reject) => {
            exec(curlCmd, { maxBuffer: 1024 * 1024 * 10, timeout: 600000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`cURL download failed: ${stderr || error.message}`));
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

        // Use ImageMagick to resize to exactly 64x64, force PNG output
        const cmd = `convert "${tempPath}" -resize 64x64! -strip "${iconPath}"`;

        exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
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
router.get('/files/server-icon', auth, (req, res) => {
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

module.exports = router;
