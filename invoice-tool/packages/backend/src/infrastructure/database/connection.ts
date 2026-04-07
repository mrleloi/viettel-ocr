import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/**
 * Database connection types.
 */
export type AppDatabase = BetterSQLite3Database<typeof schema>;

/**
 * Create a SQLite database connection with WAL mode enabled.
 * @param dbPath - Path to the SQLite database file
 * @returns Drizzle ORM database instance
 */
export function createDatabase(dbPath: string): AppDatabase {
  const sqlite = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  sqlite.pragma('journal_mode = WAL');

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

/**
 * Create an in-memory SQLite database for testing.
 * @returns Drizzle ORM database instance
 */
export function createTestDatabase(): AppDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

/** Token for DI injection */
export const DATABASE_TOKEN = 'DATABASE_CONNECTION';
