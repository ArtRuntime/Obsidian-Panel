const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware');
const bcrypt = require('bcryptjs');

// GET /api/users - List all users
router.get('/', auth, checkPermission('users.view'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// POST /api/users - Create a new user/sub-admin
router.post('/', auth, checkPermission('users.manage'), async (req, res) => {
    const { username, password, role, permissions } = req.body;
    try {
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const targetRole = role || 'user';
        if (!['admin', 'sub-admin', 'user'].includes(targetRole)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // Only an existing admin can create another admin account
        if (targetRole === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only administrators can create admin accounts.' });
        }

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({
            username,
            password,
            role: targetRole,
            permissions: Array.isArray(permissions) ? permissions : []
        });

        await user.save();
        res.json({ id: user.id || user._id, _id: user._id, username: user.username, role: user.role, permissions: user.permissions });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/users/:id - Update user (permissions/role)
router.put('/:id', auth, checkPermission('users.manage'), async (req, res) => {
    const { role, permissions, password } = req.body;
    try {
        const targetId = req.params.id;
        if (!targetId || targetId === 'undefined') {
            return res.status(400).json({ message: 'User ID is required' });
        }
        let user = await User.findById(targetId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isSelf = user.id === req.user.id || String(user._id) === String(req.user.id);
        const isCallerAdmin = req.user.role === 'admin';

        // Non-admins cannot modify their own role or permissions
        if (isSelf && !isCallerAdmin && (role !== undefined || permissions !== undefined)) {
            return res.status(403).json({ message: 'Cannot modify your own role or permissions.' });
        }

        // Prevent demoting self if caller is the last admin
        if (isSelf && isCallerAdmin && role && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot demote the only administrator account.' });
            }
        }

        // Only admins can modify existing admin accounts
        if (user.role === 'admin' && !isCallerAdmin) {
            return res.status(403).json({ message: 'Only administrators can modify an administrator account.' });
        }

        // Only admins can promote any user to admin
        if (role === 'admin' && !isCallerAdmin) {
            return res.status(403).json({ message: 'Only administrators can assign the admin role.' });
        }

        if (role) {
            if (!['admin', 'sub-admin', 'user'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            user.role = role;
        }

        // Update permissions only if provided (and clear if admin)
        if (permissions !== undefined) {
            user.permissions = user.role === 'admin' ? [] : (Array.isArray(permissions) ? permissions : []);
        }

        if (password) {
            user.password = password; // Pre-save hook will hash it
        }

        await user.save();
        res.json({ id: user.id || user._id, _id: user._id, username: user.username, role: user.role, permissions: user.permissions });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', auth, checkPermission('users.manage'), async (req, res) => {
    try {
        const targetId = req.params.id;
        if (!targetId || targetId === 'undefined') {
            return res.status(400).json({ message: 'User ID is required' });
        }
        if (targetId === req.user.id || targetId === String(req.user.id)) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        const user = await User.findById(targetId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Only admins can delete an admin account
        if (user.role === 'admin') {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can delete an administrator account.' });
            }
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the only administrator account.' });
            }
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
