const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// In-memory cache: filePath -> { mtimeMs, size, info }
const metadataCache = new Map();

/**
 * Computes sha1 and sha256 for a given file.
 */
function computeHashes(filePath) {
    return new Promise((resolve) => {
        try {
            const sha1 = crypto.createHash('sha1');
            const sha256 = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('data', chunk => {
                sha1.update(chunk);
                sha256.update(chunk);
            });
            stream.on('end', () => {
                resolve({
                    sha1: sha1.digest('hex'),
                    sha256: sha256.digest('hex')
                });
            });
            stream.on('error', (err) => {
                console.warn('[JarMetadata] Hash compute error:', err.message);
                resolve(null);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * Extract plugin/mod name and info directly from inside the jar.
 */
function extractManifestInfo(filePath) {
    return new Promise((resolve) => {
        // 1. Try plugin.yml (Bukkit / Spigot / Paper)
        execFile('unzip', ['-p', filePath, 'plugin.yml'], { maxBuffer: 1024 * 512, timeout: 5000 }, (err1, stdout1) => {
            if (!err1 && stdout1) {
                const info = parseYamlBasic(stdout1);
                if (info.name) {
                    return resolve({
                        title: info.name,
                        version: info.version || null,
                        webUrl: info.website || null,
                        description: info.description || null,
                        source: 'Spigot/Paper'
                    });
                }
            }

            // 2. Try paper-plugin.yml
            execFile('unzip', ['-p', filePath, 'paper-plugin.yml'], { maxBuffer: 1024 * 512, timeout: 5000 }, (err2, stdout2) => {
                if (!err2 && stdout2) {
                    const info = parseYamlBasic(stdout2);
                    if (info.name) {
                        return resolve({
                            title: info.name,
                            version: info.version || null,
                            webUrl: info.website || null,
                            description: info.description || null,
                            source: 'Paper'
                        });
                    }
                }

                // 3. Try fabric.mod.json (Fabric / Quilt)
                execFile('unzip', ['-p', filePath, 'fabric.mod.json'], { maxBuffer: 1024 * 512, timeout: 5000 }, (err3, stdout3) => {
                    if (!err3 && stdout3) {
                        try {
                            const json = JSON.parse(stdout3);
                            if (json.name || json.id) {
                                return resolve({
                                    title: json.name || json.id,
                                    version: json.version || null,
                                    webUrl: json.contact?.homepage || json.contact?.sources || null,
                                    description: json.description || null,
                                    source: 'Fabric'
                                });
                            }
                        } catch (e) { }
                    }

                    resolve(null);
                });
            });
        });
    });
}

/**
 * Basic key: value parser for YAML manifests
 */
function parseYamlBasic(yamlStr) {
    const result = {};
    for (const line of yamlStr.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
            const idx = trimmed.indexOf(':');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!result[key] && val) {
                result[key] = val;
            }
        }
    }
    return result;
}

/**
 * Query Modrinth API in bulk by file sha1 hashes
 */
async function queryModrinthByHashes(sha1List) {
    if (!sha1List || !sha1List.length) return {};
    try {
        const res = await fetch('https://api.modrinth.com/v2/version_files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ObsidianPanel/2.1'
            },
            body: JSON.stringify({
                hashes: sha1List,
                algorithm: 'sha1'
            }),
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return {};
        return await res.json();
    } catch (e) {
        console.warn('[JarMetadata] Modrinth version_files lookup skipped/failed:', e.message);
        return {};
    }
}

/**
 * Query Modrinth API in bulk by project IDs
 */
async function queryModrinthProjects(projectIds) {
    if (!projectIds || !projectIds.length) return {};
    try {
        const uniqueIds = Array.from(new Set(projectIds));
        const idsParam = encodeURIComponent(JSON.stringify(uniqueIds));
        const res = await fetch(`https://api.modrinth.com/v2/projects?ids=${idsParam}`, {
            headers: { 'User-Agent': 'ObsidianPanel/2.1' },
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return {};
        const projects = await res.json();
        const map = {};
        for (const p of projects) {
            map[p.id] = p;
        }
        return map;
    } catch (e) {
        console.warn('[JarMetadata] Modrinth projects lookup skipped/failed:', e.message);
        return {};
    }
}

/**
 * Query Modrinth API in bulk to check for available updates matching installed loaders
 */
async function queryModrinthUpdates(versionMap) {
    const entries = Object.entries(versionMap);
    if (!entries.length) return {};

    // Group hashes by loaders
    const groups = new Map();
    for (const [sha1, verObj] of entries) {
        if (!verObj) continue;
        const loaders = Array.isArray(verObj.loaders) ? verObj.loaders : [];
        const groupKey = loaders.slice().sort().join('|') || 'all';
        if (!groups.has(groupKey)) {
            groups.set(groupKey, { loaders, hashes: [] });
        }
        groups.get(groupKey).hashes.push(sha1);
    }

    const updatesMap = {};
    const promises = Array.from(groups.values()).map(async (group) => {
        try {
            const body = {
                hashes: group.hashes,
                algorithm: 'sha1'
            };
            if (group.loaders.length > 0) {
                body.loaders = group.loaders;
            }

            const res = await fetch('https://api.modrinth.com/v2/version_files/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'ObsidianPanel/2.1'
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(7000)
            });

            if (res.ok) {
                const data = await res.json();
                Object.assign(updatesMap, data);
            }
        } catch (e) {
            console.warn('[JarMetadata] Modrinth version_files/update error:', e.message);
        }
    });

    await Promise.allSettled(promises);
    return updatesMap;
}

const JarMetadataService = {
    /**
     * Enriches listed files in targetPath with plugin/mod metadata (title, iconUrl, webUrl, etc.)
     */
    enrichFilesWithJarMetadata: async (targetPath, files) => {
        const jarCandidates = [];

        for (const file of files) {
            if (file.type !== 'file') continue;
            const nameLower = file.name.toLowerCase();
            if (nameLower.endsWith('.jar') || nameLower.endsWith('.jar.disabled')) {
                jarCandidates.push(file);
            }
        }

        if (jarCandidates.length === 0) {
            return files;
        }

        const uncachedFiles = [];
        const fileHashesMap = new Map(); // file.name -> { sha1, sha256 }

        for (const file of jarCandidates) {
            const fullPath = path.join(targetPath, file.name);
            let stats;
            try {
                stats = fs.statSync(fullPath);
            } catch {
                continue;
            }

            const cacheKey = `${fullPath}:${stats.size}:${stats.mtimeMs}`;
            if (metadataCache.has(cacheKey)) {
                file.pluginInfo = {
                    ...metadataCache.get(cacheKey),
                    enabled: !file.name.endsWith('.disabled')
                };
            } else {
                uncachedFiles.push({ file, fullPath, stats, cacheKey });
            }
        }

        if (uncachedFiles.length > 0) {
            // Compute hashes for uncached files in parallel
            await Promise.all(uncachedFiles.map(async (item) => {
                const hashes = await computeHashes(item.fullPath);
                if (hashes) {
                    fileHashesMap.set(item.file.name, hashes);
                }
            }));

            // Collect sha1 hashes to query Modrinth
            const sha1List = [];
            for (const item of uncachedFiles) {
                const h = fileHashesMap.get(item.file.name);
                if (h && h.sha1) {
                    sha1List.push(h.sha1);
                }
            }

            // 1. Modrinth version_files batch lookup
            const versionMap = await queryModrinthByHashes(sha1List);

            // 2. Collect project IDs to fetch project details (icon, title, slug)
            const projectIds = [];
            for (const verObj of Object.values(versionMap)) {
                if (verObj && verObj.project_id) {
                    projectIds.push(verObj.project_id);
                }
            }

            // Fetch project details and update checks concurrently
            const [projectMap, updatesMap] = await Promise.all([
                queryModrinthProjects(projectIds),
                queryModrinthUpdates(versionMap)
            ]);

            // 3. For each uncached file, build metadata
            await Promise.all(uncachedFiles.map(async (item) => {
                const hashes = fileHashesMap.get(item.file.name);
                const sha1 = hashes ? hashes.sha1 : null;
                const sha256 = hashes ? hashes.sha256 : null;

                let pluginInfo = null;

                if (sha1 && versionMap[sha1]) {
                    const verObj = versionMap[sha1];
                    const project = projectMap[verObj.project_id];
                    const updateObj = updatesMap[sha1];

                    let updateAvailable = false;
                    let latestVersion = null;
                    let latestFileName = null;
                    let latestDownloadUrl = null;

                    if (updateObj && updateObj.id !== verObj.id) {
                        const primaryFile = updateObj.files?.find(f => f.primary) || updateObj.files?.[0];
                        if (primaryFile && primaryFile.hashes?.sha1 !== sha1) {
                            updateAvailable = true;
                            latestVersion = updateObj.version_number;
                            latestFileName = primaryFile.filename;
                            latestDownloadUrl = primaryFile.url;
                        }
                    }

                    pluginInfo = {
                        title: project ? project.title : verObj.name,
                        iconUrl: project ? project.icon_url : null,
                        webUrl: project ? `https://modrinth.com/${project.project_type || 'mod'}/${project.slug}` : null,
                        description: project ? project.description : null,
                        version: verObj.version_number || null,
                        source: 'Modrinth',
                        sha1,
                        sha256,
                        updateAvailable,
                        latestVersion,
                        latestFileName,
                        latestDownloadUrl
                    };
                }

                // If not found on Modrinth, extract manifest info from the jar file directly
                if (!pluginInfo) {
                    const manifest = await extractManifestInfo(item.fullPath);
                    if (manifest) {
                        pluginInfo = {
                            title: manifest.title,
                            iconUrl: null,
                            webUrl: manifest.webUrl || null,
                            description: manifest.description || null,
                            version: manifest.version || null,
                            source: manifest.source || 'Local',
                            sha1,
                            sha256,
                            updateAvailable: false,
                            latestVersion: null,
                            latestFileName: null,
                            latestDownloadUrl: null
                        };
                    } else {
                        // Clean fallback using filename
                        const cleanName = item.file.name
                            .replace(/\.jar(\.disabled)?$/i, '')
                            .replace(/[-_]/g, ' ');
                        pluginInfo = {
                            title: cleanName,
                            iconUrl: null,
                            webUrl: null,
                            source: 'Local',
                            sha1,
                            sha256,
                            updateAvailable: false,
                            latestVersion: null,
                            latestFileName: null,
                            latestDownloadUrl: null
                        };
                    }
                }

                metadataCache.set(item.cacheKey, pluginInfo);

                item.file.pluginInfo = {
                    ...pluginInfo,
                    enabled: !item.file.name.endsWith('.disabled')
                };
            }));
        }

        return files;
    },

    /**
     * Clear cached jar metadata for a specific path or file
     */
    clearCacheForPath: (filePath) => {
        if (!filePath) return;
        const normalized = path.resolve(filePath);
        const baseName = path.basename(filePath);
        for (const key of metadataCache.keys()) {
            if (key.startsWith(normalized + ':') || key.startsWith(normalized) || key.includes(baseName)) {
                metadataCache.delete(key);
            }
        }
    },

    /**
     * Clear all cached metadata
     */
    clearAllCache: () => {
        metadataCache.clear();
    }
};

module.exports = JarMetadataService;

