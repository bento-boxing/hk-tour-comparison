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

/** The parts of a checked-out pg.PoolClient that runPgTransaction uses. Internal: a test seam. */
export interface PgClientLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  on(event: 'error', listener: (err: Error) => void): unknown;
  removeListener(event: 'error', listener: (err: Error) => void): unknown;
  release(err?: Error | boolean): void;
}

/** The part of a pg.Pool that runPgTransaction uses. Internal: a test seam. */
export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
}

/** Runs fn on one pooled client inside BEGIN/COMMIT; rolls back and rethrows if fn throws. Internal. */
export async function runPgTransaction<T>(pool: PgPoolLike, fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  // pg-pool removes its own 'error' listener while a client is checked out, and pg's
  // Client emits 'error' after a dropped connection. Unheard, that event kills the
  // process; heard, the query in flight still rejects and the client is destroyed.
  const onError = (err: Error) => { broken = err; };
  client.on('error', onError);
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
      broken ??= rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr));
    }
    throw err;
  } finally {
    client.removeListener('error', onError);
    client.release(broken);
  }
}

/** How long the pool waits for a new connection before rejecting (pg's default, 0, waits forever). */
export const CONNECTION_TIMEOUT_MS = 8_000;
/**
 * pg abandons any single query that has not answered after this long, and the query rejects. It is
 * enforced by the client (nothing is sent to the server, so it works behind any pooler, and it also covers
 * a connection that goes silent mid-query); the server keeps running an abandoned statement, and the
 * connection is discarded rather than reused. It is per query, so the nightly save (one long transaction
 * of many short statements) is unaffected; there is deliberately no whole-transaction limit. A query that
 * times out inside a transaction also costs the rollback's timeout before the transaction rejects.
 */
export const QUERY_TIMEOUT_MS = 20_000;

/**
 * A Db backed by a pg connection pool (at most 3 connections), with the timeouts above, so an
 * unreachable or stuck database makes a page fail fast instead of hanging.
 */
export function createPgDb(connectionString: string): Db {
  return createPgDbWithPool(connectionString, config => new pg.Pool(config));
}

/** createPgDb with the pool constructor injected. Internal: a test seam, not exported from the package entries. */
export function createPgDbWithPool(connectionString: string, makePool: (config: pg.PoolConfig) => pg.Pool): Db {
  const pool = makePool({
    connectionString, max: 3,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    // No startup parameters (statement_timeout, lock_timeout, options, …): transaction-mode poolers such as
    // Supabase's reject or drop them. A server-side limit belongs on the database role (ALTER ROLE … SET).
  });
  // An idle connection dropped by the server emits 'error' on the pool; without
  // a listener Node treats it as unhandled and exits. The pool replaces the connection.
  pool.on('error', err => { console.error('postgres pool: idle connection error:', err.message); });

  return {
    query: async <T>(sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows as T[],

    transaction: fn => runPgTransaction(pool, fn),

    // With no parameters pg uses the simple query protocol, which accepts several statements.
    exec: async sql => { await pool.query(sql); },

    close: () => pool.end(),
  };
}
