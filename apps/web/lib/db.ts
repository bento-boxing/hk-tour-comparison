import { connection } from 'next/server';
import { createPgDb, normaliseCaCert, type Db } from '@hktours/db/read';

// On globalThis, not in a module variable, so a development reload of this module reuses the pool
// instead of opening another one each time.
const cache = globalThis as { hktoursDb?: Db };

/**
 * The server's database handle, created on first call and shared for the life of the process.
 * Reads DATABASE_URL (and DATABASE_CA_CERT, which verifies the server when set) only when called,
 * so pages that never query the database build without them.
 */
export function getDb(): Db {
  if (cache.hktoursDb) return cache.hktoursDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set: the website needs it to read tours from the database.');
  cache.hktoursDb = createPgDb(url, { ca: normaliseCaCert(process.env.DATABASE_CA_CERT) });
  return cache.hktoursDb;
}

/**
 * The database handle for a page or route. Awaits `connection()` first, which tells Next.js to render
 * the caller per request (never at build time or from a static cache), so it always shows the latest scrape.
 * Every page that queries the database gets its handle from here.
 */
export async function requestDb(): Promise<Db> {
  await connection();
  return getDb();
}
