const https = require('https');

/**
 * Resolves the Spigot server JAR download URL strictly for Spigot.
 */
async function getSpigotUrl(version) {
    const cleanVersion = String(version || '1.20.4').trim();
    return `https://cdn.getbukkit.org/spigot/spigot-${cleanVersion}.jar`;
}

module.exports = {
    getSpigotUrl
};
