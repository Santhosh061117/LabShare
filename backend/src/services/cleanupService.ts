import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';
import { CONFIG } from '../config/index.js';
import { StorageService, FileRecord } from './storageService.js';

export class CleanupService {
  private static timer: NodeJS.Timeout | null = null;

  static start(): void {
    console.log('[CleanupService] Starting periodic background cleanup worker...');
    // Run an initial sweep
    this.runCleanup().catch(err => console.error('[CleanupService] Initial sweep failed:', err));

    // Schedule regular interval
    this.timer = setInterval(() => {
      this.runCleanup().catch(err => console.error('[CleanupService] Scheduled sweep failed:', err));
    }, CONFIG.CLEANUP_INTERVAL_MINUTES * 60 * 1000);
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  static async runCleanup(): Promise<void> {
    const now = Date.now();

    // 1. Clean up expired files
    const expiredFiles = db.prepare<FileRecord>(`
      SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < ?
    `).all(now);

    let deletedFilesCount = 0;
    for (const file of expiredFiles) {
      try {
        await StorageService.deleteFile(file.id);
        deletedFilesCount++;
      } catch (err) {
        console.error(`[CleanupService] Failed to remove expired file ${file.id}:`, err);
      }
    }

    // 2. Clean up expired temporary rooms
    const expiredRooms = db.prepare<any>(`
      SELECT id FROM rooms WHERE expires_at IS NOT NULL AND expires_at < ?
    `).all(now);

    for (const room of expiredRooms) {
      // Find files associated with this room
      const roomFiles = db.prepare<FileRecord>(`SELECT * FROM files WHERE room_id = ?`).all(room.id);
      for (const f of roomFiles) {
        await StorageService.deleteFile(f.id).catch(() => {});
      }
      db.prepare(`DELETE FROM rooms WHERE id = ?`).run(room.id);
    }

    // 3. Clean up expired QR pairing requests
    db.prepare(`DELETE FROM pairing_requests WHERE expires_at < ?`).run(now);

    // 4. Clean up expired sessions
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);

    // 5. Clean up abandoned chunk folders older than 2 hours
    const staleChunkThreshold = now - 2 * 60 * 60 * 1000;
    const staleChunkSessions = db.prepare<any>(`
      SELECT upload_id FROM file_chunk_uploads WHERE created_at < ?
    `).all(staleChunkThreshold);

    for (const s of staleChunkSessions) {
      const dir = path.join(CONFIG.CHUNKS_DIR, s.upload_id);
      if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
      db.prepare(`DELETE FROM file_chunk_uploads WHERE upload_id = ?`).run(s.upload_id);
    }

    if (deletedFilesCount > 0 || expiredRooms.length > 0) {
      console.log(`[CleanupService] Sweep completed: removed ${deletedFilesCount} expired files, ${expiredRooms.length} expired rooms.`);
    }
  }
}
