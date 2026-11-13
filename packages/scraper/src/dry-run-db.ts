import type { OperatorId } from '@hktours/core';
import type { Db } from '@hktours/db';

/**
 * A throwaway in-memory database with every migration applied, for `--dry-run`.
 * Imported only when called, so a real run never loads PGlite.
 */
export async function createDryRunDb(): Promise<Db> {
  const { createTestDb } = await import('@hktours/db/test');
  return createTestDb();
}

export interface RunSummary {
  ok: boolean; reasons: string[]; pagesFetched: number; parseFailures: number; toursSaved: number;
}

/** What the operator's latest run recorded in this database, or null if it has none. */
export async function latestRunSummary(db: Db, operatorId: OperatorId): Promise<RunSummary | null> {
  const [row] = await db.query<{
    ok: boolean; reasons: string[]; pages_fetched: number; parse_failures: number; tours_saved: number;
  }>(
    `select ok, reasons, pages_fetched, parse_failures, tours_saved from scrape_runs
     where operator_id = $1 order by id desc limit 1`,
    [operatorId],
  );
  if (row === undefined) return null;
  return {
    ok: row.ok, reasons: row.reasons,
    pagesFetched: row.pages_fetched, parseFailures: row.parse_failures, toursSaved: row.tours_saved,
  };
}
