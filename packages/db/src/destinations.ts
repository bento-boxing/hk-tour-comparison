import type { IsoDate } from '@hktours/core';
import type { Db } from './db';

/** How many tours are listed, and from how many operators. */
export interface ListedCount { tours: number; operators: number }

/** The tours listed for one destination: a whole country (regionId null) or one of its regions. */
export interface DestinationCount extends ListedCount { countryId: string; regionId: string | null }

export interface DestinationCounts {
  /** Every listed tour, whether or not it has a stop. */
  all: ListedCount;
  /**
   * Each country with a listed tour, and each region with one, ordered by country id then region id (the
   * country's own line, regionId null, first). A tour with stops in two regions counts once in each, and once
   * in its country.
   */
  destinations: DestinationCount[];
}

/*
 * A tour is listed when it is active and has a departure after today: exactly what searchTours finds with no
 * filters, so a destination's count here is the total its own page shows before any filter. One statement:
 * grouping sets give the whole list, each country and each region at once. grouping(...) tells the sets apart:
 * 3 for the whole list, 1 for a country, 0 for a region. A tour without stops has a null country and region,
 * so it counts in the whole list only (its null "country" line is dropped).
 */
const COUNTS_SQL = `
select grouping(s.country_id, s.region_id) as level,
       s.country_id, s.region_id,
       count(distinct t.id)::int as tours,
       count(distinct t.operator_id)::int as operators
from tours t
left join tour_stops s on s.tour_id = t.id
where t.active
  and exists (select 1 from departures d where d.tour_id = t.id and d.date > $1::date)
group by grouping sets ((), (s.country_id), (s.country_id, s.region_id))
order by s.country_id collate "C" nulls first, s.region_id collate "C" nulls first`;

/** How many tours, from how many operators, are listed now: in all, per country and per region. */
export async function countToursByDestination(db: Db, today: IsoDate): Promise<DestinationCounts> {
  const rows = await db.query<{ level: number; country_id: string | null; region_id: string | null; tours: number; operators: number }>(
    COUNTS_SQL, [today],
  );
  let all: ListedCount = { tours: 0, operators: 0 };
  const destinations: DestinationCount[] = [];
  for (const r of rows) {
    const level = Number(r.level);
    if (level === 3) all = { tours: r.tours, operators: r.operators };
    else if (r.country_id !== null && (level === 1 || r.region_id !== null)) {
      destinations.push({ countryId: r.country_id, regionId: level === 1 ? null : r.region_id, tours: r.tours, operators: r.operators });
    }
  }
  return { all, destinations };
}
