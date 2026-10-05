import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { CONFIG } from '../config/index.js';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LAB-${code.slice(0, 3)}-${code.slice(3)}`;
}

export function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
}

/**
 * Sanitizes original filename to prevent directory traversal and filesystem issues.
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path traversal components
  const base = path.basename(filename);
  // Replace invalid characters, preserve extension
  return base.replace(/[^a-zA-Z0-9._\-+ ]/g, '_');
}

/**
 * Validates that targetFilePath is strictly inside baseDir.
 * Prevents directory traversal attacks like ../../../etc/passwd.
 */
export function assertSafePath(targetFilePath: string, baseDir: string = CONFIG.UPLOADS_DIR): boolean {
  const resolvedTarget = path.resolve(targetFilePath);
  const resolvedBase = path.resolve(baseDir);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}
