const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Brute-Force Protection for Auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Generous limit to prevent accidental lockouts
    message: { message: 'Too many login attempts. Please try again in a few minutes.' }
});

router.post('/register', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Only allow registration for the initial admin setup
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount > 0) {
            return res.status(403).json({ message: 'Registration is disabled. An administrator account is already configured.' });
        }

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({
            username,
            password,
            role: 'admin'
        });
        await user.save();

        // Session Login
        req.session.userId = user.id || user._id;
        req.session.role = user.role;
        req.session.permissions = user.permissions || [];

        res.json({
            token: 'session',
            user: {
                id: user.id || user._id,
                _id: user._id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || []
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.post('/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        // Session Login
        req.session.userId = user.id || user._id;
        req.session.role = user.role;
        req.session.permissions = user.permissions || [];

        res.json({
            token: 'session',
            user: {
                id: user.id || user._id,
                _id: user._id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || []
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // Default name
        res.json({ message: 'Logout successful' });
    });
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (req.session) {
            req.session.role = user.role;
            req.session.permissions = user.permissions || [];
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.put('/profile', auth, async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (username && username !== user.username) {
            const exists = await User.findOne({ username });
            if (exists) return res.status(400).json({ message: 'Username already taken' });
            user.username = username;
        }
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password' });
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid current password' });
            }
            user.password = newPassword;
        }
        await user.save();
        res.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/has-admin', async (req, res) => {
    try {
        const count = await User.countDocuments({ role: 'admin' });
        res.json({ hasAdmin: count > 0 });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
