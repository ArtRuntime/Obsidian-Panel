const FOLIA_API_V3_BASE = 'https://fill.papermc.io/v3/projects/folia';
const FOLIA_API_V2_BASE = 'https://api.papermc.io/v2/projects/folia';
const USER_AGENT = 'ObsidianPanel/1.0 (https://github.com/ArtRuntime/Obsidian-Panel)';

/**
 * Resolves the Folia server JAR download URL from PaperMC downloads service.
 */
async function getFoliaUrl(version) {
    let cleanVersion = String(version || '1.21.4').trim();

    // Fetch supported versions if necessary to find closest match
    try {
        const metaRes = await fetch(FOLIA_API_V3_BASE, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(6000)
        });
        if (metaRes.ok) {
            const meta = await metaRes.json();
            const allFoliaVersions = Object.values(meta.versions || {}).flat();
            if (!allFoliaVersions.includes(cleanVersion)) {
                // Find matching major/minor
                const parts = cleanVersion.split('.');
                const majorMinor = parts.slice(0, 2).join('.');
                const match = allFoliaVersions.find(v => v.startsWith(majorMinor)) || allFoliaVersions[allFoliaVersions.length - 1];
                if (match) {
                    console.log(`[FoliaAPI] Version ${cleanVersion} not in Folia releases. Using closest compatible ${match}`);
                    cleanVersion = match;
                }
            }
        }
    } catch (e) {
        // Continue with original version
    }

    // Strategy 1: PaperMC API v3
    try {
        const res = await fetch(`${FOLIA_API_V3_BASE}/versions/${cleanVersion}/builds/latest`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
            const data = await res.json();
            const downloadsObj = data.downloads;
            if (downloadsObj) {
                const keys = Object.keys(downloadsObj);
                if (keys.length > 0 && downloadsObj[keys[0]]?.url) {
                    return downloadsObj[keys[0]].url;
                }
            }
        }
    } catch (v3Err) {
        console.warn(`[FoliaAPI] v3 lookup error for ${cleanVersion}: ${v3Err.message}`);
    }

    // Strategy 2: PaperMC API v2
    const v2Res = await fetch(`${FOLIA_API_V2_BASE}/versions/${cleanVersion}/builds`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000)
    });
    if (!v2Res.ok) {
        throw new Error(`Folia version ${cleanVersion} not found (HTTP ${v2Res.status})`);
    }

    const v2Data = await v2Res.json();
    if (!v2Data.builds || v2Data.builds.length === 0) {
        throw new Error(`No Folia builds found for version ${cleanVersion}`);
    }

    const latestBuild = v2Data.builds[v2Data.builds.length - 1];
    const buildNum = latestBuild.build;
    const fileName = latestBuild.downloads.application.name;
    return `${FOLIA_API_V2_BASE}/versions/${cleanVersion}/builds/${buildNum}/downloads/${fileName}`;
}

module.exports = {
    getFoliaUrl
};
