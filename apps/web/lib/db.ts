import { connection } from 'next/server';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { createPgDb, normaliseCaCert, type Db } from '@hktours/db/read';
import { buildsWithoutDatabase } from './build-without-database';

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
 * The database handle for a page or route rendered per request. Awaits `connection()` first, which tells
 * Next.js to render the caller per request (never at build time or from a stored copy). The reads reuse their
 * results (cached-reads.ts): a result shown is at most an hour old.
 * Every page that queries the database gets its handle from here, except the stored pages (storedDb).
 */
export async function requestDb(): Promise<Db> {
  await connection();
  return getDb();
}

/**
 * The database handle for a stored page: one made at build time and stored, then made again at most once an hour
 * (its route file's `revalidate`), the stored copy being served meanwhile. No `connection()`, so Next.js may make
 * the page outside a request. Such a page must get its data from a loader that throws when the read fails
 * (app/_site/page-data.ts), so a page saying "cannot read" is never stored.
 *
 * With BUILD_WITHOUT_DATABASE=1 (CI and local builds only: lib/build-without-database.ts) it awaits `connection()`
 * first, as requestDb does: in that build the stored pages become per-request pages, so the build reads nothing and
 * stores nothing. Without it, a build with no reachable database fails on the first stored page, saying what is
 * missing.
 *
 * Set only while the site runs, on a build made with the database, that `connection()` refuses every refresh of a
 * stored page (Next.js logs only a generic error), so the copies stay as built: one log line here names the setting.
 */
export async function storedDb(): Promise<Db> {
  if (buildsWithoutDatabase()) {
    try {
      await connection();
    } catch (err) {
      if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
        console.error('BUILD_WITHOUT_DATABASE=1 is set while the site runs, but this page was built as a stored page: '
          + 'it cannot be made again (its stored copy stays as it is) until the setting is removed.');
      }
      throw err;
    }
  }
  return getDb();
}
