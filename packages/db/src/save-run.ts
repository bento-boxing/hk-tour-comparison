import { addDays, SNAPSHOT_KEEP_NIGHTS, type IsoDate, type NormalisedTour, type OperatorId } from '@hktours/core';
import type { Db } from './db';

export interface RunStats { startedAt: Date; finishedAt: Date; pagesFetched: number; parseFailures: number }
export interface UnmatchedName { name: string; tourCode: string }

export interface GoodRun {
  operatorId: OperatorId; runDate: IsoDate;
  tours: NormalisedTour[]; unmatched: UnmatchedName[]; stats: RunStats;
}

export interface FailedRun { operatorId: OperatorId; runDate: IsoDate; stats: RunStats; reasons: string[] }

/**
 * Owner decision 2026-11-13: a tour inactive for more than this many days (counted in run dates from the
 * night it went inactive, tours.deactivated_on) is deleted with its stops, departures and price snapshots.
 */
export const WITHDRAWN_TOUR_KEEP_DAYS = 30;
/**
 * Owner decision 2026-11-13: scrape_runs rows more than this many days old (by run_date) are deleted, except
 * the operator's most recent ok run, whatever its age: the run checks compare against it.
 */
export const RUN_LOG_KEEP_DAYS = 90;

/** The id of operator $1's most recent ok run (no row if none). previousGoodTourCount and pruneRunLog share it. */
const LATEST_GOOD_RUN = `select id from scrape_runs
     where operator_id = $1 and ok
     order by run_date desc, finished_at desc, id desc
     limit 1`;

/**
 * Writes one operator's good run in a single transaction: every tour with its
 * stops, departures and tonight's price snapshot; tours missing tonight marked
 * inactive; tours inactive for more than WITHDRAWN_TOUR_KEEP_DAYS deleted;
 * snapshots older than the rolling window pruned; unmatched place names
 * counted; the run recorded, run-log rows older than RUN_LOG_KEEP_DAYS pruned,
 * and the operator's freshness updated. Only this operator's rows are touched.
 * Tours are saved under `run.operatorId`.
 */
export async function saveOperatorRun(db: Db, run: GoodRun): Promise<void> {
  const { operatorId, runDate } = run;
  await db.transaction(async tx => {
    for (const tour of run.tours) await saveTour(tx, operatorId, runDate, tour);

    // Only tours active until now: one already inactive keeps the night it went inactive.
    await tx.query(
      `update tours set active = false, deactivated_on = $3::date
       where operator_id = $1 and active and not (code = any($2::text[]))`,
      [operatorId, run.tours.map(t => t.code), runDate],
    );

    // Inactive for more than WITHDRAWN_TOUR_KEEP_DAYS; stops, departures and snapshots go with it (on delete cascade).
    await tx.query(
      `delete from tours where operator_id = $1 and not active and deactivated_on < $2::date`,
      [operatorId, addDays(runDate, -WITHDRAWN_TOUR_KEEP_DAYS)],
    );

    // Keeps runDate - (SNAPSHOT_KEEP_NIGHTS - 1) … runDate.
    await tx.query(
      `delete from price_snapshots s using tours t
       where s.tour_id = t.id and t.operator_id = $1 and s.date < $2::date`,
      [operatorId, addDays(runDate, -(SNAPSHOT_KEEP_NIGHTS - 1))],
    );

    for (const { name, tourCode } of run.unmatched) {
      await tx.query(
        `insert into unmatched_places (operator_id, name, example_tour_code, seen_count, last_seen)
         values ($1, $2, $3, 1, $4)
         on conflict (operator_id, name) do update
           set seen_count = unmatched_places.seen_count + 1,
               example_tour_code = excluded.example_tour_code,
               last_seen = excluded.last_seen`,
        [operatorId, name, tourCode, runDate],
      );
    }

    await insertScrapeRun(tx, operatorId, runDate, run.stats, { ok: true, toursSaved: run.tours.length, reasons: [] });
    await pruneRunLog(tx, operatorId, runDate);
    await tx.query('update operators set last_good_run_at = $2 where id = $1', [operatorId, run.stats.finishedAt]);
  });
}

/** Records a run that will not be saved. Inserts its scrape_runs row and changes or deletes nothing else. */
export async function recordFailedRun(db: Db, run: FailedRun): Promise<void> {
  await insertScrapeRun(db, run.operatorId, run.runDate, run.stats, { ok: false, toursSaved: 0, reasons: run.reasons });
}

/** tours_saved of the most recent ok run for this operator, or null if there is none. */
export async function previousGoodTourCount(db: Db, operatorId: OperatorId): Promise<number | null> {
  const [row] = await db.query<{ tours_saved: number }>(
    `select tours_saved from scrape_runs where id = (${LATEST_GOOD_RUN})`,
    [operatorId],
  );
  return row ? row.tours_saved : null;
}

/**
 * Deletes this operator's scrape_runs rows with a run_date more than RUN_LOG_KEEP_DAYS before `runDate`,
 * except its most recent ok run, whatever its age. Called only from a good save; exported for its tests.
 */
export async function pruneRunLog(tx: Db, operatorId: OperatorId, runDate: IsoDate): Promise<void> {
  await tx.query(
    `delete from scrape_runs
     where operator_id = $1 and run_date < $2::date
       and id is distinct from (${LATEST_GOOD_RUN})`,
    [operatorId, addDays(runDate, -RUN_LOG_KEEP_DAYS)],
  );
}

/** Upserts one tour, replaces its stops and departures, and upserts tonight's snapshot. */
async function saveTour(tx: Db, operatorId: OperatorId, runDate: IsoDate, tour: NormalisedTour): Promise<void> {
  // The id stays a string parameter for the queries below; its JS type never matters.
  const [{ id }] = await tx.query<{ id: string }>(
    `insert into tours (operator_id, code, url, title, days, nights, from_price_hkd,
                        start_kind, start_label, end_kind, end_label, active, first_seen, last_seen)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $12)
     on conflict (operator_id, code) do update
       set url = excluded.url, title = excluded.title, days = excluded.days, nights = excluded.nights,
           from_price_hkd = excluded.from_price_hkd,
           start_kind = excluded.start_kind, start_label = excluded.start_label,
           end_kind = excluded.end_kind, end_label = excluded.end_label,
           active = true, deactivated_on = null, last_seen = excluded.last_seen
     returning id::text`,
    [operatorId, tour.code, tour.url, tour.title, tour.days, tour.nights, tour.fromPriceHkd,
      tour.start.kind, tour.start.label, tour.end.kind, tour.end.label, runDate],
  );

  await tx.query('delete from tour_stops where tour_id = $1', [id]);
  await tx.query(
    `insert into tour_stops (tour_id, position, country_id, region_id, city_id)
     select $1, s.ord - 1, s.country_id, s.region_id, s.city_id
     from unnest($2::text[], $3::text[], $4::text[]) with ordinality as s(country_id, region_id, city_id, ord)`,
    [id, tour.stops.map(s => s.countryId), tour.stops.map(s => s.regionId), tour.stops.map(s => s.cityId)],
  );

  await tx.query('delete from departures where tour_id = $1', [id]);
  await tx.query(
    `insert into departures (tour_id, date, price_hkd)
     select $1, d.date, d.price_hkd
     from unnest($2::date[], $3::int[]) as d(date, price_hkd)`,
    [id, tour.departures.map(d => d.date), tour.departures.map(d => d.priceHkd)],
  );

  await tx.query(
    `insert into price_snapshots (tour_id, date, price_hkd) values ($1, $2, $3)
     on conflict (tour_id, date) do update set price_hkd = excluded.price_hkd`,
    [id, runDate, tour.fromPriceHkd],
  );
}

async function insertScrapeRun(
  db: Db, operatorId: OperatorId, runDate: IsoDate, stats: RunStats,
  outcome: { ok: boolean; toursSaved: number; reasons: string[] },
): Promise<void> {
  await db.query(
    `insert into scrape_runs (operator_id, run_date, started_at, finished_at,
                              pages_fetched, tours_saved, parse_failures, ok, reasons)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[])`,
    [operatorId, runDate, stats.startedAt, stats.finishedAt,
      stats.pagesFetched, outcome.toursSaved, stats.parseFailures, outcome.ok, outcome.reasons],
  );
}
