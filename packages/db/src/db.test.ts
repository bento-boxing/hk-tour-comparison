import { EventEmitter } from 'node:events';
import { it, expect } from 'vitest';
import { runPgTransaction, type PgClientLike, type PgPoolLike } from './db';

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
