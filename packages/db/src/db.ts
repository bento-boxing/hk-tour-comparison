import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn inside BEGIN/COMMIT; rolls back and rethrows if fn throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Multi-statement SQL with no parameters (migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** The two operations every driver offers on an open transaction. */
export interface TransactionHandle {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  exec(sql: string): Promise<void>;
}

/**
 * Wraps an open transaction as a Db. A nested transaction() call joins the
 * outer transaction (no savepoint), and close() is refused: the owner of the
 * transaction ends it.
 */
export function transactionDb(handle: TransactionHandle): Db {
  const tx: Db = {
    query: async <T>(sql: string, params?: unknown[]) => (await handle.query(sql, params)) as T[],
    transaction: fn => fn(tx),
    exec: sql => handle.exec(sql),
    close: () => Promise.reject(new Error('close() is not allowed inside a transaction')),
  };
  return tx;
}

/** A Db backed by a pg connection pool (at most 3 connections). */
export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 3 });
  // An idle connection dropped by the server emits 'error' on the pool; without
  // a listener Node treats it as unhandled and exits. The pool replaces the connection.
  pool.on('error', err => { console.error('postgres pool: idle connection error:', err.message); });

  return {
    query: async <T>(sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows as T[],

    async transaction(fn) {
      const client = await pool.connect();
      let broken: Error | undefined;
      try {
        await client.query('begin');
        const result = await fn(transactionDb({
          query: async (sql, params) => (await client.query(sql, params)).rows,
          exec: async sql => { await client.query(sql); },
        }));
        await client.query('commit');
        return result;
      } catch (err) {
        try {
          await client.query('rollback');
        } catch (rollbackErr) {
          // The connection is unusable; destroy it instead of returning it to the pool.
          broken = rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr));
        }
        throw err;
      } finally {
        client.release(broken);
      }
    },

    // With no parameters pg uses the simple query protocol, which accepts several statements.
    exec: async sql => { await pool.query(sql); },

    close: () => pool.end(),
  };
}
