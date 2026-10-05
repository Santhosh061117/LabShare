import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { WebSocketService } from '../services/websocketService.js';

const router = Router();

/**
 * Get clipboard history for a room
 */
router.get('/room/:roomId', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId } = req.params;

  const items = db.prepare<any>(`
    SELECT id, room_id, user_id, sender_name, content, created_at
    FROM clipboard_items
    WHERE room_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(roomId);

  res.json({ items });
});

/**
 * Share text to room clipboard
 */
router.post('/', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId, content } = req.body;

  if (!roomId || !content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'Room ID and text content are required.' });
    return;
  }

  const userId = req.user?.id || (req.guestName ? `guest_${uuidv4().slice(0, 8)}` : `guest_${uuidv4().slice(0, 8)}`);
  const senderName = req.user?.displayName || req.guestName || (req.body.guestName?.trim()) || 'Guest';

  const itemId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO clipboard_items (id, room_id, user_id, sender_name, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(itemId, roomId, userId, senderName, content.trim(), now);

  const item = {
    id: itemId,
    roomId,
    userId,
    senderName,
    content: content.trim(),
    createdAt: now
  };

  WebSocketService.broadcastToRoom(roomId, {
    type: 'CLIPBOARD_ITEM_SHARED',
    payload: item
  });

  res.status(201).json({ success: true, item });
});

/**
 * Delete a clipboard item
 */
router.delete('/:id', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const item = db.prepare<any>(`SELECT * FROM clipboard_items WHERE id = ?`).get(id);
  if (!item) {
    res.status(404).json({ error: 'Clipboard item not found.' });
    return;
  }

  db.prepare(`DELETE FROM clipboard_items WHERE id = ?`).run(id);

  WebSocketService.broadcastToRoom(item.room_id, {
    type: 'CLIPBOARD_ITEM_DELETED',
    payload: { id, roomId: item.room_id }
  });

  res.json({ success: true, message: 'Item deleted.' });
});

export default router;
