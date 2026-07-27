const express = require('express');
const router = express.Router();
const pluginService = require('../services/pluginService');
const minecraftService = require('../services/minecraftService');

const { auth, checkPermission } = require('../middleware');

// Search Plugins
router.get('/search', auth, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }
        const results = await pluginService.search(query);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Failed to search plugins' });
    }
});

// Install Plugin
router.post('/install', auth, checkPermission('plugins.manage'), async (req, res) => {
    try {
        const { projectId, source = 'Modrinth', customVersion, customLoader } = req.body;

        // Get current server config automatically
        const config = minecraftService.config;
        const version = customVersion || config.version || '1.20.4';
        let type = (customLoader || config.type || 'vanilla').toLowerCase();

        // Map server type to compatible Modrinth loaders
        const loaderMap = {
            'fabric': ['fabric', 'modrinth'],
            'paper': ['paper', 'purpur', 'spigot', 'bukkit'],
            'purpur': ['purpur', 'paper', 'spigot', 'bukkit'],
            'spigot': ['spigot', 'bukkit', 'paper'],
            'vanilla': ['paper', 'purpur', 'spigot', 'bukkit']
        };

        const loaders = customLoader ? [customLoader.toLowerCase(), 'modrinth', 'bukkit'] : (loaderMap[type] || ['fabric', 'paper', 'purpur', 'spigot', 'bukkit']);

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        console.log(`Installing plugin/mod ${projectId} from ${source} for version ${version} [Type: ${type}, Loaders: ${loaders.join(', ')}]`);

        const result = await pluginService.install(source, projectId, version, loaders, type);
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Install error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Apply Full Server Template (Config + JAR + Plugins/Mods)
router.post('/apply-template', auth, checkPermission('settings.edit'), async (req, res) => {
    try {
        const { type, version, ram, plugins = [] } = req.body;
        console.log(`[TemplateEngine] Applying template: ${type} ${version} (${ram} RAM) with ${plugins.length} plugins/mods`);

        // 1. Clean wipe server directory first
        minecraftService.cleanServerDirectory();

        // 2. Save Server Config
        minecraftService.saveConfig({ type, version, ram });

        // 3. Trigger Server JAR Installation
        await minecraftService.install(version);

        // 3. Auto-install template plugins / mods
        const loaderMap = {
            'fabric': ['fabric', 'modrinth'],
            'paper': ['paper', 'purpur', 'spigot', 'bukkit'],
            'purpur': ['purpur', 'paper', 'spigot', 'bukkit'],
            'spigot': ['spigot', 'bukkit', 'paper'],
            'vanilla': ['paper', 'purpur', 'spigot', 'bukkit']
        };
        const loaders = loaderMap[(type || 'vanilla').toLowerCase()] || ['fabric', 'paper', 'spigot', 'bukkit'];

        const installedList = [];
        for (const p of plugins) {
            try {
                console.log(`[TemplateEngine] Auto-installing template plugin/mod: ${p.id} (${p.source || 'Modrinth'})`);
                const result = await pluginService.install(p.source || 'Modrinth', p.id, version, loaders, type);
                installedList.push(result.filename);
            } catch (pErr) {
                console.warn(`[TemplateEngine] Warning: Failed to install template plugin ${p.id}:`, pErr.message);
            }
        }

        res.json({
            success: true,
            message: `Template applied successfully! Installed ${installedList.length} plugins/mods.`,
            installedPlugins: installedList
        });
    } catch (err) {
        console.error('[TemplateEngine] Apply Template Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
