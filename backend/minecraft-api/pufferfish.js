const https = require('https');

const PUFFERFISH_CI = 'https://ci.pufferfish.host';
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
 * Resolves the Pufferfish server JAR download URL from official CI builds.
 */
async function getPufferfishUrl(version) {
    const cleanVersion = String(version || '1.21.4').trim();
    const parts = cleanVersion.split('.');
    const majorMinor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : '1.21';

    try {
        const jobUrl = `${PUFFERFISH_CI}/job/Pufferfish-${majorMinor}/lastSuccessfulBuild/api/json`;
        const data = await fetchJson(jobUrl);

        if (Array.isArray(data.artifacts) && data.artifacts.length > 0) {
            const paperclip = data.artifacts.find(a => a.fileName && a.fileName.includes('paperclip')) || data.artifacts[0];
            const downloadUrl = `${PUFFERFISH_CI}/job/Pufferfish-${majorMinor}/lastSuccessfulBuild/artifact/${paperclip.relativePath}`;
            console.log(`[PufferfishAPI] Resolved Pufferfish URL for ${cleanVersion}: ${downloadUrl}`);
            return downloadUrl;
        }

        throw new Error('No artifacts found in latest Pufferfish build');
    } catch (err) {
        throw new Error(`Failed to resolve Pufferfish download URL for ${cleanVersion}: ${err.message}`);
    }
}

module.exports = {
    getPufferfishUrl
};

