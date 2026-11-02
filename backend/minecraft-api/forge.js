const https = require('https');

const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FORGE_MAVEN_BASE = 'https://maven.minecraftforge.net/net/minecraftforge/forge';
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
 * Resolves Forge installer download URL for a given Minecraft version.
 */
async function getForgeUrl(version) {
    const cleanVersion = String(version || '1.20.1').trim();

    try {
        const data = await fetchJson(FORGE_PROMOTIONS_URL);
        const promos = data.promos || {};

        const forgeVersion = promos[`${cleanVersion}-recommended`] || promos[`${cleanVersion}-latest`];
        if (!forgeVersion) {
            throw new Error(`No Forge build found for Minecraft ${cleanVersion}`);
        }

        const artifactName = `forge-${cleanVersion}-${forgeVersion}-installer.jar`;
        const downloadUrl = `${FORGE_MAVEN_BASE}/${cleanVersion}-${forgeVersion}/${artifactName}`;
        console.log(`[ForgeAPI] Resolved Forge URL for ${cleanVersion}: ${downloadUrl}`);
        return downloadUrl;
    } catch (err) {
        throw new Error(`Failed to resolve Forge download URL for ${cleanVersion}: ${err.message}`);
    }
}

module.exports = {
    getForgeUrl
};

