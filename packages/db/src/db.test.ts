import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { it, expect } from 'vitest';
import pg from 'pg';
import * as index from './index';
import * as read from './read';
import {
  createPgDbWithPool, runPgTransaction, CONNECTION_TIMEOUT_MS, QUERY_TIMEOUT_MS,
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
  }]);
  expect(pools[0].listenerCount('error')).toBe(1); // an idle connection error must not kill the process
  await db.close();
});

it('sends no startup parameter beyond pg\'s defaults', () => {
  // pg writes these into the startup message. Transaction-mode poolers (Supabase's Supavisor and PgBouncer)
  // reject unknown startup parameters, failing every connection, or silently drop them. Server-side limits
  // belong on the database role instead (ALTER ROLE … SET statement_timeout).
  let config: pg.PoolConfig | undefined;
  createPgDbWithPool('postgres://unused', c => { config = c; return new pg.Pool(c); });
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

it('the pool factory seam stays internal to the package', () => {
  expect(index).not.toHaveProperty('createPgDbWithPool');
  expect(read).not.toHaveProperty('createPgDbWithPool');
  expect(read).toHaveProperty('createPgDb');
});
