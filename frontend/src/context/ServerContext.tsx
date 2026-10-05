import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl, setApiBaseUrl, api } from '../services/api';
import { wsManager } from '../services/ws';
import { ServerHealth } from '../types';

interface ServerContextType {
  backendUrl: string;
  isOnline: boolean;
  checking: boolean;
  pingMs: number | null;
  health: ServerHealth | null;
  lastChecked: number | null;
  changeBackendUrl: (newUrl: string) => Promise<boolean>;
  checkHealthNow: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendUrl, setBackendUrlState] = useState<string>(getApiBaseUrl());
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const checkHealthNow = useCallback(async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const data: ServerHealth = await api.getHealth();
      const duration = Math.round(performance.now() - start);
      setPingMs(duration);
      setHealth(data);
      setIsOnline(true);
      setLastChecked(Date.now());
    } catch (err) {
      setIsOnline(false);
      setHealth(null);
      setPingMs(null);
      setLastChecked(Date.now());
    } finally {
      setChecking(false);
    }
  }, []);

  const changeBackendUrl = async (newUrl: string): Promise<boolean> => {
    setApiBaseUrl(newUrl);
    setBackendUrlState(getApiBaseUrl());
    wsManager.disconnect();
    
    setChecking(true);
    const start = performance.now();
    try {
      const data: ServerHealth = await api.getHealth();
      const duration = Math.round(performance.now() - start);
      setPingMs(duration);
      setHealth(data);
      setIsOnline(true);
      setLastChecked(Date.now());
      wsManager.connect();
      return true;
    } catch (err) {
      setIsOnline(false);
      setHealth(null);
      setPingMs(null);
      setLastChecked(Date.now());
      return false;
    } finally {
      setChecking(false);
    }
  };

  // Initial check & periodic polling every 12 seconds
  useEffect(() => {
    checkHealthNow();
    wsManager.connect();

    const interval = setInterval(() => {
      checkHealthNow();
    }, 12000);

    return () => {
      clearInterval(interval);
    };
  }, [checkHealthNow]);

  return (
    <ServerContext.Provider
      value={{
        backendUrl,
        isOnline,
        checking,
        pingMs,
        health,
        lastChecked,
        changeBackendUrl,
        checkHealthNow
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within ServerProvider');
  return ctx;
};
