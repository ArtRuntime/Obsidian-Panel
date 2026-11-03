import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasAdmin, setHasAdmin] = useState(false);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/has-admin`);
                const data = await res.json();
                setHasAdmin(data.hasAdmin);
            } catch (e) {
                console.error(e);
            }

            try {
                const res = await fetch(`${API_URL}/api/auth/me?_=${Date.now()}`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const userData = await res.json();
                    setUser(userData);
                    setToken("session"); // maintain compatibility with existing checks
                } else {
                    setUser(null);
                    setToken(null);
                }
            } catch (e) {
                console.error("Auth check failed:", e);
                setUser(null);
                setToken(null);
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const register = async (username, password) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Registration failed');

            setHasAdmin(true);
            setToken("session");
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const checkHasAdmin = async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/has-admin`);
            const data = await res.json();
            return data.hasAdmin;
        } catch { return false; }
    };

    const login = async (username, password) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Login failed');

            setToken("session");
            setUser(data.user);

            // Fetch fresh user profile to ensure all permissions and virtuals are synced
            try {
                const meRes = await fetch(`${API_URL}/api/auth/me?_=${Date.now()}`, { credentials: 'include' });
                if (meRes.ok) {
                    const fullUserData = await meRes.json();
                    setUser(fullUserData);
                }
            } catch (e) {}

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateProfile = async (data) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            let result;
            try {
                result = await res.json();
            } catch {
                const text = await res.text().catch(() => 'Unknown error');
                throw new Error(res.statusText || text || 'Network response was not ok');
            }

            if (!res.ok) throw new Error(result.message || 'Update failed');
            setUser(result);
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {
            console.error("Logout failed", e);
        }
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, register, checkHasAdmin, hasAdmin, loading, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
