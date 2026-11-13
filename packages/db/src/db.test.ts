import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { it, expect } from 'vitest';
import pg from 'pg';
import * as index from './index';
import * as read from './read';
import {
  createPgDbWithPool, runPgTransaction, CONNECTION_TIMEOUT_MS, STATEMENT_TIMEOUT_MS,
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

it('the pool gives up connecting after 8 s and limits each statement to 20 s', async () => {
  expect(CONNECTION_TIMEOUT_MS).toBe(8000);
  expect(STATEMENT_TIMEOUT_MS).toBe(20000);
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
    // Per statement, sent to the server for every connection: it covers the website's queries and each
    // statement of the nightly save's transaction alike. There is deliberately no whole-transaction limit.
    statement_timeout: 20000,
  }]);
  expect(pools[0].listenerCount('error')).toBe(1); // an idle connection error must not kill the process
  await db.close();
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
