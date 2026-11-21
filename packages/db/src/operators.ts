import { OPERATOR_IDS, type IsoDate, type OperatorId } from '@hktours/core';
import type { Db } from './db';
import { isoUtc, type OperatorInfo } from './search';

/** One operator as its page and the operators index show it: what getOperators gives, its home address and its tours. */
export interface OperatorListing extends OperatorInfo {
  /** The operator's own home page (operators.site_url). */
  siteUrl: string;
  /** How many tours it lists now (active, with a departure after today: what its unfiltered search finds). */
  tours: number;
  /** The countries those tours go to, most tours first, then by id. A tour in two countries counts in each. */
  countries: { countryId: string; tours: number }[];
}

/*
 * One statement: every operator (left join, so one without tours is still there), with its listed tours counted
 * per operator and per operator and country (grouping sets; grouping(...) is 1 on the operator's own line, 0 on a
 * country's). "Listed" is the rule countToursByDestination and the search use. A tour without stops counts in its
 * operator's total only (its null country line is dropped). Only the operators the site lists: known to the code
 * (OPERATOR_IDS: each has a page) and with at least one good run (one never scraped exists nowhere on the site, as in
 * the filter bar), ordered as getOperators orders operators. One with a good run and no tours now is there, with 0.
 */
const LISTINGS_SQL = `
select o.id, o.name_zh, o.name_en, o.color, o.site_url, ${isoUtc('o.last_good_run_at')} as last_good_run_at,
       c.level, c.country_id, c.tours
from operators o
left join (
  select grouping(s.country_id) as level, t.operator_id, s.country_id, count(distinct t.id)::int as tours
  from tours t
  left join tour_stops s on s.tour_id = t.id
  where t.active
    and exists (select 1 from departures d where d.tour_id = t.id and d.date > $1::date)
  group by grouping sets ((t.operator_id), (t.operator_id, s.country_id))
) c on c.operator_id = o.id
where o.id = any($2::text[]) and o.last_good_run_at is not null
order by array_position($2::text[], o.id), o.id, c.level desc nulls first, c.tours desc, c.country_id collate "C"`;

interface Row {
  id: OperatorId; name_zh: string; name_en: string; color: string; site_url: string; last_good_run_at: string | null;
  level: number | null; country_id: string | null; tours: number | null;
}

/** Every operator the site lists (known, with a good run), with its home address and its tours now, in all and per country. */
export async function getOperatorListings(db: Db, today: IsoDate): Promise<OperatorListing[]> {
  const rows = await db.query<Row>(LISTINGS_SQL, [today, [...OPERATOR_IDS]]);
  const byId = new Map<OperatorId, OperatorListing>();
  for (const r of rows) {
    let listing = byId.get(r.id);
    if (!listing) {
      listing = {
        id: r.id, nameZh: r.name_zh, nameEn: r.name_en, color: r.color, lastGoodRunAt: r.last_good_run_at,
        siteUrl: r.site_url, tours: 0, countries: [],
      };
      byId.set(r.id, listing);
    }
    if (r.level === null || r.tours === null) continue; // no tours at all
    if (Number(r.level) === 1) listing.tours = r.tours;
    else if (r.country_id !== null) listing.countries.push({ countryId: r.country_id, tours: r.tours });
  }
  return [...byId.values()];
}
