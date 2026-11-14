/**
 * The allow-list: the only parts of Yummy Holiday's API answers this scraper keeps (docs/operators/yummy.md,
 * "Where each fact comes from"). The API also sends booking counts (`cur_enroll_headcount`, `start_headcount`,
 * `early_prefer_used_headcount`), marketing prose (`sell_point`, `descp`), travel tips, and image and PDF paths;
 * none of those is read here. Each kept object is rebuilt key by key, and each kept value is a plain string,
 * number, boolean or null (an object or array where a plain value belongs becomes null), so nothing else can
 * ride along. discover.ts and fetch-page.ts apply this to every answer before anything else sees it, and the
 * committed fixtures are made with it.
 */

type JsonObject = Record<string, unknown>;
type Plain = string | number | boolean | null;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const objectAt = (value: unknown): JsonObject => (isObject(value) ? value : {});
/** The value when it is a plain JSON value, else null. */
const plain = (value: unknown): Plain =>
  (typeof value === 'string' || typeof value === 'boolean' || value === null
    || (typeof value === 'number' && Number.isFinite(value)) ? value : null);

/** A tour's public facts, as both the listing row and the detail give them. */
export interface PublicTour {
  id: Plain; code: Plain; name: Plain; is_website_name: Plain; website_name: Plain; daycount: Plain;
  /** The "from" price the site shows (`元起`). */
  price: Plain;
}

const publicTour = (row: JsonObject): PublicTour => ({
  id: plain(row.id), code: plain(row.code), name: plain(row.name), is_website_name: plain(row.is_website_name),
  website_name: plain(row.website_name), daycount: plain(row.daycount), price: plain(row.price),
});

export interface PublicDetail {
  code: Plain;
  /** `dist_list`: the tour's city list (`日本,東京,富士`), in the operator's order. */
  data: (PublicTour & { dist_list: Plain }) | null;
}

/** The public facts of a detail answer (`GET /bussiness/line/detail?id=<id>`). */
export function publicDetail(response: unknown): PublicDetail {
  const answer = objectAt(response);
  const code = plain(answer.code);
  if (!isObject(answer.data)) return { code, data: null };
  return { code, data: { ...publicTour(answer.data), dist_list: plain(answer.data.dist_list) } };
}

/** One group's public facts: one bus or flight of one departure date, with its booking status and price. */
export interface PublicGroup { id: Plain; start_date: Plain; return_date: Plain; group_enroll_status: Plain; price: Plain }

export interface PublicDates { code: Plain; data: { list: PublicGroup[] } | null }

/** The public facts of a dates answer (`GET /bussiness/group/list?line_id=<id>`). */
export function publicDates(response: unknown): PublicDates {
  const answer = objectAt(response);
  const code = plain(answer.code);
  const list = objectAt(answer.data).list;
  if (!Array.isArray(list)) return { code, data: null };
  return {
    code,
    data: {
      list: list.map(item => {
        const group = objectAt(item);
        return {
          id: plain(group.id), start_date: plain(group.start_date), return_date: plain(group.return_date),
          group_enroll_status: plain(group.group_enroll_status), price: plain(group.price),
        };
      }),
    },
  };
}

export interface PublicListing { code: Plain; data: { total: Plain; last_page: Plain; rows: PublicTour[] } | null }

/**
 * The public facts of the listing (`GET /bussiness/line/index?limit=500`): the two counts discovery checks (`total`,
 * `last_page`), and each row's tour facts.
 * The rows' departures (`group_list`) are not kept: the dates come from each tour's own dates answer.
 */
export function publicListing(response: unknown): PublicListing {
  const answer = objectAt(response);
  const code = plain(answer.code);
  const data = objectAt(answer.data);
  if (!Array.isArray(data.rows)) return { code, data: null };
  return {
    code,
    data: {
      total: plain(data.total), last_page: plain(data.last_page),
      rows: data.rows.map(row => publicTour(objectAt(row))),
    },
  };
}
