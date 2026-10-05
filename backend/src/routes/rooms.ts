import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { generateRoomCode, hashPassword, comparePassword } from '../utils/security.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { WebSocketService } from '../services/websocketService.js';
import { StorageService, FileRecord } from '../services/storageService.js';

const router = Router();

/**
 * Create a new room
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, password, maxMembers, isTemporary, expiryHours } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Room name is required.' });
      return;
    }

    const roomId = uuidv4();
    const code = generateRoomCode();
    const now = Date.now();
    const isTemp = !!isTemporary;
    const expiresAt = isTemp ? now + (Number(expiryHours) || 4) * 60 * 60 * 1000 : null;
    const passwordHash = password ? await hashPassword(password) : null;
    const max = Math.min(Math.max(Number(maxMembers) || 50, 2), 200);

    db.prepare(`
      INSERT INTO rooms (id, code, name, description, owner_id, password_hash, max_members, is_temporary, is_closed, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      roomId,
      code,
      name.trim().slice(0, 60),
      description ? String(description).slice(0, 200) : null,
      req.user!.id,
      passwordHash,
      max,
      isTemp ? 1 : 0,
      expiresAt,
      now
    );

    // Add owner as room member
    db.prepare(`
      INSERT INTO room_members (room_id, user_id, guest_name, role, joined_at)
      VALUES (?, ?, NULL, 'owner', ?)
    `).run(roomId, req.user!.id, now);

    res.status(201).json({
      success: true,
      room: {
        id: roomId,
        code,
        name: name.trim(),
        description,
        ownerId: req.user!.id,
        isPasswordProtected: !!passwordHash,
        maxMembers: max,
        isTemporary: isTemp,
        expiresAt,
        createdAt: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

/**
 * List rooms (active rooms user has joined, plus active public rooms)
 */
router.get('/', optionalAuthMiddleware, (req: Request, res: Response) => {
  const userId = req.user?.id;
  const now = Date.now();

  let rooms: any[] = [];
  if (userId) {
    rooms = db.prepare<any>(`
      SELECT r.id, r.code, r.name, r.description, r.owner_id, 
             (CASE WHEN r.password_hash IS NOT NULL THEN 1 ELSE 0 END) as is_password_protected,
             r.max_members, r.is_temporary, r.is_closed, r.expires_at, r.created_at,
             (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count,
             (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) as message_count,
             (CASE WHEN rm2.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_member
      FROM rooms r
      LEFT JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = ?
      WHERE r.is_closed = 0 AND (r.expires_at IS NULL OR r.expires_at > ?)
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all(userId, now);
  } else {
    rooms = db.prepare<any>(`
      SELECT r.id, r.code, r.name, r.description, r.owner_id, 
             (CASE WHEN r.password_hash IS NOT NULL THEN 1 ELSE 0 END) as is_password_protected,
             r.max_members, r.is_temporary, r.is_closed, r.expires_at, r.created_at,
             (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count,
             (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) as message_count,
             0 as is_member
      FROM rooms r
      WHERE r.is_closed = 0 AND (r.expires_at IS NULL OR r.expires_at > ?)
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all(now);
  }

  res.json({ rooms });
});

/**
 * Join room by code or ID
 */
router.post('/join', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, password, guestName } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Room code is required.' });
      return;
    }

    const cleanCode = String(code).trim().toUpperCase();
    const now = Date.now();

    const room = db.prepare<any>(`
      SELECT * FROM rooms WHERE code = ? AND is_closed = 0 AND (expires_at IS NULL OR expires_at > ?)
    `).get(cleanCode, now);

    if (!room) {
      res.status(404).json({ error: 'Room not found, closed, or expired.' });
      return;
    }

    // Verify password if set
    if (room.password_hash) {
      if (!password) {
        res.status(401).json({ error: 'Room password is required.', requiresPassword: true });
        return;
      }
      const match = await comparePassword(String(password), room.password_hash);
      if (!match) {
        res.status(401).json({ error: 'Incorrect room password.' });
        return;
      }
    }

    // Check member capacity
    const currentMemberCount = db.prepare<any>(`
      SELECT COUNT(*) as count FROM room_members WHERE room_id = ?
    `).get(room.id)?.count || 0;

    if (currentMemberCount >= room.max_members) {
      res.status(403).json({ error: 'Room has reached maximum member capacity.' });
      return;
    }

    const userId = req.user?.id || (req.guestName ? `guest_${uuidv4().slice(0, 8)}` : `guest_${uuidv4().slice(0, 8)}`);
    const finalGuestName = req.user ? null : (guestName || req.guestName || 'Guest Student');

    // Add or ignore if already member
    db.prepare(`
      INSERT OR IGNORE INTO room_members (room_id, user_id, guest_name, role, joined_at)
      VALUES (?, ?, ?, 'member', ?)
    `).run(room.id, userId, finalGuestName, now);

    WebSocketService.broadcastToRoom(room.id, {
      type: 'MEMBER_JOINED',
      payload: {
        roomId: room.id,
        userId,
        name: req.user?.displayName || finalGuestName
      }
    });

    res.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        ownerId: room.owner_id,
        isOwner: req.user?.id === room.owner_id,
        expiresAt: room.expires_at
      },
      user: {
        id: userId,
        name: req.user?.displayName || finalGuestName,
        isGuest: !req.user
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to join room' });
  }
});

/**
 * Get single room details
 */
router.get('/:id', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const now = Date.now();

  const room = db.prepare<any>(`
    SELECT id, code, name, description, owner_id, 
           (CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) as is_password_protected,
           max_members, is_temporary, is_closed, expires_at, created_at
    FROM rooms 
    WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)
  `).get(id, now);

  if (!room) {
    res.status(404).json({ error: 'Room not found or expired.' });
    return;
  }

  const members = db.prepare<any>(`
    SELECT rm.user_id, rm.role, rm.guest_name, rm.joined_at,
           u.username, u.display_name
    FROM room_members rm
    LEFT JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ?
    ORDER BY rm.joined_at ASC
  `).all(id);

  res.json({
    room: {
      ...room,
      isOwner: req.user?.id === room.owner_id,
      members: members.map(m => ({
        userId: m.user_id,
        role: m.role,
        name: m.display_name || m.guest_name || 'Guest User',
        username: m.username,
        joinedAt: m.joined_at
      }))
    }
  });
});

/**
 * Close room (owner only)
 */
router.post('/:id/close', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const room = db.prepare<any>(`SELECT * FROM rooms WHERE id = ?`).get(id);

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  if (room.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the room owner can close this room.' });
    return;
  }

  db.prepare(`UPDATE rooms SET is_closed = 1 WHERE id = ?`).run(id);

  WebSocketService.broadcastToRoom(id, {
    type: 'ROOM_CLOSED',
    payload: { roomId: id }
  });

  res.json({ success: true, message: 'Room closed.' });
});

/**
 * Delete room and its files permanently (owner only)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const room = db.prepare<any>(`SELECT * FROM rooms WHERE id = ?`).get(id);

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  if (room.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the room owner can delete this room.' });
    return;
  }

  // Delete all files in room
  const files = db.prepare<FileRecord>(`SELECT * FROM files WHERE room_id = ?`).all(id);
  for (const f of files) {
    await StorageService.deleteFile(f.id).catch(() => {});
  }

  db.prepare(`DELETE FROM rooms WHERE id = ?`).run(id);

  WebSocketService.broadcastToRoom(id, {
    type: 'ROOM_DELETED',
    payload: { roomId: id }
  });

  res.json({ success: true, message: 'Room deleted permanently.' });
});

/**
 * Kick member from room (owner only)
 */
router.delete('/:id/members/:targetUserId', authMiddleware, (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  const room = db.prepare<any>(`SELECT * FROM rooms WHERE id = ?`).get(id);

  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  if (room.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the room owner can remove members.' });
    return;
  }

  if (targetUserId === room.owner_id) {
    res.status(400).json({ error: 'Room owner cannot be kicked.' });
    return;
  }

  db.prepare(`DELETE FROM room_members WHERE room_id = ? AND user_id = ?`).run(id, targetUserId);

  WebSocketService.broadcastToRoom(id, {
    type: 'MEMBER_KICKED',
    payload: { roomId: id, userId: targetUserId }
  });

  res.json({ success: true, message: 'Member removed.' });
});

export default router;
