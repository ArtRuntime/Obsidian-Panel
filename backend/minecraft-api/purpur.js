const https = require('https');

const PURPUR_API_BASE = 'https://api.purpurmc.org/v2/purpur';
const USER_AGENT = 'ObsidianPanel/1.0 (MinecraftAPI)';

/**
 * Resolves the PurpurMC server JAR download URL for a given version.
 * Verifies version availability before returning the download URL.
 */
async function getPurpurUrl(version) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        };
        // Verify version availability
        https.get(`${PURPUR_API_BASE}/${version}`, options, (res) => {
            if (res.statusCode >= 400) {
                return reject(new Error(`Purpur version ${version} not available (HTTP ${res.statusCode})`));
            }
            resolve(`${PURPUR_API_BASE}/${version}/latest/download`);
        }).on('error', (err) => reject(new Error(`Network error checking Purpur: ${err.message}`)));
    });
}

module.exports = {
    getPurpurUrl
};
