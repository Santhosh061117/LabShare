import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

// Default data directory: prioritize environment variable, or fallback to ~/.labshare or ./data
const defaultDataDir = process.env.LABSHARE_DATA_DIR 
  || (process.env.HOME ? path.join(process.env.HOME, '.labshare') : path.resolve(process.cwd(), 'data'));

const DATA_DIR = path.resolve(defaultDataDir);
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TEMP_DIR = path.join(DATA_DIR, 'temp');
const CHUNKS_DIR = path.join(DATA_DIR, 'chunks');

// Ensure directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR, TEMP_DIR, CHUNKS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, 'labshare.db'),
  UPLOADS_DIR,
  TEMP_DIR,
  CHUNKS_DIR,
  JWT_SECRET: process.env.JWT_SECRET || 'labshare-termux-secret-key-salt-2026',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_MB || '2048', 10) * 1024 * 1024, // 2 GB
  CHUNK_SIZE_BYTES: parseInt(process.env.CHUNK_SIZE_MB || '5', 10) * 1024 * 1024, // 5 MB
  SESSION_EXPIRY_DAYS: parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10),
  TRUSTED_DEVICE_EXPIRY_DAYS: parseInt(process.env.TRUSTED_DEVICE_EXPIRY_DAYS || '180', 10), // 6 months for trusted devices
  PAIRING_CODE_EXPIRY_SECONDS: 120, // 2 minutes for QR code pairing
  CLEANUP_INTERVAL_MINUTES: 10,
};
