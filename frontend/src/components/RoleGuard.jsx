import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleGuard = ({ permission, adminOnly }) => {
    const { user, loading } = useAuth();

    console.log('RoleGuard:', { role: user?.role, perm: permission, adminOnly, path: window.location.pathname });

    if (loading) return null; // Or a spinner

    // Admin bypass - always allowed
    if (user?.role === 'admin') {
        return <Outlet />;
    }

    // If user role has no permissions assigned and route requires permission or adminOnly
    if (user?.role === 'user' && (!user.permissions || user.permissions.length === 0)) {
        return <Navigate to="/" replace />;
    }

    // Sub-admin / User with permissions checks
    if (adminOnly) {
        return <Navigate to="/" replace />;
    }

    if (permission) {
        const perms = Array.isArray(user?.permissions) ? user.permissions : [];
        if (perms.includes('*') || perms.includes(permission)) {
            return <Outlet />;
        }
        if (permission.includes('.')) {
            const [section] = permission.split('.');
            if (perms.some(p => p.startsWith(`${section}.`))) {
                return <Outlet />;
            }
        }
        if (permission === 'console.view' && perms.includes('console.command')) {
            return <Outlet />;
        }
        if (permission === 'players.view' && (perms.includes('players.manage') || perms.includes('console.view') || perms.includes('overview.view') || perms.includes('console.command') || perms.includes('overview.control'))) {
            return <Outlet />;
        }
        if (permission === 'players.manage' && (perms.includes('console.command') || perms.includes('overview.control'))) {
            return <Outlet />;
        }
        if (permission === 'sleep.manage' && perms.includes('overview.control')) {
            return <Outlet />;
        }
        if (['game.view', 'game.edit', 'general.edit', 'schedules.view', 'schedules.manage', 'templates.view', 'templates.manage', 'settings.view', 'settings.edit'].includes(permission) && perms.includes('settings.edit')) {
            return <Outlet />;
        }
        if (permission === 'users.view' && perms.includes('users.manage')) {
            return <Outlet />;
        }
        if (permission.endsWith('.view')) {
            const prefix = permission.slice(0, -5);
            if (perms.some(p => p.startsWith(`${prefix}.`))) {
                return <Outlet />;
            }
        }
    }

    // Fallback denied
    return <Navigate to="/" replace />;
};

export default RoleGuard;
