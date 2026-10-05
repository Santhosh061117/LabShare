import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { CONFIG } from '../config/index.js';
import { db } from '../db/database.js';
import { assertSafePath, sanitizeFilename } from '../utils/security.js';
import { v4 as uuidv4 } from 'uuid';

export interface FileRecord {
  id: string;
  room_id: string | null;
  uploader_id: string;
  uploader_name: string;
  original_name: string;
  stored_name: string;
  file_size: number;
  mime_type: string;
  is_temporary: number;
  expires_at: number | null;
  download_count: number;
  created_at: number;
}

export class StorageService {
  /**
   * Initializes a chunked upload session
   */
  static initChunkUpload(params: {
    uploadId: string;
    roomId: string | null;
    uploaderId: string;
    uploaderName: string;
    originalName: string;
    fileSize: number;
    totalChunks: number;
    mimeType: string;
    isTemporary?: boolean;
    expiresAt?: number | null;
  }): void {
    const safeOriginal = sanitizeFilename(params.originalName);
    const storedName = `${params.uploadId}_${safeOriginal}`;
    const uploadChunkDir = path.join(CONFIG.CHUNKS_DIR, params.uploadId);

    if (!fs.existsSync(uploadChunkDir)) {
      fs.mkdirSync(uploadChunkDir, { recursive: true });
    }

    db.prepare(`
      INSERT INTO file_chunk_uploads (
        upload_id, room_id, uploader_id, uploader_name, original_name, stored_name,
        file_size, total_chunks, chunks_received, mime_type, is_temporary, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      params.uploadId,
      params.roomId,
      params.uploaderId,
      params.uploaderName,
      safeOriginal,
      storedName,
      params.fileSize,
      params.totalChunks,
      params.mimeType || 'application/octet-stream',
      params.isTemporary ? 1 : 0,
      params.expiresAt || null,
      Date.now()
    );
  }

  /**
   * Saves an individual chunk to disk
   */
  static async saveChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<{ chunksReceived: number; totalChunks: number; isComplete: boolean }> {
    const session = db.prepare<any>(`SELECT * FROM file_chunk_uploads WHERE upload_id = ?`).get(uploadId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    const uploadChunkDir = path.join(CONFIG.CHUNKS_DIR, uploadId);
    const chunkPath = path.join(uploadChunkDir, `chunk_${chunkIndex}`);

    if (!assertSafePath(chunkPath, CONFIG.CHUNKS_DIR)) {
      throw new Error('Invalid chunk path');
    }

    // Write chunk
    await fs.promises.writeFile(chunkPath, chunkBuffer);

    // Update chunk count
    const files = await fs.promises.readdir(uploadChunkDir);
    const chunksCount = files.filter(f => f.startsWith('chunk_')).length;

    db.prepare(`UPDATE file_chunk_uploads SET chunks_received = ? WHERE upload_id = ?`).run(chunksCount, uploadId);

    return {
      chunksReceived: chunksCount,
      totalChunks: session.total_chunks,
      isComplete: chunksCount >= session.total_chunks
    };
  }

  /**
   * Assembles all chunks into the final stored file using streams.
   * Completely avoids loading large files into RAM.
   */
  static async assembleChunks(uploadId: string): Promise<FileRecord> {
    const session = db.prepare<any>(`SELECT * FROM file_chunk_uploads WHERE upload_id = ?`).get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    const uploadChunkDir = path.join(CONFIG.CHUNKS_DIR, uploadId);
    const targetDir = session.is_temporary ? CONFIG.TEMP_DIR : CONFIG.UPLOADS_DIR;
    const finalFilePath = path.join(targetDir, session.stored_name);

    if (!assertSafePath(finalFilePath, targetDir)) {
      throw new Error('Illegal file destination path');
    }

    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < session.total_chunks; i++) {
      const chunkPath = path.join(uploadChunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        throw new Error(`Missing chunk index ${i}`);
      }

      const readStream = fs.createReadStream(chunkPath);
      await pipeline(readStream, writeStream, { end: false });
    }

    writeStream.end();

    // Clean up temporary chunk folder
    try {
      await fs.promises.rm(uploadChunkDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[Storage] Failed to cleanup chunks dir for ${uploadId}:`, err);
    }

    // Insert record in files table
    const fileId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO files (
        id, room_id, uploader_id, uploader_name, original_name, stored_name,
        file_size, mime_type, is_temporary, expires_at, download_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      fileId,
      session.room_id,
      session.uploader_id,
      session.uploader_name,
      session.original_name,
      session.stored_name,
      session.file_size,
      session.mime_type,
      session.is_temporary,
      session.expires_at,
      now
    );

    // Remove from chunk uploads table
    db.prepare(`DELETE FROM file_chunk_uploads WHERE upload_id = ?`).run(uploadId);

    const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(fileId);
    if (!fileRecord) {
      throw new Error('Failed to retrieve created file record');
    }

    return fileRecord;
  }

  /**
   * Gets absolute filesystem path for a file record
   */
  static getFilePath(fileRecord: FileRecord): string {
    const dir = fileRecord.is_temporary ? CONFIG.TEMP_DIR : CONFIG.UPLOADS_DIR;
    const filePath = path.join(dir, fileRecord.stored_name);
    if (!assertSafePath(filePath, dir)) {
      throw new Error('Invalid path traversal attempt');
    }
    return filePath;
  }

  /**
   * Deletes a file from disk and database
   */
  static async deleteFile(fileId: string): Promise<boolean> {
    const fileRecord = db.prepare<FileRecord>(`SELECT * FROM files WHERE id = ?`).get(fileId);
    if (!fileRecord) return false;

    const filePath = this.getFilePath(fileRecord);
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.error(`[Storage] Failed to delete file ${filePath}:`, err);
      }
    }

    db.prepare(`DELETE FROM files WHERE id = ?`).run(fileId);
    return true;
  }

  /**
   * Increments download count
   */
  static incrementDownloadCount(fileId: string): void {
    db.prepare(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`).run(fileId);
  }

  /**
   * Calculates overall storage metrics
   */
  static getStorageStats(): {
    totalBytes: number;
    fileCount: number;
    largestFiles: FileRecord[];
    roomBreakdown: { room_id: string | null; count: number; total_bytes: number }[];
  } {
    const stats = db.prepare<any>(`
      SELECT COUNT(*) as file_count, COALESCE(SUM(file_size), 0) as total_bytes FROM files
    `).get();

    const largestFiles = db.prepare<FileRecord>(`
      SELECT * FROM files ORDER BY file_size DESC LIMIT 10
    `).all();

    const roomBreakdown = db.prepare<any>(`
      SELECT room_id, COUNT(*) as count, SUM(file_size) as total_bytes 
      FROM files 
      GROUP BY room_id
    `).all();

    return {
      totalBytes: Number(stats?.total_bytes || 0),
      fileCount: Number(stats?.file_count || 0),
      largestFiles,
      roomBreakdown
    };
  }
}
