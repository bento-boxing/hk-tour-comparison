import type { IsoDate } from '@hktours/core';
import type { Db } from './db';
import type { DestinationCount, ListedCount } from './destinations';

/** A departure window, both days included: what the search's dateFrom and dateTo filter by. */
export interface DateWindow { from: IsoDate; to: IsoDate }

/** The tours leaving inside one window: in all (with their range), and per destination. */
export interface WindowCount extends ListedCount {
  /**
   * Each country and each region with a tour leaving inside the window, as countToursByDestination lists them (by
   * country id then region id, the country's own line first): what the window's search finds for that destination.
   * Given by the database; absent in counts made by hand.
   */
  destinations?: DestinationCount[];
}

/*
 * For each window, the listed tours (active) with a departure after today inside it, and their operators: exactly
 * what searchTours finds with that departure window and no other filter, so each count is the total that search
 * reports. The lowest price is the lowest of those departures' prices (a departure's own, or its tour's from-price
 * when it has none): the price the search's first row shows, cheapest first. The same per country and per region
 * (any stop in it, as the destination filter matches): the gold band's boxes count what pressing them would list.
 *
 * One statement for every window. `hits` is each window's departures inside it, joined to their active tours (the
 * windows come in as two date arrays, numbered by their place, with ordinality); grouping sets then give each window's
 * whole line, its countries' and its regions' (grouping(...): 3 for the whole line, 1 for a country, 0 for a region).
 * A window with no departure keeps its whole line (the left join) with no tours. A tour without stops counts in its
 * window's whole line only.
 */
const WINDOWS_SQL = `
with w as (
  select n::int as n, date_from, date_to
  from unnest($2::date[], $3::date[]) with ordinality as w(date_from, date_to, n)
),
hits as (
  select w.n, t.id, t.operator_id, t.days, min(coalesce(d.price_hkd, t.from_price_hkd)) as price
  from w
  left join (departures d join tours t on t.id = d.tour_id and t.active)
    on d.date >= greatest($1::date + 1, w.date_from) and d.date <= w.date_to
  group by w.n, t.id, t.operator_id, t.days
)
select h.n,
       grouping(s.country_id, s.region_id) as level,
       s.country_id, s.region_id,
       count(distinct h.id)::int as tours,
       count(distinct h.operator_id)::int as operators,
       min(h.days)::int as min_days,
       max(h.days)::int as max_days,
       min(h.price)::int as min_price
from hits h
left join tour_stops s on s.tour_id = h.id
group by grouping sets ((h.n), (h.n, s.country_id), (h.n, s.country_id, s.region_id))
order by h.n, s.country_id collate "C" nulls first, s.region_id collate "C" nulls first`;

interface WindowRow {
  n: number; level: number; country_id: string | null; region_id: string | null; tours: number; operators: number;
  min_days: number | null; max_days: number | null; min_price: number | null;
}

/** A row's counts, with its range when it has tours. */
function listedCount(r: WindowRow): ListedCount {
  const count: ListedCount = { tours: r.tours, operators: r.operators };
  if (r.tours > 0 && r.min_days !== null && r.max_days !== null && r.min_price !== null) {
    count.range = { minDays: r.min_days, maxDays: r.max_days, minPriceHkd: r.min_price };
  }
  return count;
}

/**
 * How many tours are listed with a departure inside each window, from how many operators, and their range (lengths,
 * lowest price; absent for a window with no tours), in all and per destination, in the windows' order. No windows:
 * no query.
 */
export async function countToursInWindows(db: Db, today: IsoDate, windows: DateWindow[]): Promise<WindowCount[]> {
  if (windows.length === 0) return [];
  const rows = await db.query<WindowRow>(WINDOWS_SQL, [today, windows.map(w => w.from), windows.map(w => w.to)]);
  return windows.map((_, i) => {
    const mine = rows.filter(r => Number(r.n) === i + 1);
    const whole = mine.find(r => Number(r.level) === 3);
    if (!whole || whole.tours === 0) return { tours: 0, operators: 0, destinations: [] };
    const destinations: DestinationCount[] = mine
      .filter(r => r.country_id !== null && r.tours > 0 && (Number(r.level) === 1 || r.region_id !== null))
      .map(r => ({ countryId: r.country_id!, regionId: Number(r.level) === 1 ? null : r.region_id, ...listedCount(r) }));
    return { ...listedCount(whole), destinations };
  });
}
