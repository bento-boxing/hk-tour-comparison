/**
 * `pnpm db:migrate`: applies every pending migration to the database at DATABASE_URL
 * and prints the ones applied. DATABASE_CA_CERT, when set, verifies the server (see createPgDb).
 * Exit code 0 on success, 2 when DATABASE_URL is missing or DATABASE_CA_CERT is not a certificate.
 */
import { pathToFileURL } from 'node:url';
import { createPgDb, normaliseCaCert, type Db } from './db';
import { migrate } from './migrate';

export interface MigrateCliDeps {
  /** `ca` is DATABASE_CA_CERT normalised, or undefined when it is not set. */
  makeDb: (databaseUrl: string, ca: string | undefined) => Db | Promise<Db>;
  print: (line: string) => void;
}

export async function runMigrateCli(
  env: Record<string, string | undefined>,
  deps: Partial<MigrateCliDeps> = {},
): Promise<number> {
  const print = deps.print ?? (line => console.log(line));
  const makeDb = deps.makeDb ?? ((url, ca) => createPgDb(url, { ca }));
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    print('DATABASE_URL is not set: it must name the database to migrate');
    return 2;
  }
  let ca: string | undefined;
  try {
    ca = normaliseCaCert(env.DATABASE_CA_CERT);
  } catch (err) {
    print((err as Error).message); // names the variable, never its value
    return 2;
  }

  const db = await makeDb(databaseUrl, ca);
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
