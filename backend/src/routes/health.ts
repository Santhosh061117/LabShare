import { Router } from 'express';
import os from 'node:os';
import { StorageService } from '../services/storageService.js';
import { WebSocketService } from '../services/websocketService.js';
import { db } from '../db/database.js';

const router = Router();
const startTime = Date.now();

router.get('/health', (req, res) => {
  const isTermux = !!(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux'));
  const storage = StorageService.getStorageStats();
  const roomCount = db.prepare<any>(`SELECT COUNT(*) as count FROM rooms WHERE is_closed = 0`).get()?.count || 0;
  const userCount = db.prepare<any>(`SELECT COUNT(*) as count FROM users`).get()?.count || 0;

  res.json({
    status: 'ok',
    app: 'LabShare',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: Date.now(),
    environment: {
      platform: process.platform,
      isTermux,
      nodeVersion: process.version,
      cpuArch: process.arch,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      processMemoryBytes: process.memoryUsage().rss
    },
    metrics: {
      connectedClients: WebSocketService.getConnectedCount(),
      activeRooms: Number(roomCount),
      registeredUsers: Number(userCount),
      storageUsedBytes: storage.totalBytes,
      totalFiles: storage.fileCount
    }
  });
});

export default router;
