import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { generateRoomCode } from '../utils/security.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { WebSocketService } from '../services/websocketService.js';

const router = Router();

/**
 * 1. Create a Quick Transfer Session / Room
 */
router.post('/create', optionalAuthMiddleware, (req: Request, res: Response) => {
  const roomId = uuidv4();
  const code = generateRoomCode();
  const now = Date.now();
  const expiryHours = 2; // Default 2 hours for quick transfer
  const expiresAt = now + expiryHours * 60 * 60 * 1000;

  const ownerId = req.user?.id || `guest_${uuidv4().slice(0, 8)}`;
  const ownerName = req.user?.displayName || req.guestName || 'Sender';

  db.prepare(`
    INSERT INTO rooms (id, code, name, description, owner_id, password_hash, max_members, is_temporary, is_closed, expires_at, created_at)
    VALUES (?, ?, 'Quick Transfer', 'Temporary peer file transfer', ?, NULL, 10, 1, 0, ?, ?)
  `).run(roomId, code, ownerId, expiresAt, now);

  db.prepare(`
    INSERT INTO room_members (room_id, user_id, guest_name, role, joined_at)
    VALUES (?, ?, ?, 'owner', ?)
  `).run(roomId, ownerId, ownerName, now);

  res.status(201).json({
    success: true,
    room: {
      id: roomId,
      code,
      ownerId,
      ownerName,
      expiresAt,
      isTemporary: true
    }
  });
});

/**
 * 2. Get quick transfer room status
 */
router.get('/:code', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { code } = req.params;
  const now = Date.now();

  const room = db.prepare<any>(`
    SELECT * FROM rooms WHERE code = ? AND is_closed = 0 AND expires_at > ?
  `).get(code.toUpperCase(), now);

  if (!room) {
    res.status(404).json({ error: 'Transfer session not found or expired.' });
    return;
  }

  const files = db.prepare<any>(`
    SELECT id, original_name, file_size, mime_type, uploader_name, created_at, download_count
    FROM files WHERE room_id = ? ORDER BY created_at DESC
  `).all(room.id);

  const clipboard = db.prepare<any>(`
    SELECT id, content, sender_name, created_at 
    FROM clipboard_items WHERE room_id = ? ORDER BY created_at DESC LIMIT 15
  `).all(room.id);

  res.json({
    room: {
      id: room.id,
      code: room.code,
      expiresAt: room.expires_at
    },
    files,
    clipboard
  });
});

export default router;
