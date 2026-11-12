import { PGlite } from '@electric-sql/pglite';
import { transactionDb, type Db } from './db';
import { migrate } from './migrate';

/** A fresh in-memory PGlite database with every migration applied. For tests only. */
export async function createTestDb(): Promise<Db> {
  const pglite = await PGlite.create();
  const db: Db = {
    query: async <T>(sql: string, params?: unknown[]) => (await pglite.query<T>(sql, params)).rows,
    // PGlite runs BEGIN/COMMIT itself and rolls back and rethrows when the callback throws.
    transaction: fn => pglite.transaction(tx => fn(transactionDb({
      query: async (sql, params) => (await tx.query(sql, params)).rows,
      exec: async sql => { await tx.exec(sql); },
    }))),
    exec: async sql => { await pglite.exec(sql); },
    close: () => pglite.close(),
  };
  await migrate(db);
  return db;
}
