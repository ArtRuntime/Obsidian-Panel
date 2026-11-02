const https = require('https');

const QUILT_META_BASE = 'https://meta.quiltmc.org/v3/versions';
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
 * Resolves Quilt installer download URL.
 */
async function getQuiltUrl(version) {
    const cleanVersion = String(version || '1.20.4').trim();

    try {
        const installers = await fetchJson(`${QUILT_META_BASE}/installer`);
        if (Array.isArray(installers) && installers.length > 0) {
            const chosen = installers[0];
            if (chosen.url) {
                console.log(`[QuiltAPI] Resolved Quilt installer URL for ${cleanVersion}: ${chosen.url}`);
                return chosen.url;
            }
            const dlUrl = `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${chosen.version}/quilt-installer-${chosen.version}.jar`;
            console.log(`[QuiltAPI] Built Quilt installer URL for ${cleanVersion}: ${dlUrl}`);
            return dlUrl;
        }

        throw new Error('No Quilt installer versions found');
    } catch (err) {
        throw new Error(`Failed to resolve Quilt download URL for ${cleanVersion}: ${err.message}`);
    }
}

module.exports = {
    getQuiltUrl
};

