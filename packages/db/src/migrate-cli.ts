/**
 * `pnpm db:migrate`: applies every pending migration to the database at DATABASE_URL
 * and prints the ones applied. Exit code 0 on success, 2 when DATABASE_URL is missing.
 */
import { pathToFileURL } from 'node:url';
import { createPgDb, type Db } from './db';
import { migrate } from './migrate';

export interface MigrateCliDeps {
  makeDb: (databaseUrl: string) => Db | Promise<Db>;
  print: (line: string) => void;
}

export async function runMigrateCli(
  env: Record<string, string | undefined>,
  deps: Partial<MigrateCliDeps> = {},
): Promise<number> {
  const print = deps.print ?? (line => console.log(line));
  const makeDb = deps.makeDb ?? createPgDb;
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    print('DATABASE_URL is not set: it must name the database to migrate');
    return 2;
  }

  const db = await makeDb(databaseUrl);
  try {
    const applied = await migrate(db);
    if (applied.length === 0) {
      print('no migrations to apply');
    } else {
      print(`applied ${applied.length} ${applied.length === 1 ? 'migration' : 'migrations'}:`);
      for (const name of applied) print(`  ${name}`);
    }
    return 0;
  } finally {
    await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runMigrateCli(process.env);
}
