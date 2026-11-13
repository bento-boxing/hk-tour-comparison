import {
  OPERATOR_IDS, comparePrice,
  type Destination, type IsoDate, type OperatorId, type PriceChange,
  type ScrapedDeparture, type StartKind, type Stop, type TourPoint,
} from '@hktours/core';
import type { Db } from './db';

export interface TourFilters {
  destination?: Destination;          // matches if ANY stop is in it
  excludeCountryIds?: string[];       // drops tours with ANY stop in these countries
  dateFrom?: IsoDate; dateTo?: IsoDate; // departure window, inclusive
  daysMin?: number; daysMax?: number;
  priceMin?: number; priceMax?: number; // applied to windowPriceHkd
  operators?: OperatorId[];
}
export type SortKey = 'price' | 'days' | 'date' | 'destination';
export const PAGE_SIZE = 24;

export interface TourCardData {
  key: string;                        // 'egl:HTBKOK06'
  operatorId: OperatorId; url: string; title: string;
  days: number; nights: number | null;
  stops: Stop[]; start: TourPoint; end: TourPoint;
  fromPriceHkd: number;               // lowest across all upcoming departures
  windowPriceHkd: number;             // lowest across the departures listed below
  departures: ScrapedDeparture[];     // upcoming and inside the window, ascending
  priceChange: PriceChange | null;    // compares fromPriceHkd with the snapshots
  lastUpdated: string;                // operator's last_good_run_at, ISO timestamp
}

export interface SearchInput { filters: TourFilters; sort: SortKey; page: number; today: IsoDate }

export interface OperatorInfo { id: OperatorId; nameZh: string; nameEn: string; color: string; lastGoodRunAt: string | null }

/*
 * Every query below shares one parameter list ($1 … $12); a null parameter
 * switches its condition off. Values only ever travel as parameters.
 *
 *   $1 today        $2 dateFrom     $3 dateTo
 *   $4 countryId    $5 regionId     $6 excludeCountryIds (text[])
 *   $7 daysMin      $8 daysMax      $9 priceMin    $10 priceMax
 *   $11 operators (text[])          $12 tour keys (text[])
 */
type Params = [
  today: IsoDate, dateFrom: IsoDate | null, dateTo: IsoDate | null,
  countryId: string | null, regionId: string | null, excludeCountryIds: string[] | null,
  daysMin: number | null, daysMax: number | null, priceMin: number | null, priceMax: number | null,
  operators: string[] | null, keys: string[] | null,
];

/** A departure inside the window; the lower bound is never earlier than today. */
const IN_WINDOW = `d.date >= greatest($1::date, $2::date) and ($3::date is null or d.date <= $3::date)`;
/** A departure's own price, or the tour's from-price when it has none. */
const EFFECTIVE_PRICE = `coalesce(d.price_hkd, t.from_price_hkd)`;
/** UTC ISO-8601 with milliseconds, the same text Date#toISOString gives, on every driver. */
const isoUtc = (col: string) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Active tours with at least one departure in the window that pass every filter, as CTE `matched`. */
const MATCHED_CTE = `
with eligible as (
  select t.id,
         t.operator_id || ':' || t.code as key,
         t.days,
         min(${EFFECTIVE_PRICE}) as from_price,
         min(${EFFECTIVE_PRICE}) filter (where ${IN_WINDOW}) as window_price,
         min(d.date) filter (where ${IN_WINDOW}) as first_date
  from tours t
  join departures d on d.tour_id = t.id and d.date >= $1::date
  where t.active
    and ($4::text is null or exists (
          select 1 from tour_stops s
          where s.tour_id = t.id
            and (s.region_id = $5::text or ($5::text is null and s.country_id = $4::text))))
    and ($6::text[] is null or not exists (
          select 1 from tour_stops s where s.tour_id = t.id and s.country_id = any($6::text[])))
    and ($7::int is null or t.days >= $7::int)
    and ($8::int is null or t.days <= $8::int)
    and ($11::text[] is null or t.operator_id = any($11::text[]))
    and ($12::text[] is null or t.operator_id || ':' || t.code = any($12::text[]))
  group by t.id
  having count(*) filter (where ${IN_WINDOW}) > 0
),
matched as (
  select * from eligible
  where ($9::int is null or window_price >= $9::int)
    and ($10::int is null or window_price <= $10::int)
)`;

/** A closed table: the sort order is never built from caller text. `key` is always the final tie-break. */
const ORDER_BY: Record<SortKey, string> = {
  price: `m.window_price, m.key collate "C"`,
  days: `m.days, m.window_price, m.key collate "C"`,
  date: `m.first_date, m.window_price, m.key collate "C"`,
  destination: `fs.country_id collate "C", fs.region_id collate "C", m.window_price, m.key collate "C"`,
};

interface TourRow {
  id: string; key: string; operator_id: OperatorId; url: string; title: string;
  days: number; nights: number | null;
  start_kind: StartKind; start_label: string | null; end_kind: StartKind; end_label: string | null;
  from_price: number; window_price: number; last_updated: string;
}

/** One page of `matched`, in sort order. `limit` null means every row. */
function selectPage(sort: SortKey): string {
  const orderBy = Object.hasOwn(ORDER_BY, sort) ? ORDER_BY[sort] : ORDER_BY.price;
  return `${MATCHED_CTE}
select m.id::text as id, m.key, t.operator_id, t.url, t.title, t.days, t.nights,
       t.start_kind, t.start_label, t.end_kind, t.end_label,
       m.from_price, m.window_price, ${isoUtc('o.last_good_run_at')} as last_updated
from matched m
join tours t on t.id = m.id
join operators o on o.id = t.operator_id
left join lateral (
  select s.country_id, s.region_id from tour_stops s where s.tour_id = m.id order by s.position limit 1
) fs on true
order by ${orderBy}
limit $13::int offset $14::int`;
}

function noFilters(today: IsoDate): Params {
  return [today, null, null, null, null, null, null, null, null, null, null, null];
}

const nonEmpty = <T>(xs: T[] | undefined): T[] | null => (xs && xs.length > 0 ? xs : null);

function searchParams(filters: TourFilters, today: IsoDate): Params {
  return [
    today, filters.dateFrom ?? null, filters.dateTo ?? null,
    filters.destination?.countryId ?? null, filters.destination?.regionId ?? null,
    nonEmpty(filters.excludeCountryIds),
    filters.daysMin ?? null, filters.daysMax ?? null, filters.priceMin ?? null, filters.priceMax ?? null,
    nonEmpty(filters.operators), null,
  ];
}

/** Filtered, sorted, paged search. `total` counts every match before paging. */
export async function searchTours(db: Db, input: SearchInput): Promise<{ tours: TourCardData[]; total: number }> {
  const params = searchParams(input.filters, input.today);
  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page)) : 1;

  const [{ total }] = await db.query<{ total: number }>(`${MATCHED_CTE} select count(*)::int as total from matched`, params);
  if (total === 0) return { tours: [], total };

  const rows = await db.query<TourRow>(selectPage(input.sort), [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  return { tours: await toCards(db, rows, params), total };
}

/** Active tours only; `departures` holds every upcoming departure. Unknown or inactive keys are absent from the map. */
export async function getToursByKeys(db: Db, keys: string[], today: IsoDate): Promise<Map<string, TourCardData>> {
  const wanted = [...new Set(keys)];
  const result = new Map<string, TourCardData>();
  if (wanted.length === 0) return result;

  const params = noFilters(today);
  params[11] = wanted;
  const rows = await db.query<TourRow>(selectPage('price'), [...params, null, 0]);
  const byKey = new Map((await toCards(db, rows, params)).map(card => [card.key, card]));
  for (const key of wanted) {
    const card = byKey.get(key);
    if (card) result.set(key, card);
  }
  return result;
}

/** Loads the stops, listed departures and snapshots of these tours in three queries and builds the cards. */
async function toCards(db: Db, rows: TourRow[], params: Params): Promise<TourCardData[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);

  const stops = await db.query<{ id: string; country_id: string; region_id: string; city_id: string | null }>(
    `select tour_id::text as id, country_id, region_id, city_id
     from tour_stops where tour_id = any($1::bigint[])
     order by tour_id, position`,
    [ids],
  );
  const departures = await db.query<{ id: string; date: IsoDate; price_hkd: number | null }>(
    `select d.tour_id::text as id, d.date::text as date, d.price_hkd
     from departures d
     where d.tour_id = any($4::bigint[]) and ${IN_WINDOW}
     order by d.tour_id, d.date`,
    [params[0], params[1], params[2], ids],
  );
  const snapshots = await db.query<{ id: string; date: IsoDate; price_hkd: number }>(
    `select tour_id::text as id, date::text as date, price_hkd
     from price_snapshots where tour_id = any($1::bigint[])`,
    [ids],
  );

  const stopsById = groupBy(stops, s => ({ countryId: s.country_id, regionId: s.region_id, cityId: s.city_id }));
  const departuresById = groupBy(departures, d => ({ date: d.date, priceHkd: d.price_hkd }));
  const snapshotsById = groupBy(snapshots, s => ({ date: s.date, priceHkd: s.price_hkd }));
  const today = params[0];

  return rows.map(r => ({
    key: r.key,
    operatorId: r.operator_id, url: r.url, title: r.title,
    days: r.days, nights: r.nights,
    stops: stopsById.get(r.id) ?? [],
    start: { kind: r.start_kind, label: r.start_label },
    end: { kind: r.end_kind, label: r.end_label },
    fromPriceHkd: r.from_price,
    windowPriceHkd: r.window_price,
    departures: departuresById.get(r.id) ?? [],
    priceChange: comparePrice(r.from_price, snapshotsById.get(r.id) ?? [], today),
    lastUpdated: r.last_updated,
  }));
}

function groupBy<R extends { id: string }, T>(rows: R[], map: (row: R) => T): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.id);
    if (group) group.push(map(row));
    else groups.set(row.id, [map(row)]);
  }
  return groups;
}

/** All operators in the canonical order, with their freshness as an ISO UTC timestamp (null before any good run). */
export async function getOperators(db: Db): Promise<OperatorInfo[]> {
  const rows = await db.query<{ id: OperatorId; name_zh: string; name_en: string; color: string; last_good_run_at: string | null }>(
    `select id, name_zh, name_en, color, ${isoUtc('last_good_run_at')} as last_good_run_at
     from operators
     order by array_position($1::text[], id), id`,
    [[...OPERATOR_IDS]],
  );
  return rows.map(r => ({ id: r.id, nameZh: r.name_zh, nameEn: r.name_en, color: r.color, lastGoodRunAt: r.last_good_run_at }));
}
