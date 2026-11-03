const User = require('../models/User');

/**
 * Middleware to check if user has at least one of the required permissions.
 * Admins always have all permissions.
 * Edit/manage permissions implicitly grant view permissions (e.g., settings.edit grants settings.view).
 * @param {...string} requiredPermissions - One or more permission strings to check (e.g., 'files.view', 'settings.edit')
 */
const checkPermission = (...requiredPermissions) => {
    return async (req, res, next) => {
        try {
            // User should be attached by 'auth' middleware beforehand
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Fetch full user to get permissions (auth middleware might only have basic info)
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            // Admin bypass
            if (user.role === 'admin') {
                req.user.permissions = ['*']; // For frontend convenience if passed back
                return next();
            }

            // Check permissions: match if user has any required permission or implied edit/manage rights
            const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
            const hasPermission = requiredPermissions.some(perm => {
                if (userPerms.includes('*') || userPerms.includes(perm)) return true;
                if (perm.endsWith('.view')) {
                    const prefix = perm.slice(0, -5);
                    if (userPerms.some(p => p.startsWith(`${prefix}.`))) {
                        return true;
                    }
                }
                // Implied / Alias permissions
                if (perm === 'console.view' && userPerms.includes('console.command')) return true;
                if (perm === 'players.manage' && (userPerms.includes('console.command') || userPerms.includes('overview.control'))) return true;
                if (perm === 'players.view' && (userPerms.includes('players.manage') || userPerms.includes('console.view') || userPerms.includes('overview.view') || userPerms.includes('console.command') || userPerms.includes('overview.control'))) return true;
                if (perm === 'sleep.manage' && userPerms.includes('overview.control')) return true;
                if (perm === 'users.view' && userPerms.includes('users.manage')) return true;
                if (['game.view', 'game.edit', 'general.edit', 'schedules.view', 'schedules.manage', 'templates.view', 'templates.manage', 'settings.view', 'settings.edit'].includes(perm) && userPerms.includes('settings.edit')) {
                    return true;
                }
                return false;
            });

            if (hasPermission) {
                return next();
            }

            return res.status(403).json({ message: `Access denied. Requires '${requiredPermissions.join("' or '")}' permission.` });

        } catch (err) {
            console.error('Permission check error:', err);
            res.status(500).json({ message: 'Server error during permission check' });
        }
    };
};

module.exports = checkPermission;
