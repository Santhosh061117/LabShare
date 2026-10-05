import { DatabaseSync } from 'node:sqlite';
import { CONFIG } from '../config/index.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(CONFIG.DB_PATH);
    // Performance optimizations for SQLite in local / Termux environments
    dbInstance.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
    `);
    console.log(`[Database] SQLite connected at ${CONFIG.DB_PATH} with WAL mode`);
  }
  return dbInstance;
}

export interface Statement<T = any> {
  all(...params: any[]): T[];
  get(...params: any[]): T | undefined;
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export const db = {
  exec(sql: string): void {
    getDatabase().exec(sql);
  },
  prepare<T = any>(sql: string): Statement<T> {
    const stmt = getDatabase().prepare(sql);
    return {
      all(...params: any[]): T[] {
        return stmt.all(...params) as T[];
      },
      get(...params: any[]): T | undefined {
        return stmt.get(...params) as T | undefined;
      },
      run(...params: any[]) {
        return stmt.run(...params);
      }
    };
  },
  close(): void {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (err) {
        console.error('[Database] Error closing SQLite database:', err);
      }
      dbInstance = null;
    }
  }
};
