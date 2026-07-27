const https = require('https');

const PAPER_API_V3_BASE = 'https://fill.papermc.io/v3/projects/paper';
const PAPER_API_V2_BASE = 'https://api.papermc.io/v2/projects/paper';
const USER_AGENT = 'ObsidianPanel/1.0 (MinecraftAPI)';

/**
 * Resolves the PaperMC server JAR download URL strictly for Paper.
 */
async function getPaperUrl(version) {
    const cleanVersion = String(version || '1.20.4').trim();

    // Strategy 1: Paper API v3
    try {
        return await new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 5000
            };
            const req = https.get(`${PAPER_API_V3_BASE}/versions/${cleanVersion}/builds/latest`, options, (res) => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`Paper v3 API HTTP ${res.statusCode}`));
                }
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const downloadsObj = parsed.downloads;
                        if (downloadsObj) {
                            const keys = Object.keys(downloadsObj);
                            if (keys.length > 0) {
                                const dlObj = downloadsObj[keys[0]];
                                if (dlObj && dlObj.url) {
                                    return resolve(dlObj.url);
                                }
                            }
                        }
                        reject(new Error('No downloads object found in Paper v3 response'));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Paper v3 API timeout')); });
        });
    } catch (v3Err) {
        console.warn(`[PaperAPI] v3 lookup for version ${cleanVersion} (${v3Err.message}). Trying v2...`);
    }

    // Strategy 2: Paper API v2
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        };
        const req = https.get(`${PAPER_API_V2_BASE}/versions/${cleanVersion}/builds`, options, (res) => {
            if (res.statusCode >= 400) {
                return reject(new Error(`Paper version ${cleanVersion} not found (HTTP ${res.statusCode})`));
            }

            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.builds || parsed.builds.length === 0) {
                        return reject(new Error(`No Paper builds found for version ${cleanVersion}`));
                    }
                    const latestBuild = parsed.builds[parsed.builds.length - 1];
                    const buildNum = latestBuild.build;
                    const fileName = latestBuild.downloads.application.name;
                    const url = `${PAPER_API_V2_BASE}/versions/${cleanVersion}/builds/${buildNum}/downloads/${fileName}`;
                    resolve(url);
                } catch (e) {
                    reject(new Error(`Failed to parse Paper metadata: ${e.message}`));
                }
            });
        });

        req.on('error', (err) => reject(new Error(`Network error checking Paper: ${err.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Paper v2 API check timed out'));
        });
    });
}

module.exports = {
    getPaperUrl
};
