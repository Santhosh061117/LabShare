import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'node:http';
import { db } from '../db/database.js';
import { hashToken } from '../utils/security.js';

export interface WSClient extends WebSocket {
  isAlive: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  currentRoomId?: string;
  pairingCode?: string;
}

export interface WSMessagePayload {
  type: string;
  payload: any;
}

export class WebSocketService {
  private static wss: WebSocketServer | null = null;
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  static init(server: HttpServer): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws' });
    this.wss = wss;

    wss.on('connection', (ws: WSClient, req) => {
      ws.isAlive = true;

      // Parse optional token or pairingCode from query string
      try {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const token = url.searchParams.get('token');
        const pairingCode = url.searchParams.get('pairingCode');
        const roomId = url.searchParams.get('roomId');

        if (token) {
          this.authenticateClient(ws, token);
        }
        if (pairingCode) {
          ws.pairingCode = pairingCode;
        }
        if (roomId) {
          ws.currentRoomId = roomId;
        }
      } catch (err) {
        // Ignore URL parsing errors
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message: WSMessagePayload = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      });

      ws.on('close', () => {
        if (ws.currentRoomId && ws.userId) {
          this.broadcastToRoom(ws.currentRoomId, {
            type: 'USER_LEFT_ROOM',
            payload: {
              userId: ws.userId,
              username: ws.username,
              roomId: ws.currentRoomId
            }
          });
        }
      });
    });

    // Heartbeat check every 30s
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((client) => {
        const ws = client as WSClient;
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('[WebSocket] Server initialized on /ws');
    return wss;
  }

  static stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private static authenticateClient(ws: WSClient, token: string): void {
    const hashed = hashToken(token);
    const session = db.prepare<any>(`
      SELECT s.*, u.username, u.display_name 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashed, Date.now());

    if (session) {
      ws.userId = session.user_id;
      ws.username = session.username;
      ws.displayName = session.display_name;
      ws.send(JSON.stringify({
        type: 'AUTH_SUCCESS',
        payload: { userId: session.user_id, username: session.username, displayName: session.display_name }
      }));
    }
  }

  private static handleClientMessage(ws: WSClient, message: WSMessagePayload): void {
    const { type, payload } = message;

    switch (type) {
      case 'AUTH':
        if (payload?.token) {
          this.authenticateClient(ws, payload.token);
        }
        break;

      case 'LISTEN_PAIRING':
        if (payload?.pairingCode) {
          ws.pairingCode = payload.pairingCode;
        }
        break;

      case 'JOIN_ROOM':
        if (payload?.roomId) {
          ws.currentRoomId = payload.roomId;
          this.broadcastToRoom(payload.roomId, {
            type: 'USER_JOINED_ROOM',
            payload: {
              userId: ws.userId || 'guest',
              displayName: ws.displayName || payload.guestName || 'Guest',
              roomId: payload.roomId
            }
          });
        }
        break;

      case 'LEAVE_ROOM':
        if (ws.currentRoomId) {
          const oldRoom = ws.currentRoomId;
          ws.currentRoomId = undefined;
          this.broadcastToRoom(oldRoom, {
            type: 'USER_LEFT_ROOM',
            payload: {
              userId: ws.userId,
              displayName: ws.displayName,
              roomId: oldRoom
            }
          });
        }
        break;

      case 'TYPING':
        if (ws.currentRoomId) {
          this.broadcastToRoom(ws.currentRoomId, {
            type: 'USER_TYPING',
            payload: {
              userId: ws.userId,
              displayName: ws.displayName || payload?.guestName || 'Guest',
              isTyping: !!payload?.isTyping,
              roomId: ws.currentRoomId
            }
          }, ws); // exclude sender
        }
        break;

      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', payload: { time: Date.now() } }));
        break;
    }
  }

  /**
   * Broadcasts an event to all connected clients in a specific room
   */
  static broadcastToRoom(roomId: string, message: WSMessagePayload, excludeClient?: WSClient): void {
    if (!this.wss) return;
    const msgString = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      const ws = client as WSClient;
      if (ws !== excludeClient && ws.readyState === WebSocket.OPEN && ws.currentRoomId === roomId) {
        ws.send(msgString);
      }
    });
  }

  /**
   * Sends an event to a specific user by userId
   */
  static sendToUser(userId: string, message: WSMessagePayload): void {
    if (!this.wss) return;
    const msgString = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      const ws = client as WSClient;
      if (ws.readyState === WebSocket.OPEN && ws.userId === userId) {
        ws.send(msgString);
      }
    });
  }

  /**
   * Notifies clients listening for a specific QR pairing code that pairing was approved
   */
  static notifyPairingApproved(pairingCode: string, token: string, user: any): void {
    if (!this.wss) return;
    const msgString = JSON.stringify({
      type: 'PAIRING_APPROVED',
      payload: { token, user }
    });
    this.wss.clients.forEach((client) => {
      const ws = client as WSClient;
      if (ws.readyState === WebSocket.OPEN && ws.pairingCode === pairingCode) {
        ws.send(msgString);
      }
    });
  }

  /**
   * Broadcasts a global event to all active clients
   */
  static broadcastGlobal(message: WSMessagePayload): void {
    if (!this.wss) return;
    const msgString = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      const ws = client as WSClient;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msgString);
      }
    });
  }

  /**
   * Returns current active connections count
   */
  static getConnectedCount(): number {
    if (!this.wss) return 0;
    return this.wss.clients.size;
  }
}
