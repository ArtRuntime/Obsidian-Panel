const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const playerService = require('../services/playerService');

// GET all players and status
router.get('/', auth, checkPermission('players.view', 'overview.view', 'console.view'), async (req, res) => {
    try {
        const data = await playerService.getAllPlayers();
        res.json(data);
    } catch (err) {
        console.error('[Route /api/players GET] Error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch players' });
    }
});

// POST Toggle whitelist on/off
router.post('/whitelist/toggle', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { enabled } = req.body;
        const result = await playerService.toggleWhitelist(enabled);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to toggle whitelist' });
    }
});

// POST Add to whitelist
router.post('/whitelist', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Player username is required' });
        const result = await playerService.addWhitelist(username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to add to whitelist' });
    }
});

// DELETE Remove from whitelist
router.delete('/whitelist/:username', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username } = req.params;
        const result = await playerService.removeWhitelist(username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to remove from whitelist' });
    }
});

// POST Add operator
router.post('/op', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username, level } = req.body;
        if (!username) return res.status(400).json({ error: 'Player username is required' });
        const result = await playerService.addOp(username, level);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to grant operator' });
    }
});

// DELETE Remove operator
router.delete('/op/:username', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username } = req.params;
        const result = await playerService.removeOp(username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to revoke operator' });
    }
});

// POST Ban player
router.post('/ban', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username, reason } = req.body;
        if (!username) return res.status(400).json({ error: 'Player username is required' });
        const result = await playerService.banPlayer(username, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to ban player' });
    }
});

// POST Unban player
router.post('/unban', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Player username is required' });
        const result = await playerService.unbanPlayer(username);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to unban player' });
    }
});

// POST Ban IP
router.post('/ban-ip', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { ip, reason } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP address is required' });
        const result = await playerService.banIp(ip, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to ban IP' });
    }
});

// POST Unban IP
router.post('/unban-ip', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP address is required' });
        const result = await playerService.unbanIp(ip);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to unban IP' });
    }
});

// POST Kick player
router.post('/kick', auth, checkPermission('players.manage', 'console.command', 'overview.control'), async (req, res) => {
    try {
        const { username, reason } = req.body;
        if (!username) return res.status(400).json({ error: 'Player username is required' });
        const result = await playerService.kickPlayer(username, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to kick player' });
    }
});

module.exports = router;

