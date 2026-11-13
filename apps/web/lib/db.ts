import { createPgDb, type Db } from '@hktours/db';

let db: Db | undefined;

/**
 * The server's database handle, created on first call and shared for the life of the process.
 * Reads DATABASE_URL only when called, so pages that never query the database build without it.
 */
export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set: the website needs it to read tours from the database.');
  db = createPgDb(url);
  return db;
}
