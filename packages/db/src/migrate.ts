import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Db } from './db';

// Resolved from this file, not the working directory, so callers in any directory find the migrations.
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

/**
 * One migration failed and was rolled back: which one, the ones this call applied before it (they stay applied),
 * and the database's error as the cause.
 */
export class MigrationError extends Error {
  override name = 'MigrationError';
  constructor(readonly migration: string, readonly applied: string[], cause: unknown) {
    super(`${migration} was rolled back`, { cause });
  }
}

/**
 * Applies every migrations/*.sql not yet recorded in schema_migrations, in
 * filename order, each in its own transaction. Returns the names applied by this call.
 * A migration that fails throws a MigrationError naming it.
 */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz)');
  const rows = await db.query<{ name: string }>('select name from schema_migrations');
  const done = new Set(rows.map(row => row.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter(name => name.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = await readFile(fileURLToPath(new URL(name, MIGRATIONS_DIR)), 'utf8');
    try {
      await db.transaction(async tx => {
        await tx.exec(sql);
        await tx.query('insert into schema_migrations (name, applied_at) values ($1, now())', [name]);
      });
    } catch (error) {
      throw new MigrationError(name, [...applied], error);
    }
    applied.push(name);
  }
  return applied;
}
