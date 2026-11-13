import { X509Certificate } from 'node:crypto';
import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';

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

export interface PgDbOptions {
  /**
   * PEM text of the certificate authority that signed the database server's certificate (callers read it
   * from DATABASE_CA_CERT through normaliseCaCert). With it, a remote server's identity is verified;
   * absent or empty, the connection is encrypted but not verified.
   */
  ca?: string;
  /** Receives the one-line "not verified" warning, once per pool. Default: console.warn. */
  warn?: (message: string) => void;
}

/** Hosts that get no TLS. A Unix socket path (a host starting with /) gets none either. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Connection-string parameters that set TLS. pg merges the parsed string over the options it is given
 * (pg/lib/connection-parameters.js: `Object.assign({}, config, parse(config.connectionString))`), so any of
 * these would replace the ssl option below: `sslmode=disable` or `ssl=0` would turn TLS off. They are removed
 * from the string instead. `sslnegotiation=direct` is among them because the parser turns it into `ssl: true`.
 */
const TLS_PARAMETERS = new Set(['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation']);

const MALFORMED = 'The database connection string is not a valid Postgres URL (expected '
  + 'postgresql://user:password@host:port/database). It is not shown here because it contains the password.';

const UNVERIFIED_TLS_WARNING = 'postgres: the database connection is encrypted but the server\'s identity '
  + 'is not verified; set DATABASE_CA_CERT to the database\'s CA certificate (PEM text) to verify it.';

/** The string without its TLS parameters; every other character (credentials, host, other parameters) is kept. */
function withoutTlsParameters(connectionString: string): string {
  const start = connectionString.indexOf('?');
  if (start === -1) return connectionString;
  const hash = connectionString.indexOf('#', start);
  const end = hash === -1 ? connectionString.length : hash;
  const kept = connectionString.slice(start + 1, end).split('&').filter(part => {
    // The name as the parser will read it: URLSearchParams decodes %-escapes and '+'.
    const [name] = new URLSearchParams(part).keys();
    return name === undefined || !TLS_PARAMETERS.has(name.toLowerCase());
  });
  const query = kept.length > 0 ? `?${kept.join('&')}` : '';
  return connectionString.slice(0, start) + query + connectionString.slice(end);
}

type TlsOption = false | { ca: string; rejectUnauthorized: true } | { rejectUnauthorized: false };

/**
 * The connection string to hand to pg and the TLS setting to use with it. The host is read with the parser
 * pg itself uses (pg-connection-string, the same installed copy), so it is the host pg will connect to:
 * a `host=` parameter, for example, wins over the address part, as it does in pg.
 * Throws an error that does not contain the string when the string cannot be read.
 */
function tlsFor(connectionString: string, ca: string | undefined): { connectionString: string; ssl: TlsOption } {
  // The forms pg reads: a URL, or a Unix socket path followed by a database name.
  if (!/^(postgres|postgresql|socket):/i.test(connectionString) && !connectionString.startsWith('/')) {
    throw new Error(MALFORMED);
  }
  // pg reads `/socket/dir dbname` without any query part, so there is nothing to remove from it.
  const stripped = connectionString.startsWith('/') ? connectionString : withoutTlsParameters(connectionString);
  let parsed: ReturnType<typeof parseConnectionString>;
  try {
    parsed = parseConnectionString(stripped);
  } catch {
    throw new Error(MALFORMED); // no `cause`: the parser's error may carry the input
  }
  // Nothing left in the string may set TLS, or pg would let it override the setting below.
  if (parsed.ssl !== undefined) {
    throw new Error('The database connection string still sets TLS after its TLS parameters were removed; '
      + `remove ${[...TLS_PARAMETERS].join(', ')} from it.`);
  }
  // An empty host means pg falls back to PGHOST, which may be remote, so it gets TLS too.
  const host = (parsed.host ?? '').toLowerCase();
  const local = LOCAL_HOSTS.has(host) || host.startsWith('/');
  const ssl: TlsOption = local ? false
    : ca !== undefined && ca.trim() !== '' ? { ca, rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  return { connectionString: stripped, ssl };
}

/**
 * The CA certificate from an environment variable, ready for PgDbOptions.ca: undefined when the value is
 * missing or blank (an unset GitHub secret is an empty string). Literal `\n` (and `\r\n`) sequences, as a
 * secret pasted into a dashboard may hold them, become newlines. Every certificate in the text must parse;
 * the result is those certificates alone, one after another. Throws an error that does not echo the value.
 */
export function normaliseCaCert(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const text = value.replace(/\\r\\n|\\n/g, '\n').replace(/\r\n/g, '\n');
  const blocks = text.match(/-----BEGIN CERTIFICATE-----\n[\s\S]*?\n-----END CERTIFICATE-----/g) ?? [];
  const valid = blocks.length > 0 && blocks.every(block => {
    try { new X509Certificate(block); return true; } catch { return false; }
  });
  if (!valid) {
    throw new Error('DATABASE_CA_CERT is not a PEM certificate: it must be the certificate text, from '
      + '-----BEGIN CERTIFICATE----- to -----END CERTIFICATE-----, with its line breaks (or \\n in their place).');
  }
  return `${blocks.join('\n')}\n`;
}

/**
 * A Db backed by a pg connection pool (at most 3 connections), with the timeouts above, so an
 * unreachable or stuck database makes a page fail fast instead of hanging.
 *
 * TLS: none for localhost, 127.0.0.1, ::1 or a Unix socket; always for any other host, verified against
 * `opts.ca` when given, otherwise encrypted but not verified (with one warning). TLS parameters in the
 * connection string (sslmode, ssl, …) are removed and cannot change this.
 */
export function createPgDb(connectionString: string, opts: PgDbOptions = {}): Db {
  return createPgDbWithPool(connectionString, config => new pg.Pool(config), opts);
}

/** createPgDb with the pool constructor injected. Internal: a test seam, not exported from the package entries. */
export function createPgDbWithPool(
  connectionString: string, makePool: (config: pg.PoolConfig) => pg.Pool, opts: PgDbOptions = {},
): Db {
  const tls = tlsFor(connectionString, opts.ca);
  const pool = makePool({
    connectionString: tls.connectionString, max: 3,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    ssl: tls.ssl,
    // No startup parameters (statement_timeout, lock_timeout, options, …): transaction-mode poolers such as
    // Supabase's reject or drop them. A server-side limit belongs on the database role (ALTER ROLE … SET).
  });
  if (tls.ssl !== false && tls.ssl.rejectUnauthorized === false) (opts.warn ?? console.warn)(UNVERIFIED_TLS_WARNING);
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
