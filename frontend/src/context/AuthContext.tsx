import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getAuthToken, setAuthToken } from '../services/api';
import { wsManager } from '../services/ws';
import { User, Device } from '../types';

interface AuthContextType {
  user: User | null;
  device: Device | null;
  token: string | null;
  isAuthenticated: boolean;
  isTrusted: boolean;
  loading: boolean;
  login: (credentials: { username: string; password: string; trustDevice?: boolean; deviceName?: string }) => Promise<void>;
  register: (data: { username: string; displayName: string; password: string; trustDevice?: boolean; deviceName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  devices: Device[];
  loadDevices: () => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  logoutAllOtherDevices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<User | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setDevice(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      setDevice(data.device);
    } catch (err) {
      // If token expired or invalid, remove it
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (credentials: { username: string; password: string; trustDevice?: boolean; deviceName?: string }) => {
    const res = await api.login(credentials);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setDevice(res.device);
    wsManager.send('AUTH', { token: res.token });
  };

  const register = async (data: { username: string; displayName: string; password: string; trustDevice?: boolean; deviceName?: string }) => {
    const res = await api.register(data);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setDevice(res.device);
    wsManager.send('AUTH', { token: res.token });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // ignore logout failure
    }
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    setDevice(null);
  };

  const loadDevices = async () => {
    try {
      const res = await api.getDevices();
      setDevices(res.devices || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    await api.revokeDevice(deviceId);
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const logoutAllOtherDevices = async () => {
    await api.logoutAllDevices();
    if (device) {
      setDevices([device]);
    }
  };

  // Listen for QR Pairing Approval event on WebSocket
  useEffect(() => {
    const unsubscribe = wsManager.on('PAIRING_APPROVED', (payload: any) => {
      if (payload && payload.token) {
        setAuthToken(payload.token);
        setTokenState(payload.token);
        if (payload.user) {
          setUser(payload.user);
        }
        refreshUser();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        device,
        token,
        isAuthenticated: !!user,
        isTrusted: !!device?.is_trusted,
        loading,
        login,
        register,
        logout,
        refreshUser,
        devices,
        loadDevices,
        revokeDevice,
        logoutAllOtherDevices
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
