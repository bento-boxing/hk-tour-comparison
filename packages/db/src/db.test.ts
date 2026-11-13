import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { rootCertificates } from 'node:tls';
import { describe, it, expect, vi } from 'vitest';
import pg from 'pg';
import * as index from './index';
import * as read from './read';
import {
  createPgDb, createPgDbWithPool, normaliseCaCert, runPgTransaction, CONNECTION_TIMEOUT_MS, QUERY_TIMEOUT_MS,
  type PgClientLike, type PgPoolLike,
} from './db';

/**
 * A stand-in for a checked-out pg.PoolClient. Like pg's Client, a connection
 * error first rejects the queries in flight and then emits 'error'.
 */
class FakeClient extends EventEmitter implements PgClientLike {
  readonly statements: string[] = [];
  readonly releases: Array<Error | boolean | undefined> = [];
  private queryable = true;
  private pending: Array<(err: Error) => void> = [];

  query(sql: string): Promise<{ rows: unknown[] }> {
    this.statements.push(sql);
    if (!this.queryable) return Promise.reject(new Error('Client has encountered a connection error and is not queryable'));
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return Promise.resolve({ rows: [] });
    // Any other statement stays in flight until the test drops the connection.
    return new Promise((_, reject) => { this.pending.push(reject); });
  }

  dropConnection(err: Error): void {
    this.queryable = false;
    for (const reject of this.pending.splice(0)) reject(err);
    this.emit('error', err);
  }

  release(err?: Error | boolean): void { this.releases.push(err); }
}

function poolOf(client: FakeClient): PgPoolLike {
  return { connect: async () => client };
}

it('a connection dropped mid-transaction rejects the call instead of crashing the process', async () => {
  const client = new FakeClient();
  const running = runPgTransaction(poolOf(client), async tx => {
    await tx.query("update operators set color = '#000000' where id = 'egl'");
  });
  await expect.poll(() => client.statements.length).toBe(2); // begin + the update in flight

  // With no 'error' listener on the client, emit() throws: in production that is an uncaught exception.
  expect(() => client.dropConnection(new Error('Connection terminated unexpectedly'))).not.toThrow();

  await expect(running).rejects.toThrow('Connection terminated unexpectedly');
  expect(client.releases).toHaveLength(1);
  expect(client.releases[0]).toBeTruthy();   // destroyed, not returned to the pool
  expect(client.listenerCount('error')).toBe(0);
});

it('a committed transaction returns the client to the pool and leaves no listener behind', async () => {
  const client = new FakeClient();
  const result = await runPgTransaction(poolOf(client), async () => 'done');
  expect(result).toBe('done');
  expect(client.statements).toEqual(['begin', 'commit']);
  expect(client.releases).toEqual([undefined]);
  expect(client.listenerCount('error')).toBe(0);
});

it('the pool gives up connecting after 8 s and abandons any query after 20 s, on the client', async () => {
  expect(CONNECTION_TIMEOUT_MS).toBe(8000);
  expect(QUERY_TIMEOUT_MS).toBe(20000);
  const configs: pg.PoolConfig[] = [];
  const pools: pg.Pool[] = [];
  // A real pool, which connects lazily: nothing is contacted here.
  const db = createPgDbWithPool('postgres://user:pass@127.0.0.1:1/none', config => {
    configs.push(config);
    const pool = new pg.Pool(config);
    pools.push(pool);
    return pool;
  });
  expect(configs).toEqual([{
    connectionString: 'postgres://user:pass@127.0.0.1:1/none',
    max: 3,
    connectionTimeoutMillis: 8000,
    query_timeout: 20000,
    ssl: false, // a local host: no TLS
  }]);
  expect(pools[0].listenerCount('error')).toBe(1); // an idle connection error must not kill the process
  await db.close();
});

it('sends no startup parameter beyond pg\'s defaults', () => {
  // pg writes these into the startup message. Transaction-mode poolers (Supabase's Supavisor and PgBouncer)
  // reject unknown startup parameters, failing every connection, or silently drop them. Server-side limits
  // belong on the database role instead (ALTER ROLE … SET statement_timeout).
  let config: pg.PoolConfig | undefined;
  createPgDbWithPool('postgres://unused', c => { config = c; return new pg.Pool(c); }, { warn: () => {} });
  for (const key of ['statement_timeout', 'options', 'idle_in_transaction_session_timeout', 'lock_timeout']) {
    expect(config).not.toHaveProperty(key);
  }
});

/**
 * Just enough of a Postgres server: it completes the startup handshake (no password), answers a simple
 * `begin`, and never answers anything else, like a database whose statement hangs or a link that went silent.
 */
async function silentAfterStartup(): Promise<{ url: string; queries: string[]; close: () => Promise<void> }> {
  const queries: string[] = [];
  const sockets: Socket[] = [];
  const message = (type: string, body: Buffer) => {
    const head = Buffer.alloc(5);
    head.write(type, 0, 'latin1');
    head.writeInt32BE(body.length + 4, 1);
    return Buffer.concat([head, body]);
  };
  const authOk = message('R', Buffer.from([0, 0, 0, 0]));
  const ready = (status: string) => message('Z', Buffer.from(status, 'latin1'));
  const server = createServer(socket => {
    sockets.push(socket);
    let buffer = Buffer.alloc(0);
    let started = false;
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (!started) {
          if (buffer.length < 4) return;
          const length = buffer.readInt32BE(0);
          if (buffer.length < length) return;
          buffer = buffer.subarray(length);
          started = true;
          socket.write(Buffer.concat([authOk, ready('I')]));
          continue;
        }
        if (buffer.length < 5) return;
        const type = String.fromCharCode(buffer[0]);
        const length = buffer.readInt32BE(1);
        if (buffer.length < length + 1) return;
        const body = buffer.subarray(5, length + 1);
        buffer = buffer.subarray(length + 1);
        if (type === 'X') { socket.end(); return; } // Terminate
        if (type !== 'Q') continue;
        const sql = body.toString('utf8').replace(/\0$/, '');
        queries.push(sql);
        if (sql === 'begin') socket.write(Buffer.concat([message('C', Buffer.from('BEGIN\0')), ready('T')]));
        // Anything else: silence.
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `postgres://user:pass@127.0.0.1:${port}/none`,
    queries,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

it('a query that never returns rejects after the query timeout, and its connection leaves the pool', async () => {
  const server = await silentAfterStartup();
  let pool: pg.Pool | undefined;
  // The real settings, with the query timeout shortened so the test is quick.
  const db = createPgDbWithPool(server.url, config => (pool = new pg.Pool({ ...config, query_timeout: 100 })));
  try {
    await expect(db.query('select 1')).rejects.toThrow('Query read timeout');
    expect(server.queries).toEqual(['select 1']);
    // pg-pool releases a client with the error, which removes and closes it rather than reusing it.
    await expect.poll(() => pool!.totalCount).toBe(0);
  } finally {
    await db.close();
    await server.close();
  }
});

it('a statement that times out inside a transaction rejects it and destroys the connection', async () => {
  const server = await silentAfterStartup();
  const client = new pg.Client({ connectionString: server.url, query_timeout: 100 });
  await client.connect();
  const releases: Array<Error | boolean | undefined> = [];
  // A one-connection pool around a real pg client, so pg's own timeout runs inside runPgTransaction.
  const handle = Object.assign(client, {
    release: (err?: Error | boolean) => { releases.push(err); void client.end().catch(() => {}); },
  }) as unknown as PgClientLike;
  try {
    const running = runPgTransaction({ connect: async () => handle }, async tx => {
      await tx.exec("update operators set color = '#000000' where id = 'egl'");
    });
    await expect(running).rejects.toThrow('Query read timeout');
    // The rollback queues behind the abandoned statement and times out too, so the connection is broken.
    expect(server.queries).toEqual(['begin', "update operators set color = '#000000' where id = 'egl'"]);
    expect(releases).toHaveLength(1);
    expect(releases[0]).toBeInstanceOf(Error); // destroyed, not returned to the pool
    expect(client.listenerCount('error')).toBe(0);
  } finally {
    await server.close();
  }
});

it('a database host that accepts but never answers rejects within the connection timeout instead of hanging', async () => {
  // Accepts TCP connections and stays silent, as a stuck or packet-dropping host would look to pg.
  const sockets: Socket[] = [];
  const silent = createServer(socket => { sockets.push(socket); });
  await new Promise<void>(resolve => silent.listen(0, '127.0.0.1', resolve));
  const { port } = silent.address() as AddressInfo;
  // The real settings, with the connection timeout shortened so the test is quick.
  const db = createPgDbWithPool(`postgres://user:pass@127.0.0.1:${port}/none`, config => new pg.Pool({ ...config, connectionTimeoutMillis: 100 }));
  try {
    await expect(db.query('select 1')).rejects.toThrow('Connection terminated due to connection timeout');
  } finally {
    await db.close();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => silent.close(resolve));
  }
});

it('the pool factory seam stays internal to the package; the CA helper is public', () => {
  expect(index).not.toHaveProperty('createPgDbWithPool');
  expect(read).not.toHaveProperty('createPgDbWithPool');
  expect(read).toHaveProperty('createPgDb');
  expect(index).toHaveProperty('normaliseCaCert');
  expect(read).toHaveProperty('normaliseCaCert');
});

describe('TLS', () => {
  // Made-up credentials. Each is distinctive, so a test can tell whether any of them leaked into a message.
  const USER = 'postgres.qwertyprojref';
  const PASSWORD = 'Zx9-unguessable';
  const HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';
  const PORT = '6543';
  const DATABASE = 'tourdatabase';
  const REMOTE = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DATABASE}`;
  /** createPgDb does not parse the CA, so a placeholder stands in for PEM text (and no certificate is printed on failure). */
  const CA = 'placeholder CA PEM text';
  const BASE = { max: 3, connectionTimeoutMillis: 8000, query_timeout: 20000 };

  /** The pool options createPgDb builds, and the warnings it gives. Nothing connects: pg's pool is lazy. */
  function optionsFor(connectionString: string, opts: { ca?: string } = {}) {
    const warnings: string[] = [];
    let config: pg.PoolConfig | undefined;
    createPgDbWithPool(connectionString, c => { config = c; return new pg.Pool(c); }, { ...opts, warn: m => warnings.push(m) });
    return { config: config!, warnings };
  }

  /** What pg itself will use, after it has merged the connection string into the options. Nothing connects. */
  function effective(config: pg.PoolConfig) {
    const params = (new pg.Client(config) as unknown as {
      connectionParameters: { user: string; password: string; host: string; port: number; database: string; ssl: unknown; application_name?: string };
    }).connectionParameters;
    return params;
  }

  it('a remote host with a CA verifies the server against it', () => {
    const { config, warnings } = optionsFor(REMOTE, { ca: CA });
    expect(config).toEqual({ ...BASE, connectionString: REMOTE, ssl: { ca: CA, rejectUnauthorized: true } });
    expect(effective(config).ssl).toEqual({ ca: CA, rejectUnauthorized: true });
    expect(warnings).toEqual([]);
  });

  it('a remote host without a CA is encrypted but not verified, and says so once', async () => {
    const { config, warnings } = optionsFor(REMOTE);
    expect(config).toEqual({ ...BASE, connectionString: REMOTE, ssl: { rejectUnauthorized: false } });
    expect(effective(config).ssl).toEqual({ rejectUnauthorized: false });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('encrypted');
    expect(warnings[0]).toContain('not verified');
    expect(warnings[0]).toContain('DATABASE_CA_CERT');
    expect(warnings[0]).not.toContain('\n');
  });

  it('an empty CA counts as none', () => {
    expect(optionsFor(REMOTE, { ca: '' }).config.ssl).toEqual({ rejectUnauthorized: false });
    expect(optionsFor(REMOTE, { ca: '  \n' }).config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('the warning comes once per pool, not per query, and names no part of the connection string', async () => {
    const warnings: string[] = [];
    const fakePool = { on: () => undefined, query: async () => ({ rows: [] }), end: async () => {} };
    const db = createPgDbWithPool(`${REMOTE}?application_name=hktours`, () => fakePool as unknown as pg.Pool, { warn: m => warnings.push(m) });
    await db.query('select 1');
    await db.query('select 2');
    await db.exec('select 3');
    expect(warnings).toHaveLength(1);
    for (const part of [USER, PASSWORD, HOST, PORT, DATABASE, 'supabase', 'hktours', 'postgresql://']) {
      expect(warnings[0].includes(part), `the warning contains a part of the connection string (${part.length} characters)`).toBe(false);
    }
    await db.close();
  });

  it('createPgDb warns on the console by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const db = createPgDb(REMOTE);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('DATABASE_CA_CERT');
      await db.close();
      const local = createPgDb('postgres://user:pass@localhost:5432/dev', { ca: CA });
      expect(warn).toHaveBeenCalledTimes(1);
      await local.close();
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    'postgres://user:pass@localhost:5432/dev',
    'postgres://user:pass@LOCALHOST/dev',
    'postgres://user:pass@127.0.0.1:5432/dev',
    'postgres://user:pass@[::1]:5432/dev',
    '/var/run/postgresql dev',
    'socket:/var/run/postgresql?db=dev',
    'postgres://user:pass@/dev?host=/var/run/postgresql',
    'postgres://user:pass@%2Fvar%2Frun%2Fpostgresql/dev',
  ])('local host %s: no TLS, no warning, even with a CA', connectionString => {
    for (const ca of [undefined, CA]) {
      const { config, warnings } = optionsFor(connectionString, { ca });
      expect(config.ssl).toBe(false);
      expect(effective(config).ssl).toBe(false);
      expect(warnings).toEqual([]);
    }
  });

  it.each([
    ['a look-alike of localhost', 'postgres://user:pass@localhost.example.com/db'],
    ['another loopback address (only the three named ones count as local)', 'postgres://user:pass@127.0.0.2/db'],
    ['a host query parameter, which pg prefers over the address part', `postgres://user:pass@localhost/db?host=${HOST}`],
    ['no host at all (pg would fall back to PGHOST)', 'postgres:///db'],
  ])('%s gets TLS', (_, connectionString) => {
    const { config, warnings } = optionsFor(connectionString);
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(warnings).toHaveLength(1);
  });

  it.each([
    ['sslmode=disable'], ['ssl=0'], ['ssl=false'], ['sslmode=no-verify'], ['sslmode=prefer'], ['sslmode=require'],
    ['sslmode=verify-full'], ['ssl=true'], ['ssl=no-verify'], ['SSLMODE=disable'], ['sslnegotiation=direct'],
    ['sslrootcert=/nonexistent/root.crt'], ['sslcert=/nonexistent/client.crt&sslkey=/nonexistent/client.key'],
    ['ssl%6Dode=disable'], // URLSearchParams decodes the name, as pg-connection-string's parser does
    ['sslmode=disable&uselibpqcompat=true', '?uselibpqcompat=true'],
  ])('the connection string cannot change TLS on a remote host: %s', (parameter, rest = '') => {
    const connectionString = `${REMOTE}?${parameter}`;
    // pg lets the string's TLS parameters override the ssl option (connection-parameters.js), so they are removed.
    const withoutCa = optionsFor(connectionString);
    expect(withoutCa.config.connectionString).toBe(`${REMOTE}${rest}`);
    expect(withoutCa.config.ssl).toEqual({ rejectUnauthorized: false });
    expect(effective(withoutCa.config).ssl).toEqual({ rejectUnauthorized: false });

    const withCa = optionsFor(connectionString, { ca: CA });
    expect(withCa.config.connectionString).toBe(`${REMOTE}${rest}`);
    expect(effective(withCa.config).ssl).toEqual({ ca: CA, rejectUnauthorized: true });
  });

  it('a Unix socket string is passed on as it is: pg reads no parameters from it', () => {
    const { config } = optionsFor('/var/run/postgresql dev?sslmode=require');
    expect(config.connectionString).toBe('/var/run/postgresql dev?sslmode=require');
    expect(effective(config).ssl).toBe(false);
  });

  it('a local host cannot be switched to TLS by the string either', () => {
    const { config } = optionsFor('postgres://user:pass@localhost/dev?sslmode=require');
    expect(config.connectionString).toBe('postgres://user:pass@localhost/dev');
    expect(effective(config).ssl).toBe(false);
  });

  it.each([
    ['an encoded @, : and %', 'p%40ss%3Aw%25rd', 'p@ss:w%rd'],
    ['a raw @ and :', 'p@ss:wd', 'p@ss:wd'],
    ['encoded / ? # &', 'a%2Fb%3Fc%23d%26e', 'a/b?c#d&e'],
  ])('removing the TLS parameters keeps everything else exactly: a password with %s', (_, encoded, decoded) => {
    const base = `postgresql://${USER}:${encoded}@${HOST}:${PORT}/${DATABASE}`;
    const { config } = optionsFor(`${base}?sslmode=disable&application_name=hk%20tours&ssl=0&target_session_attrs=any&sslrootcert=/x`);
    expect(config.connectionString).toBe(`${base}?application_name=hk%20tours&target_session_attrs=any`);
    const params = effective(config);
    expect(params.user).toBe(USER);
    expect(params.password === decoded, 'the password pg reads differs from the one in the string').toBe(true);
    expect(params.host).toBe(HOST);
    expect(params.port).toBe(6543);
    expect(params.database).toBe(DATABASE);
    expect(params.application_name).toBe('hk tours');
  });

  it('a string with no TLS parameter is passed on unchanged, query included', () => {
    for (const s of [REMOTE, `${REMOTE}?application_name=x`, `${REMOTE}?application_name=x&&connect_timeout=5`]) {
      expect(optionsFor(s).config.connectionString).toBe(s);
    }
  });

  it.each([
    ['a port that is not a number', `postgresql://${USER}:${PASSWORD}@${HOST}:port/${DATABASE}`],
    ['another scheme', `mysql://${USER}:${PASSWORD}@${HOST}/${DATABASE}`],
    ['no scheme', `${USER}:${PASSWORD}@${HOST}/${DATABASE}`],
    ['keyword/value form, which pg does not read', `host=${HOST} user=${USER} password=${PASSWORD}`],
    ['an empty string', ''],
  ])('a malformed connection string (%s) is refused with a clear error that does not echo it', (_, connectionString) => {
    let pools = 0;
    let error: unknown;
    try {
      createPgDbWithPool(connectionString, c => { pools++; return new pg.Pool(c); }, { warn: () => {} });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('connection string');
    for (const part of [USER, PASSWORD, HOST, DATABASE]) {
      expect(message.includes(part), `the error contains a part of the connection string (${part.length} characters)`).toBe(false);
    }
    expect((error as Error).cause).toBeUndefined();
    expect(pools).toBe(0);
  });
});

describe('normaliseCaCert', () => {
  // Real certificates, public ones: Node's bundled root CAs.
  const [PEM, OTHER] = rootCertificates;
  const same = (actual: string | undefined, expected: string) => actual === expected;

  it('nothing, an empty string or only whitespace is "not supplied"', () => {
    expect(normaliseCaCert(undefined)).toBeUndefined();
    expect(normaliseCaCert('')).toBeUndefined();
    expect(normaliseCaCert('  \n\t')).toBeUndefined();
  });

  it('PEM text with real newlines is kept, ending in one newline', () => {
    const expected = `${PEM.trim()}\n`;
    expect(same(normaliseCaCert(PEM), expected), 'normalised PEM differs').toBe(true);
    expect(same(normaliseCaCert(`\n  ${PEM}\n\n`), expected), 'surrounding whitespace was not removed').toBe(true);
    expect(same(normaliseCaCert(PEM.replace(/\n/g, '\r\n')), expected), 'CRLF line ends were not normalised').toBe(true);
  });

  it('literal \\n sequences, as a dashboard may store them, become newlines', () => {
    const expected = `${PEM.trim()}\n`;
    expect(same(normaliseCaCert(PEM.trim().replace(/\n/g, '\\n')), expected), 'literal \\n not converted').toBe(true);
    expect(same(normaliseCaCert(PEM.trim().replace(/\n/g, '\\r\\n')), expected), 'literal \\r\\n not converted').toBe(true);
  });

  it('a bundle of several certificates is kept whole', () => {
    const bundle = `${PEM.trim()}\n${OTHER.trim()}\n`;
    expect(same(normaliseCaCert(bundle.replace(/\n/g, '\\n')), bundle), 'bundle changed').toBe(true);
  });

  it.each([
    ['text that is not a certificate', 'not a certificate at all'],
    ['a header with a broken body', '-----BEGIN CERTIFICATE-----\nAAAA-not-base64\n-----END CERTIFICATE-----'],
    ['a truncated certificate', () => rootCertificates[0].slice(0, 200)],
    ['a private key', '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'],
  ])('%s is refused with a clear error that does not echo it', (_, input) => {
    const text = typeof input === 'function' ? input() : input;
    let error: unknown;
    try { normaliseCaCert(text); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('DATABASE_CA_CERT');
    expect(message.includes(text.trim().slice(0, 40)), 'the error echoes the input').toBe(false);
    expect(message.includes('AAAA'), 'the error echoes the input').toBe(false);
  });
});
