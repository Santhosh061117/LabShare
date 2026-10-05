import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import { WebSocketService } from '../services/websocketService.js';

const router = Router({ mergeParams: true });

/**
 * Get messages in room with pagination (limit + before timestamp)
 */
router.get('/', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string || '50', 10), 1), 100);
  const before = parseInt(req.query.before as string || '0', 10);
  const userId = req.user?.id;

  let query = `
    SELECT m.id, m.room_id, m.user_id, m.sender_name, m.content, m.reply_to_id,
           m.is_pinned, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
           r_orig.content as reply_content, r_orig.sender_name as reply_sender_name,
           (CASE WHEN mb.message_id IS NOT NULL THEN 1 ELSE 0 END) as is_bookmarked
    FROM messages m
    LEFT JOIN messages r_orig ON m.reply_to_id = r_orig.id
    LEFT JOIN message_bookmarks mb ON m.id = mb.message_id AND mb.user_id = ?
    WHERE m.room_id = ?
  `;
  const params: any[] = [userId || '', roomId];

  if (before > 0) {
    query += ` AND m.created_at < ?`;
    params.push(before);
  }

  query += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(limit);

  const rawMessages = db.prepare<any>(query).all(...params);

  // Fetch reactions for these messages
  const messageIds = rawMessages.map(m => m.id);
  let reactionsMap = new Map<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }[]>();

  if (messageIds.length > 0) {
    const placeholders = messageIds.map(() => '?').join(',');
    const reactions = db.prepare<any>(`
      SELECT mr.message_id, mr.emoji, mr.user_id, u.display_name
      FROM message_reactions mr
      LEFT JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id IN (${placeholders})
    `).all(...messageIds);

    for (const r of reactions) {
      if (!reactionsMap.has(r.message_id)) {
        reactionsMap.set(r.message_id, []);
      }
      const list = reactionsMap.get(r.message_id)!;
      let existing = list.find(item => item.emoji === r.emoji);
      if (!existing) {
        existing = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
        list.push(existing);
      }
      existing.count++;
      existing.users.push(r.display_name || 'User');
      if (r.user_id === userId) {
        existing.hasReacted = true;
      }
    }
  }

  // Reverse so oldest first in current batch
  const messages = rawMessages.reverse().map(m => ({
    ...m,
    reactions: reactionsMap.get(m.id) || []
  }));

  res.json({ messages });
});

/**
 * Send a message to the room
 */
router.post('/', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { content, replyToId } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'Message content cannot be empty.' });
    return;
  }

  const userId = req.user?.id || `guest_${uuidv4().slice(0, 8)}`;
  const senderName = req.user?.displayName || req.guestName || (req.body.guestName?.trim()) || 'Guest';

  const messageId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO messages (id, room_id, user_id, sender_name, content, reply_to_id, is_pinned, is_edited, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(messageId, roomId, userId, senderName, content.trim(), replyToId || null, now, now);

  // Fetch created message with reply info
  const created = db.prepare<any>(`
    SELECT m.*, r_orig.content as reply_content, r_orig.sender_name as reply_sender_name
    FROM messages m
    LEFT JOIN messages r_orig ON m.reply_to_id = r_orig.id
    WHERE m.id = ?
  `).get(messageId);

  const messagePayload = {
    ...created,
    reactions: [],
    is_bookmarked: 0
  };

  // Broadcast to room members via WebSocket
  WebSocketService.broadcastToRoom(roomId, {
    type: 'NEW_MESSAGE',
    payload: messagePayload
  });

  res.status(201).json({ success: true, message: messagePayload });
});

/**
 * Edit a message
 */
router.put('/:messageId', authMiddleware, (req: Request, res: Response) => {
  const { roomId, messageId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Updated message content is required.' });
    return;
  }

  const msg = db.prepare<any>(`SELECT * FROM messages WHERE id = ? AND room_id = ?`).get(messageId, roomId);
  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  if (msg.user_id !== req.user!.id) {
    res.status(403).json({ error: 'You can only edit your own messages.' });
    return;
  }

  const now = Date.now();
  db.prepare(`UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?`).run(content.trim(), now, messageId);

  WebSocketService.broadcastToRoom(roomId, {
    type: 'MESSAGE_EDITED',
    payload: { messageId, content: content.trim(), updatedAt: now, roomId }
  });

  res.json({ success: true, messageId, content: content.trim() });
});

/**
 * Delete a message
 */
router.delete('/:messageId', authMiddleware, (req: Request, res: Response) => {
  const { roomId, messageId } = req.params;

  const msg = db.prepare<any>(`SELECT * FROM messages WHERE id = ? AND room_id = ?`).get(messageId, roomId);
  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  const room = db.prepare<any>(`SELECT owner_id FROM rooms WHERE id = ?`).get(roomId);
  const isOwner = room && room.owner_id === req.user!.id;
  const isAuthor = msg.user_id === req.user!.id;

  if (!isAuthor && !isOwner) {
    res.status(403).json({ error: 'You do not have permission to delete this message.' });
    return;
  }

  db.prepare(`UPDATE messages SET is_deleted = 1, content = '[Message deleted]' WHERE id = ?`).run(messageId);

  WebSocketService.broadcastToRoom(roomId, {
    type: 'MESSAGE_DELETED',
    payload: { messageId, roomId }
  });

  res.json({ success: true, messageId });
});

/**
 * Add or remove reaction to a message
 */
router.post('/:messageId/reactions', authMiddleware, (req: Request, res: Response) => {
  const { roomId, messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji || typeof emoji !== 'string') {
    res.status(400).json({ error: 'Emoji is required.' });
    return;
  }

  const existing = db.prepare<any>(`
    SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
  `).get(messageId, req.user!.id, emoji);

  if (existing) {
    db.prepare(`DELETE FROM message_reactions WHERE id = ?`).run(existing.id);
  } else {
    db.prepare(`
      INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), messageId, req.user!.id, emoji, Date.now());
  }

  // Get updated reactions
  const reactions = db.prepare<any>(`
    SELECT emoji, COUNT(*) as count FROM message_reactions WHERE message_id = ? GROUP BY emoji
  `).all(messageId);

  WebSocketService.broadcastToRoom(roomId, {
    type: 'MESSAGE_REACTION_UPDATED',
    payload: { messageId, reactions, roomId }
  });

  res.json({ success: true, reactions });
});

/**
 * Toggle pin message
 */
router.post('/:messageId/pin', authMiddleware, (req: Request, res: Response) => {
  const { roomId, messageId } = req.params;

  const msg = db.prepare<any>(`SELECT is_pinned FROM messages WHERE id = ? AND room_id = ?`).get(messageId, roomId);
  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  const newPinned = msg.is_pinned ? 0 : 1;
  db.prepare(`UPDATE messages SET is_pinned = ? WHERE id = ?`).run(newPinned, messageId);

  WebSocketService.broadcastToRoom(roomId, {
    type: 'MESSAGE_PIN_UPDATED',
    payload: { messageId, isPinned: !!newPinned, roomId }
  });

  res.json({ success: true, isPinned: !!newPinned });
});

/**
 * Toggle bookmark message
 */
router.post('/:messageId/bookmark', authMiddleware, (req: Request, res: Response) => {
  const { messageId } = req.params;

  const existing = db.prepare<any>(`
    SELECT * FROM message_bookmarks WHERE user_id = ? AND message_id = ?
  `).get(req.user!.id, messageId);

  if (existing) {
    db.prepare(`DELETE FROM message_bookmarks WHERE user_id = ? AND message_id = ?`).run(req.user!.id, messageId);
    res.json({ success: true, isBookmarked: false });
  } else {
    db.prepare(`
      INSERT INTO message_bookmarks (user_id, message_id, created_at)
      VALUES (?, ?, ?)
    `).run(req.user!.id, messageId, Date.now());
    res.json({ success: true, isBookmarked: true });
  }
});

/**
 * Search messages in room
 */
router.get('/search', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId } = req.params;
  const q = String(req.query.q || '').trim();

  if (!q) {
    res.json({ results: [] });
    return;
  }

  const results = db.prepare<any>(`
    SELECT id, room_id, user_id, sender_name, content, created_at
    FROM messages
    WHERE room_id = ? AND is_deleted = 0 AND content LIKE ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(roomId, `%${q}%`);

  res.json({ results });
});

export default router;
