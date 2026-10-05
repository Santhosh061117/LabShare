import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { hashToken } from '../utils/security.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  deviceId: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      guestName?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : (req.headers['x-session-token'] as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No session token provided.' });
    return;
  }

  const hashed = hashToken(token);
  const now = Date.now();

  const session = db.prepare<any>(`
    SELECT s.id as session_id, s.device_id, s.expires_at,
           u.id as user_id, u.username, u.display_name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashed, now);

  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  // Update device last active timestamp
  db.prepare(`UPDATE devices SET last_active_at = ? WHERE id = ?`).run(now, session.device_id);

  req.user = {
    id: session.user_id,
    username: session.username,
    displayName: session.display_name,
    role: session.role,
    deviceId: session.device_id,
    sessionId: session.session_id
  };

  next();
}

/**
 * Allows optional authentication. If valid token exists, populates req.user.
 * Also checks x-guest-name header for anonymous guest users in public lab rooms.
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : (req.headers['x-session-token'] as string);

  const guestName = (req.headers['x-guest-name'] as string)?.trim();
  if (guestName) {
    req.guestName = guestName.slice(0, 30);
  }

  if (!token) {
    return next();
  }

  try {
    const hashed = hashToken(token);
    const session = db.prepare<any>(`
      SELECT s.id as session_id, s.device_id,
             u.id as user_id, u.username, u.display_name, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashed, Date.now());

    if (session) {
      req.user = {
        id: session.user_id,
        username: session.username,
        displayName: session.display_name,
        role: session.role,
        deviceId: session.device_id,
        sessionId: session.session_id
      };
    }
  } catch (err) {
    // Proceed as unauthenticated
  }

  next();
}
