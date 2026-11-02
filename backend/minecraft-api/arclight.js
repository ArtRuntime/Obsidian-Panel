const https = require('https');

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/IzzelAliz/Arclight/releases';
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
 * Resolves the Arclight server JAR download URL from GitHub Releases.
 */
async function getArclightUrl(version) {
    const cleanVersion = String(version || '1.20.4').trim();

    try {
        const releases = await fetchJson(GITHUB_RELEASES_URL);
        if (!Array.isArray(releases) || releases.length === 0) {
            throw new Error('No Arclight releases found');
        }

        // Search for a release matching the requested Minecraft version
        for (const rel of releases) {
            const tag = (rel.tag_name || '').toLowerCase();
            const name = (rel.name || '').toLowerCase();
            if (tag.includes(cleanVersion) || name.includes(cleanVersion)) {
                const jarAsset = (rel.assets || []).find(a => a.name.endsWith('.jar') && !a.name.includes('-sources'));
                if (jarAsset && jarAsset.browser_download_url) {
                    console.log(`[ArclightAPI] Resolved Arclight URL for ${cleanVersion}: ${jarAsset.browser_download_url}`);
                    return jarAsset.browser_download_url;
                }
            }
        }

        // Fallback: pick the first release with a runnable JAR
        for (const rel of releases) {
            const jarAsset = (rel.assets || []).find(a => a.name.endsWith('.jar') && !a.name.includes('-sources'));
            if (jarAsset && jarAsset.browser_download_url) {
                console.log(`[ArclightAPI] Fallback Arclight URL: ${jarAsset.browser_download_url}`);
                return jarAsset.browser_download_url;
            }
        }

        throw new Error(`No compatible Arclight JAR asset found for ${cleanVersion}`);
    } catch (err) {
        throw new Error(`Failed to resolve Arclight download URL: ${err.message}`);
    }
}

module.exports = {
    getArclightUrl
};

