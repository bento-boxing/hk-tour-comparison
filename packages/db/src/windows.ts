import type { IsoDate } from '@hktours/core';
import type { Db } from './db';
import type { ListedCount } from './destinations';

/** A departure window, both days included: what the search's dateFrom and dateTo filter by. */
export interface DateWindow { from: IsoDate; to: IsoDate }

/*
 * For each window, the listed tours (active) with a departure after today inside it, and their operators: exactly
 * what searchTours finds with that departure window and no other filter, so each count is the total that search
 * reports. The lowest price is the lowest of those departures' prices (a departure's own, or its tour's from-price
 * when it has none): the price the search's first row shows, cheapest first. One statement for every window: the
 * windows come in as two date arrays, numbered by their place (with ordinality), and a window with no departure keeps
 * its line (the left join) with no tours.
 */
const WINDOWS_SQL = `
with w as (
  select n::int as n, date_from, date_to
  from unnest($2::date[], $3::date[]) with ordinality as w(date_from, date_to, n)
)
select w.n,
       count(distinct t.id)::int as tours,
       count(distinct t.operator_id)::int as operators,
       min(t.days)::int as min_days,
       max(t.days)::int as max_days,
       min(coalesce(d.price_hkd, t.from_price_hkd))::int as min_price
from w
left join (departures d join tours t on t.id = d.tour_id and t.active)
  on d.date >= greatest($1::date + 1, w.date_from) and d.date <= w.date_to
group by w.n
order by w.n`;

/**
 * How many tours are listed with a departure inside each window, from how many operators, and their range (lengths,
 * lowest price; absent for a window with no tours), in the windows' order. No windows: no query.
 */
export async function countToursInWindows(db: Db, today: IsoDate, windows: DateWindow[]): Promise<ListedCount[]> {
  if (windows.length === 0) return [];
  const rows = await db.query<{
    n: number; tours: number; operators: number; min_days: number | null; max_days: number | null; min_price: number | null;
  }>(WINDOWS_SQL, [today, windows.map(w => w.from), windows.map(w => w.to)]);
  const byPlace = new Map(rows.map(r => [Number(r.n), r]));
  return windows.map((_, i) => {
    const r = byPlace.get(i + 1);
    if (!r || r.tours === 0) return { tours: 0, operators: 0 };
    const count: ListedCount = { tours: r.tours, operators: r.operators };
    if (r.min_days !== null && r.max_days !== null && r.min_price !== null) {
      count.range = { minDays: r.min_days, maxDays: r.max_days, minPriceHkd: r.min_price };
    }
    return count;
  });
}
