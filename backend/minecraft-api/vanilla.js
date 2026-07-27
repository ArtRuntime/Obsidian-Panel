const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const USER_AGENT = 'ObsidianPanel/1.0 (MinecraftAPI)';

/**
 * Fetches available Minecraft versions directly from Mojang's official manifest.
 * Caches the result in a local file for 1 hour.
 */
async function getAvailableVersions() {
    const cacheFile = path.join(os.tmpdir(), 'obsidian_versions_cache.json');
    let cachedVersions = null;

    try {
        if (fs.existsSync(cacheFile)) {
            const data = fs.readFileSync(cacheFile, 'utf8');
            cachedVersions = JSON.parse(data);
            if (!Array.isArray(cachedVersions)) cachedVersions = null;
        }
    } catch (e) {
        console.error('[VanillaAPI] Failed to read version cache:', e.message);
    }

    const fetchAndCache = () => new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        };

        const req = https.get(MOJANG_MANIFEST_URL, options, (res) => {
            if (res.statusCode >= 400) {
                return reject(new Error(`Mojang API error: HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const versions = (parsed.versions || []).map(v => ({
                        id: v.id,
                        type: v.type || 'release'
                    }));
                    fs.writeFileSync(cacheFile, JSON.stringify(versions, null, 2));
                    resolve(versions);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Mojang manifest fetch timed out')); });
    });

    if (cachedVersions) {
        fetchAndCache().catch(err => console.error('[VanillaAPI] Background cache refresh error:', err.message));
        return cachedVersions;
    }

    return await fetchAndCache();
}

/**
 * Resolves the latest official Minecraft release version.
 */
async function getLatestReleaseVersion() {
    try {
        const versions = await getAvailableVersions();
        const latestRelease = versions.find(v => v.type === 'release');
        return latestRelease ? latestRelease.id : '1.21.4';
    } catch (e) {
        console.error('[VanillaAPI] Failed to resolve latest release version:', e.message);
        return '1.21.4';
    }
}

/**
 * Resolves the official Vanilla server JAR download URL from Mojang.
 */
async function getVanillaUrl(version) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        };

        const req = https.get(MOJANG_MANIFEST_URL, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let vEntry = (parsed.versions || []).find(v => v.id === version);
                    if (!vEntry) {
                        const fallbackVersion = parsed.latest?.release || '1.20.4';
                        console.warn(`[VanillaAPI] Version ${version} not found in Mojang manifest, falling back to latest release (${fallbackVersion})`);
                        vEntry = (parsed.versions || []).find(v => v.id === fallbackVersion) || parsed.versions?.[0];
                    }
                    if (!vEntry) {
                        return reject(new Error(`No valid Minecraft versions found in Mojang manifest`));
                    }

                    const pkgReq = https.get(vEntry.url, { ...options, timeout: 10000 }, (pkgRes) => {
                        let pkgData = '';
                        pkgRes.on('data', chunk => pkgData += chunk);
                        pkgRes.on('end', () => {
                            try {
                                const pkgParsed = JSON.parse(pkgData);
                                const serverUrl = pkgParsed.downloads?.server?.url;
                                if (!serverUrl) return reject(new Error(`No server download available for Vanilla ${version}`));
                                resolve(serverUrl);
                            } catch (e) { reject(e); }
                        });
                    });

                    pkgReq.on('error', reject);
                    pkgReq.on('timeout', () => { pkgReq.destroy(); reject(new Error('Version package fetch timed out')); });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Mojang manifest fetch timed out')); });
    });
}

module.exports = {
    getAvailableVersions,
    getLatestReleaseVersion,
    getVanillaUrl
};
