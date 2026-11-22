import type { IsoDate } from '@hktours/core';
import type { Db } from './db';

/** How many tours are listed, and from how many operators. */
export interface ListedCount {
  tours: number;
  operators: number;
  /**
   * The listed tours' shortest and longest length and their lowest price (each tour's lowest over its upcoming
   * departures, a departure without its own price at the tour's from-price: what its row shows with no filter).
   * Given by the database for every line with a tour; absent where none is listed, and in counts made by hand.
   */
  range?: TourRange;
}

/** The lengths and the lowest price of a set of listed tours. */
export interface TourRange { minDays: number; maxDays: number; minPriceHkd: number }

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
 * filters, so a destination's count here is the total its own page shows before any filter. One statement: `listed`
 * is each listed tour once, with its lowest price over its upcoming departures (a departure's own price, or the tour's
 * from-price when it has none: the search's), and grouping sets give the whole list, each country and each region at
 * once. grouping(...) tells the sets apart: 3 for the whole list, 1 for a country, 0 for a region. A tour without
 * stops has a null country and region, so it counts in the whole list only (its null "country" line is dropped).
 */
const COUNTS_SQL = `
with listed as (
  select t.id, t.operator_id, t.days, min(coalesce(d.price_hkd, t.from_price_hkd)) as price
  from tours t
  join departures d on d.tour_id = t.id and d.date > $1::date
  where t.active
  group by t.id
)
select grouping(s.country_id, s.region_id) as level,
       s.country_id, s.region_id,
       count(distinct l.id)::int as tours,
       count(distinct l.operator_id)::int as operators,
       min(l.days)::int as min_days,
       max(l.days)::int as max_days,
       min(l.price)::int as min_price
from listed l
left join tour_stops s on s.tour_id = l.id
group by grouping sets ((), (s.country_id), (s.country_id, s.region_id))
order by s.country_id collate "C" nulls first, s.region_id collate "C" nulls first`;

interface CountRow {
  level: number; country_id: string | null; region_id: string | null; tours: number; operators: number;
  min_days: number | null; max_days: number | null; min_price: number | null;
}

/** A row's counts, with its range when it has tours (the three are null together, for no tours). */
function listedCount(r: CountRow): ListedCount {
  const count: ListedCount = { tours: r.tours, operators: r.operators };
  if (r.tours > 0 && r.min_days !== null && r.max_days !== null && r.min_price !== null) {
    count.range = { minDays: r.min_days, maxDays: r.max_days, minPriceHkd: r.min_price };
  }
  return count;
}

/** How many tours, from how many operators, are listed now: in all, per country and per region. */
export async function countToursByDestination(db: Db, today: IsoDate): Promise<DestinationCounts> {
  const rows = await db.query<CountRow>(COUNTS_SQL, [today]);
  let all: ListedCount = { tours: 0, operators: 0 };
  const destinations: DestinationCount[] = [];
  for (const r of rows) {
    const level = Number(r.level);
    if (level === 3) all = listedCount(r);
    else if (r.country_id !== null && (level === 1 || r.region_id !== null)) {
      destinations.push({ countryId: r.country_id, regionId: level === 1 ? null : r.region_id, ...listedCount(r) });
    }
  }
  return { all, destinations };
}
