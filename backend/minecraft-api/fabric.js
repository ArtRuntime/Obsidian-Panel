const https = require('https');

const FABRIC_META_BASE = 'https://meta.fabricmc.net/v2/versions';
const USER_AGENT = 'ObsidianPanel/1.0 (MinecraftAPI)';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000
        };
        https.get(url, options, (res) => {
            if (res.statusCode >= 400) {
                return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Resolves the Fabric server JAR download URL for a given Minecraft version.
 * Endpoint format:
 * https://meta.fabricmc.net/v2/versions/loader/{game_version}/{loader_version}/{installer_version}/server/jar
 */
async function getFabricUrl(version) {
    try {
        let loaderVersion = '0.16.10';
        let installerVersion = '1.0.1';

        // 1. Fetch available loader versions for the specified game version
        try {
            const loaders = await fetchJson(`${FABRIC_META_BASE}/loader/${encodeURIComponent(version)}`);
            if (Array.isArray(loaders) && loaders.length > 0) {
                const stableLoader = loaders.find(l => l.loader && l.loader.stable);
                loaderVersion = stableLoader ? stableLoader.loader.version : loaders[0].loader.version;
            } else {
                // Fallback: fetch all loaders
                const allLoaders = await fetchJson(`${FABRIC_META_BASE}/loader`);
                if (Array.isArray(allLoaders) && allLoaders.length > 0) {
                    const stable = allLoaders.find(l => l.stable);
                    loaderVersion = stable ? stable.version : allLoaders[0].version;
                }
            }
        } catch (e) {
            console.warn(`[FabricAPI] Warning fetching loader versions for ${version}: ${e.message}. Using fallback ${loaderVersion}`);
        }

        // 2. Fetch available installer versions
        try {
            const installers = await fetchJson(`${FABRIC_META_BASE}/installer`);
            if (Array.isArray(installers) && installers.length > 0) {
                const stableInst = installers.find(i => i.stable);
                installerVersion = stableInst ? stableInst.version : installers[0].version;
            }
        } catch (e) {
            console.warn(`[FabricAPI] Warning fetching installer versions: ${e.message}. Using fallback ${installerVersion}`);
        }

        const downloadUrl = `${FABRIC_META_BASE}/loader/${encodeURIComponent(version)}/${encodeURIComponent(loaderVersion)}/${encodeURIComponent(installerVersion)}/server/jar`;
        console.log(`[FabricAPI] Resolved Fabric URL for ${version}: ${downloadUrl}`);
        return downloadUrl;
    } catch (err) {
        throw new Error(`Failed to resolve Fabric download URL for ${version}: ${err.message}`);
    }
}

module.exports = {
    getFabricUrl
};
