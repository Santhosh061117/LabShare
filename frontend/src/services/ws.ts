import { getApiBaseUrl, getAuthToken } from './api';

type Listener = (payload: any) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimeout: any = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 15000;
  private isExplicitlyClosed = false;
  private pingInterval: any = null;
  public isConnected = false;

  private getWsUrl(): string {
    const apiBase = getApiBaseUrl();
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${protocol}//${url.host}/ws${tokenParam}`;
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      const wsUrl = this.getWsUrl();
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectDelay = 1000; // Reset backoff
        this.emit('STATUS_CHANGE', { connected: true });

        // Authenticate if token exists
        const token = getAuthToken();
        if (token) {
          this.send('AUTH', { token });
        }

        // Setup ping every 25s
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.send('PING', {});
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            this.emit(data.type, data.payload);
          }
        } catch (err) {
          console.error('[WS Client] Failed to parse event:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.emit('STATUS_CHANGE', { connected: false });
        if (this.pingInterval) clearInterval(this.pingInterval);

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        this.isConnected = false;
      };
    } catch (err) {
      console.error('[WS Client] Connection initialization error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public send(type: string, payload: any = {}): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  public on(type: string, listener: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.off(type, listener);
    };
  }

  public off(type: string, listener: Listener): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(type: string, payload: any): void {
    const set = this.listeners.get(type);
    if (set) {
      set.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[WS Client] Listener error for ${type}:`, err);
        }
      });
    }
  }
}

export const wsManager = new WebSocketManager();
