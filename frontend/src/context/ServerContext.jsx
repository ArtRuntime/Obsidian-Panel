import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { serverApi } from '../api/server';
import { SOCKET_URL } from '../config';
import { useAuth } from './AuthContext';

const ServerContext = createContext(null);

export const ServerProvider = ({ children }) => {
    const { user } = useAuth();
    const [server, setServer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    const fetchServer = async () => {
        try {
            const data = await serverApi.getStatus();
            setServer(data);
        } catch (error) {
            console.error("Failed to fetch server status", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setServer(null);
            setLoading(false);
            return;
        }

        fetchServer(); // Initial fetch to get full status

        // Debug: Log the socket URL being used
        console.log('[Socket] Connecting to:', SOCKET_URL || window.location.origin);

        const newSocket = io(SOCKET_URL || undefined, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            autoConnect: true,
            withCredentials: true,
        });

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('[Socket] Connected successfully:', newSocket.id);
        });

        // Suppress noisy connection errors in console
        newSocket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
        });

        setSocket(newSocket);
        newSocket.on('status', (status) => {
            // If status is a string (like "online" or "offline"), merge with existing state
            if (typeof status === 'string') {
                setServer(prev => prev ? { ...prev, status } : { status });
            } else {
                // Full status object from API
                setServer(status);
            }
            setLoading(false);
        });

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, [user]);
    const updateServer = async (updates) => {
        await serverApi.updateServerConfig(updates);
        fetchServer();
    };
    const performAction = async (action) => {
        return await serverApi.performAction(action);
    };
    const installServer = async (version) => {
        return await serverApi.install(version);
    };
    return (
        <ServerContext.Provider value={{
            server,
            loading,
            updateServer,
            fetchServer,
            performAction,
            installServer,
            socket
        }}>
            {children}
        </ServerContext.Provider>
    );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useServer = () => useContext(ServerContext);
