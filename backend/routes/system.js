const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware');

// GET /api/system/update-check
router.get('/update-check', auth, async (req, res) => {
    try {
        // fetch latest commit from GitHub
        const response = await axios.get('https://api.github.com/repos/ArtRuntime/Obsidian-Panel/commits/master', {
            headers: { 'User-Agent': 'Obsidian-Panel' }
        });

        const latestCommit = response.data;
        const latestSha = latestCommit.sha;
        const currentSha = process.env.GIT_SHA;

        let updateAvailable = false;

        if (currentSha && latestSha) {
            console.log(`[UpdateCheck] Local: ${currentSha} | Remote: ${latestSha}`);
            if (currentSha !== latestSha) {
                updateAvailable = true;
            }
        } else if (!currentSha) {
            console.log('[UpdateCheck] GIT_SHA env var is missing. Cannot verify version.');
        }


        res.json({
            updateAvailable,
            currentVersion: currentSha ? currentSha.substring(0, 7) : 'Unknown',
            latestVersion: latestSha ? latestSha.substring(0, 7) : 'Unknown',
            commitData: {
                message: latestCommit.commit.message,
                author: latestCommit.commit.author.name,
                date: latestCommit.commit.author.date
            }
        });
    } catch (err) {
        console.error('Update check failed:', err.message);
        if (err.response) {
            console.error('GitHub API Response:', err.response.status, err.response.data);
            if (err.response.status === 403) {
                console.error('Rate limit likely exceeded.');
            }
        }
        // Return a valid JSON even on error so frontend doesn't crash
        res.json({
            updateAvailable: false,
            currentVersion: process.env.GIT_SHA ? process.env.GIT_SHA.substring(0, 7) : 'Unknown',
            latestVersion: 'Check Failed',
            error: err.message
        });
    }
});

module.exports = router;
