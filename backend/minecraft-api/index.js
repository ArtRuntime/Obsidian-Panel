const vanilla = require('./vanilla');
const paper = require('./paper');
const purpur = require('./purpur');
const fabric = require('./fabric');
const spigot = require('./spigot');
const folia = require('./folia');
const pufferfish = require('./pufferfish');
const arclight = require('./arclight');
const forge = require('./forge');
const neoforge = require('./neoforge');
const quilt = require('./quilt');

/**
 * Dispatches download URL resolution based on server software type.
 * @param {string} version - Minecraft version string (e.g. "1.20.4", "24w09a")
 * @param {string} type - Server type: "vanilla" | "paper" | "purpur" | "spigot" | "fabric" | "neoforge" | "forge" | "quilt" | "folia" | "pufferfish" | "arclight"
 * @returns {Promise<string>} Direct download URL
 */
async function resolveDownloadUrl(version, type = 'vanilla') {
    const serverType = (type || 'vanilla').toLowerCase();
    console.log(`[MinecraftAPI] Resolving download URL for ${version} [Type: ${serverType}]`);

    switch (serverType) {
        case 'neoforge':
            return await neoforge.getNeoForgeUrl(version);
        case 'paper':
            return await paper.getPaperUrl(version);
        case 'forge':
            return await forge.getForgeUrl(version);
        case 'purpur':
            return await purpur.getPurpurUrl(version);
        case 'fabric':
            return await fabric.getFabricUrl(version);
        case 'pufferfish':
            return await pufferfish.getPufferfishUrl(version);
        case 'quilt':
            return await quilt.getQuiltUrl(version);
        case 'folia':
            return await folia.getFoliaUrl(version);
        case 'arclight':
            return await arclight.getArclightUrl(version);
        case 'spigot':
            return await spigot.getSpigotUrl(version);
        case 'vanilla':
        default:
            return await vanilla.getVanillaUrl(version);
    }
}

/**
 * Maps a Minecraft version string (e.g. "1.21.4", "1.20.4", "1.16.5", "25w01a")
 * to the recommended Java major version (8, 17, 21, 25).
 */
function requiredJavaVersion(mcVersion) {
    if (!mcVersion) return 21;
    const clean = String(mcVersion).trim();

    // Snapshot matching (e.g. "25w01a", "24w09a")
    const snapshotMatch = clean.match(/^(\d{2})w/i);
    if (snapshotMatch) {
        const year = parseInt(snapshotMatch[1], 10);
        if (year >= 25) return 25;
        if (year >= 24) return 21;
        return 17;
    }

    const parts = clean.split('.').map(p => parseInt(p, 10));
    const major = parts[0] || 1;
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;

    if (major > 1) return 25;
    if (major === 1) {
        if (minor >= 21) return 21;
        if (minor === 20 && patch >= 5) return 21;
        if (minor >= 17) return 17;
    }
    return 8;
}

module.exports = {
    getAvailableVersions: vanilla.getAvailableVersions,
    getLatestReleaseVersion: vanilla.getLatestReleaseVersion,
    resolveDownloadUrl,
    requiredJavaVersion
};
