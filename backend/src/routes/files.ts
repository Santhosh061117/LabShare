import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { CONFIG } from '../config/index.js';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import { StorageService, FileRecord } from '../services/storageService.js';
import { WebSocketService } from '../services/websocketService.js';
import { sanitizeFilename } from '../utils/security.js';

const router = Router();

// Multer memory storage for direct chunk receipt and small file streams
const upload = multer({
  limits: {
    fileSize: CONFIG.CHUNK_SIZE_BYTES * 2 // Limit individual request payload
  }
});

/**
 * 1. Initialize Resumable / Chunked Upload
 */
router.post('/chunk/init', optionalAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { originalName, fileSize, totalChunks, mimeType, roomId, isTemporary, expiryHours } = req.body;

    if (!originalName || !fileSize || !totalChunks) {
      res.status(400).json({ error: 'originalName, fileSize, and totalChunks are required.' });
      return;
    }

    if (fileSize > CONFIG.MAX_FILE_SIZE_BYTES) {
      res.status(413).json({ 
        error: `File exceeds maximum allowed size of ${CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` 
      });
      return;
    }

    const uploadId = uuidv4();
    const uploaderId = req.user?.id || (req.guestName ? `guest_${uuidv4().slice(0, 8)}` : `guest_${uuidv4().slice(0, 8)}`);
    const uploaderName = req.user?.displayName || req.guestName || (req.body.guestName?.trim()) || 'Guest';

    const now = Date.now();
    const expiresAt = isTemporary ? now + (Number(expiryHours) || 2) * 60 * 60 * 1000 : null;

    StorageService.initChunkUpload({
      uploadId,
      roomId: roomId || null,
      uploaderId,
      uploaderName,
      originalName,
      fileSize: Number(fileSize),
      totalChunks: Number(totalChunks),
      mimeType: mimeType || 'application/octet-stream',
      isTemporary: !!isTemporary,
      expiresAt
    });

    res.json({
      success: true,
      uploadId,
      chunkSizeBytes: CONFIG.CHUNK_SIZE_BYTES,
      totalChunks: Number(totalChunks)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize chunk upload' });
  }
});

/**
 * 2. Upload an individual chunk
 */
router.post('/chunk', upload.single('chunk'), async (req: Request, res: Response) => {
  try {
    const { uploadId, chunkIndex } = req.body;

    if (!uploadId || chunkIndex === undefined || !req.file) {
      res.status(400).json({ error: 'uploadId, chunkIndex, and chunk file are required.' });
      return;
    }

    const result = await StorageService.saveChunk(
      uploadId,
      parseInt(chunkIndex, 10),
      req.file.buffer
    );

    res.json({
      success: true,
      chunksReceived: result.chunksReceived,
      totalChunks: result.totalChunks,
      isComplete: result.isComplete
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save chunk' });
  }
});

/**
 * 3. Complete chunked upload and assemble file
 */
router.post('/chunk/complete', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      res.status(400).json({ error: 'uploadId is required.' });
      return;
    }

    const fileRecord = await StorageService.assembleChunks(uploadId);

    // Notify room via WebSocket if roomId present
    if (fileRecord.room_id) {
      WebSocketService.broadcastToRoom(fileRecord.room_id, {
        type: 'NEW_FILE',
        payload: {
          id: fileRecord.id,
          roomId: fileRecord.room_id,
          originalName: fileRecord.original_name,
          fileSize: fileRecord.file_size,
          mimeType: fileRecord.mime_type,
          uploaderName: fileRecord.uploader_name,
          createdAt: fileRecord.created_at
        }
      });
    }

    res.json({
      success: true,
      file: fileRecord
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to assemble file' });
  }
});

/**
 * List files in a room
 */
router.get('/room/:roomId', optionalAuthMiddleware, (req: Request, res: Response) => {
  const { roomId } = req.params;

  const files = db.prepare<any>(`
    SELECT id, room_id, uploader_id, uploader_name, original_name,
           file_size, mime_type, is_temporary, expires_at, download_count, created_at
    FROM files
    WHERE room_id = ?
    ORDER BY created_at DESC
  `).all(roomId);

  res.json({ files });
});

/**
 * Stream download file with range and content headers
 */
router.get('/:id/download', (req: Request, res: Response) => {
  const { id } = req.params;
  const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(id);

  if (!fileRecord) {
    res.status(404).json({ error: 'File not found or expired.' });
    return;
  }

  const filePath = StorageService.getFilePath(fileRecord);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Physical file is missing from storage.' });
    return;
  }

  StorageService.incrementDownloadCount(id);

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`);
  res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
  res.setHeader('Content-Length', fileRecord.file_size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * View / Stream media with HTTP 206 Partial Content (Video/Audio seeking, Image preview, Document view)
 */
router.get('/:id/view', (req: Request, res: Response) => {
  const { id } = req.params;
  const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(id);

  if (!fileRecord) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  const filePath = StorageService.getFilePath(fileRecord);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Physical file missing.' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse range: e.g. "bytes=0-1048575"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': fileRecord.mime_type || 'application/octet-stream'
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': fileRecord.mime_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.original_name)}"`
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * View file content as text (for C, C++, Java, Python, Verilog, Quartus, logs, etc.)
 */
router.get('/:id/text', (req: Request, res: Response) => {
  const { id } = req.params;
  const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(id);

  if (!fileRecord) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  // Cap text preview to 2MB to protect Termux memory
  if (fileRecord.file_size > 2 * 1024 * 1024) {
    res.status(400).json({ error: 'File is too large for inline text preview (>2MB). Please download instead.' });
    return;
  }

  const filePath = StorageService.getFilePath(fileRecord);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Physical file missing.' });
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * Delete a file (uploader or room owner)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(id);

  if (!fileRecord) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  let canDelete = fileRecord.uploader_id === req.user!.id;
  if (!canDelete && fileRecord.room_id) {
    const room = db.prepare<any>(`SELECT owner_id FROM rooms WHERE id = ?`).get(fileRecord.room_id);
    if (room && room.owner_id === req.user!.id) {
      canDelete = true;
    }
  }

  if (!canDelete) {
    res.status(403).json({ error: 'You do not have permission to delete this file.' });
    return;
  }

  await StorageService.deleteFile(id);

  if (fileRecord.room_id) {
    WebSocketService.broadcastToRoom(fileRecord.room_id, {
      type: 'FILE_DELETED',
      payload: { fileId: id, roomId: fileRecord.room_id }
    });
  }

  res.json({ success: true, message: 'File deleted successfully.' });
});

export default router;
