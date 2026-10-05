import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { CONFIG } from '../config/index.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  hashToken, 
  generatePairingCode 
} from '../utils/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { WebSocketService } from '../services/websocketService.js';
import { StorageService, FileRecord } from '../services/storageService.js';

const router = Router();

// Helper to resolve device name from user-agent
function parseDeviceName(userAgent?: string, customName?: string): string {
  if (customName && customName.trim()) return customName.trim().slice(0, 50);
  if (!userAgent) return 'Unknown Device';
  if (/Android/i.test(userAgent)) return 'Android Device';
  if (/iPhone|iPad/i.test(userAgent)) return 'iOS Device';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'Mac Computer';
  if (/Linux/i.test(userAgent)) return 'Linux Device';
  return 'Web Browser';
}

/**
 * Register a new user
 */
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, displayName, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(cleanUsername);
    if (existing) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const finalDisplayName = (displayName && typeof displayName === 'string' && displayName.trim()) 
      ? displayName.trim().slice(0, 40) 
      : cleanUsername;

    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?)
    `).run(userId, cleanUsername, finalDisplayName, passwordHash, now, now);

    // Auto-create initial session
    const deviceId = uuidv4();
    const deviceName = parseDeviceName(req.headers['user-agent'], req.body.deviceName);
    const isTrusted = !!req.body.trustDevice;

    db.prepare(`
      INSERT INTO devices (id, user_id, device_name, user_agent, ip_address, is_trusted, last_active_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      userId,
      deviceName,
      req.headers['user-agent'] || '',
      req.ip || '',
      isTrusted ? 1 : 0,
      now,
      now
    );

    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = uuidv4();
    const expiryDays = isTrusted ? CONFIG.TRUSTED_DEVICE_EXPIRY_DAYS : CONFIG.SESSION_EXPIRY_DAYS;
    const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;

    db.prepare(`
      INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, deviceId, tokenHash, expiresAt, now);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        username: cleanUsername,
        displayName: finalDisplayName,
        role: 'user'
      },
      device: {
        id: deviceId,
        name: deviceName,
        isTrusted
      },
      expiresAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

/**
 * Login user
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, trustDevice, deviceName: customDeviceName } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = db.prepare<any>(`SELECT * FROM users WHERE username = ?`).get(cleanUsername);

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const isValid = await comparePassword(String(password), user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const now = Date.now();
    const isTrusted = !!trustDevice;
    const deviceId = uuidv4();
    const deviceName = parseDeviceName(req.headers['user-agent'], customDeviceName);

    // Save device
    db.prepare(`
      INSERT INTO devices (id, user_id, device_name, user_agent, ip_address, is_trusted, last_active_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      user.id,
      deviceName,
      req.headers['user-agent'] || '',
      req.ip || '',
      isTrusted ? 1 : 0,
      now,
      now
    );

    // Create session
    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = uuidv4();
    const expiryDays = isTrusted ? CONFIG.TRUSTED_DEVICE_EXPIRY_DAYS : CONFIG.SESSION_EXPIRY_DAYS;
    const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;

    db.prepare(`
      INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, deviceId, tokenHash, expiresAt, now);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        avatarUrl: user.avatar_url
      },
      device: {
        id: deviceId,
        name: deviceName,
        isTrusted
      },
      expiresAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

/**
 * Get current authenticated user profile
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = db.prepare<any>(`
    SELECT id, username, display_name, role, avatar_url, created_at FROM users WHERE id = ?
  `).get(req.user!.id);

  const device = db.prepare<any>(`
    SELECT id, device_name, is_trusted, last_active_at, created_at FROM devices WHERE id = ?
  `).get(req.user!.deviceId);

  res.json({
    user,
    device
  });
});

/**
 * Logout current session
 */
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(req.user!.sessionId);
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * List all active devices for current user
 */
router.get('/devices', authMiddleware, (req: Request, res: Response) => {
  const devices = db.prepare<any>(`
    SELECT d.id, d.device_name, d.ip_address, d.is_trusted, d.last_active_at, d.created_at,
           (CASE WHEN d.id = ? THEN 1 ELSE 0 END) as is_current
    FROM devices d
    WHERE d.user_id = ?
    ORDER BY d.last_active_at DESC
  `).all(req.user!.deviceId, req.user!.id);

  res.json({ devices });
});

/**
 * Revoke a specific device and its sessions
 */
router.delete('/devices/:deviceId', authMiddleware, (req: Request, res: Response) => {
  const { deviceId } = req.params;

  db.prepare(`DELETE FROM sessions WHERE device_id = ? AND user_id = ?`).run(deviceId, req.user!.id);
  db.prepare(`DELETE FROM devices WHERE id = ? AND user_id = ?`).run(deviceId, req.user!.id);

  res.json({ success: true, message: 'Device revoked successfully.' });
});

/**
 * Logout from all other devices
 */
router.post('/devices/logout-all', authMiddleware, (req: Request, res: Response) => {
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`).run(req.user!.id, req.user!.sessionId);
  db.prepare(`DELETE FROM devices WHERE user_id = ? AND id != ?`).run(req.user!.id, req.user!.deviceId);

  res.json({ success: true, message: 'All other sessions have been logged out.' });
});

/**
 * QR PAIRING:
 * 1. Desktop requests a new pairing code
 */
router.post('/qr-pair/init', (req: Request, res: Response) => {
  const code = generatePairingCode();
  const id = uuidv4();
  const now = Date.now();
  const expiresAt = now + CONFIG.PAIRING_CODE_EXPIRY_SECONDS * 1000;
  const deviceName = parseDeviceName(req.headers['user-agent'], req.body.deviceName);

  db.prepare(`
    INSERT INTO pairing_requests (id, code, device_name, status, expires_at, created_at)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).run(id, code, deviceName, expiresAt, now);

  res.json({
    success: true,
    code,
    expiresAt,
    expiresInSeconds: CONFIG.PAIRING_CODE_EXPIRY_SECONDS
  });
});

/**
 * QR PAIRING:
 * 2. Desktop polls status of the pairing request (fallback if WebSocket disconnects)
 */
router.get('/qr-pair/status/:code', (req: Request, res: Response) => {
  const { code } = req.params;
  const now = Date.now();

  const reqRecord = db.prepare<any>(`
    SELECT * FROM pairing_requests WHERE code = ?
  `).get(code);

  if (!reqRecord) {
    res.status(404).json({ error: 'Pairing code not found or invalid' });
    return;
  }

  if (reqRecord.expires_at < now) {
    res.json({ status: 'expired' });
    return;
  }

  if (reqRecord.status === 'approved' && reqRecord.session_token && reqRecord.user_id) {
    const user = db.prepare<any>(`
      SELECT id, username, display_name, role, avatar_url FROM users WHERE id = ?
    `).get(reqRecord.user_id);

    res.json({
      status: 'approved',
      token: reqRecord.session_token,
      user
    });
    return;
  }

  res.json({ status: reqRecord.status });
});

/**
 * QR PAIRING:
 * 3. Authenticated mobile scans QR and approves pairing request
 */
router.post('/qr-pair/approve', authMiddleware, (req: Request, res: Response) => {
  const { code } = req.body;
  const now = Date.now();

  const reqRecord = db.prepare<any>(`
    SELECT * FROM pairing_requests WHERE code = ? AND status = 'pending' AND expires_at > ?
  `).get(code, now);

  if (!reqRecord) {
    res.status(404).json({ error: 'Pairing request not found, already used, or expired.' });
    return;
  }

  // Create new session & device for the target desktop
  const newDeviceId = uuidv4();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const sessionId = uuidv4();
  const expiresAt = now + CONFIG.TRUSTED_DEVICE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT INTO devices (id, user_id, device_name, is_trusted, last_active_at, created_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(newDeviceId, req.user!.id, reqRecord.device_name || 'Paired Desktop', now, now);

  db.prepare(`
    INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, req.user!.id, newDeviceId, tokenHash, expiresAt, now);

  // Update pairing record
  db.prepare(`
    UPDATE pairing_requests 
    SET status = 'approved', user_id = ?, session_token = ?
    WHERE id = ?
  `).run(req.user!.id, token, reqRecord.id);

  const user = db.prepare<any>(`
    SELECT id, username, display_name, role FROM users WHERE id = ?
  `).get(req.user!.id);

  // Notify target via WebSocket instantly
  WebSocketService.notifyPairingApproved(code, token, user);

  res.json({
    success: true,
    message: 'Pairing approved successfully!'
  });
});

/**
 * Export user data (JSON dump for privacy)
 */
router.get('/export-data', authMiddleware, (req: Request, res: Response) => {
  const user = db.prepare<any>(`SELECT id, username, display_name, role, created_at FROM users WHERE id = ?`).get(req.user!.id);
  const messages = db.prepare<any>(`SELECT * FROM messages WHERE user_id = ?`).all(req.user!.id);
  const files = db.prepare<any>(`SELECT id, original_name, file_size, mime_type, created_at FROM files WHERE uploader_id = ?`).all(req.user!.id);
  const rooms = db.prepare<any>(`SELECT * FROM rooms WHERE owner_id = ?`).all(req.user!.id);

  res.setHeader('Content-Disposition', `attachment; filename="labshare-data-${user.username}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ user, rooms, messages, files }, null, 2));
});

/**
 * Delete account and user data
 */
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  // Delete all user uploaded files
  const files = db.prepare<FileRecord>(`SELECT * FROM files WHERE uploader_id = ?`).all(userId);
  for (const f of files) {
    await StorageService.deleteFile(f.id).catch(() => {});
  }

  // Delete DB records
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);

  res.json({ success: true, message: 'Account and associated files permanently deleted.' });
});

export default router;
