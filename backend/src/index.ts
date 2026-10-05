import express from 'express';
import http from 'node:http';
import cors from 'cors';
import os from 'node:os';
import { CONFIG } from './config/index.js';
import { db } from './db/database.js';
import { initializeDatabase as runSchemaMigrations } from './db/schema.js';
import { WebSocketService } from './services/websocketService.js';
import { CleanupService } from './services/cleanupService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Route imports
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import messagesRouter from './routes/messages.js';
import filesRouter from './routes/files.js';
import quickTransferRouter from './routes/quickTransfer.js';
import clipboardRouter from './routes/clipboard.js';
import storageRouter from './routes/storage.js';

const app = express();
const server = http.createServer(app);

// CORS configuration to allow GitHub Pages, localhost, and custom tunnel domains
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Termux local curls) or any domain
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'x-guest-name', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter for API calls
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/rooms/:roomId/messages', messagesRouter);
app.use('/api/files', filesRouter);
app.use('/api/quick-transfer', quickTransferRouter);
app.use('/api/clipboard', clipboardRouter);
app.use('/api/storage', storageRouter);

// Central error handler
app.use(errorHandler);

// Helper to list network interfaces for friendly Termux startup display
function getNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Graceful shutdown
let isShuttingDown = false;
function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[LabShare] Received ${signal}. Gracefully stopping server and closing resources...`);
  
  CleanupService.stop();
  WebSocketService.stop();

  server.close(() => {
    console.log('[LabShare] HTTP and WebSocket listeners closed.');
    db.close();
    console.log('[LabShare] Database connection closed safely.');
    process.exit(0);
  });

  // Force exit if hanging
  setTimeout(() => {
    console.error('[LabShare] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Startup execution
async function startServer() {
  try {
    // 1. Initialize DB & Schema
    runSchemaMigrations();

    // 2. Initialize WebSocket Server
    WebSocketService.init(server);

    // 3. Start background cleanup worker
    CleanupService.start();

    // 4. Start HTTP listener
    server.listen(CONFIG.PORT, CONFIG.HOST, () => {
      const isTermux = !!(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux'));
      const addresses = getNetworkAddresses();

      console.log('====================================================');
      console.log('  LabShare Server Started Successfully!  ');
      console.log('====================================================');
      console.log(`  Environment: ${isTermux ? 'Android Termux' : process.platform}`);
      console.log(`  Local URL:   http://localhost:${CONFIG.PORT}`);
      addresses.forEach(ip => {
        console.log(`  Network URL: http://${ip}:${CONFIG.PORT}`);
      });
      console.log(`  Health API:  http://localhost:${CONFIG.PORT}/api/health`);
      console.log(`  Data Dir:    ${CONFIG.DATA_DIR}`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('[LabShare] Fatal startup failure:', err);
    process.exit(1);
  }
}

startServer();
