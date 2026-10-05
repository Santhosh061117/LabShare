import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService.js';
import { CleanupService } from '../services/cleanupService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Get storage statistics and largest files
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = StorageService.getStorageStats();
    res.json({
      success: true,
      stats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve storage stats' });
  }
});

/**
 * Run immediate storage cleanup (removes expired files, rooms, chunks)
 */
router.post('/cleanup', authMiddleware, async (req: Request, res: Response) => {
  try {
    await CleanupService.runCleanup();
    const updatedStats = StorageService.getStorageStats();

    res.json({
      success: true,
      message: 'Storage cleanup completed successfully.',
      stats: updatedStats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Storage cleanup failed' });
  }
});

export default router;
