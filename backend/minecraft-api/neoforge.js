const https = require('https');

const NEOFORGE_METADATA_URL = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
const NEOFORGE_MAVEN_BASE = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';
const USER_AGENT = 'ObsidianPanel/1.0 (MinecraftAPI)';

async function fetchText(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
}

/**
 * Resolves NeoForge installer download URL for a given Minecraft version.
 */
async function getNeoForgeUrl(version) {
    const cleanVersion = String(version || '1.21.1').trim();

    // Map Minecraft version to NeoForge version prefix (e.g. 1.21.1 -> 21.1, 1.20.4 -> 20.4)
    let prefix = null;
    if (cleanVersion.startsWith('1.')) {
        const parts = cleanVersion.substring(2).split('.');
        const minor = parts[0];
        const patch = parts[1] || '0';
        prefix = `${minor}.${patch}.`;
    }

    try {
        const xml = await fetchText(NEOFORGE_METADATA_URL);
        const matches = Array.from(xml.matchAll(/<version>(.*?)<\/version>/g)).map(m => m[1]);

        if (matches.length === 0) {
            throw new Error('No NeoForge versions found in Maven metadata');
        }

        let candidates = prefix ? matches.filter(v => v.startsWith(prefix)) : [];
        if (candidates.length === 0) {
            // Try matching just minor prefix (e.g. 21.)
            if (prefix) {
                const broadPrefix = prefix.split('.')[0] + '.';
                candidates = matches.filter(v => v.startsWith(broadPrefix));
            }
        }

        if (candidates.length === 0) {
            candidates = matches;
        }

        // Prefer stable (non-beta)
        const stableCandidates = candidates.filter(v => !v.includes('-beta'));
        const chosenVersion = (stableCandidates.length > 0 ? stableCandidates : candidates)[candidates.length - 1];

        const artifactName = `neoforge-${chosenVersion}-installer.jar`;
        const downloadUrl = `${NEOFORGE_MAVEN_BASE}/${chosenVersion}/${artifactName}`;
        console.log(`[NeoForgeAPI] Resolved NeoForge URL for ${cleanVersion}: ${downloadUrl}`);
        return downloadUrl;
    } catch (err) {
        throw new Error(`Failed to resolve NeoForge download URL for ${cleanVersion}: ${err.message}`);
    }
}

module.exports = {
    getNeoForgeUrl
};
