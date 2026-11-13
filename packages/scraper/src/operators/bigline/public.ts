/**
 * The allow-list: the only parts of Big Line's API answers this scraper keeps (docs/operators/bigline.md,
 * "Where each fact is in the API"). The API also sends tour leaders' names, staff sales notes, supplier
 * names and cost prices; none of those is read here. Each kept object is rebuilt key by key, and each kept
 * value is a plain string, number, boolean or null (an object or array where a plain value belongs becomes
 * null), so nothing else can ride along. fetch-page.ts applies this to every answer before anything else
 * sees it, and the committed fixtures are made with it.
 */

type JsonObject = Record<string, unknown>;
type Plain = string | number | boolean | null;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const objectAt = (value: unknown): JsonObject => (isObject(value) ? value : {});
const arrayAt = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
/** The value when it is a plain JSON value, else null. */
const plain = (value: unknown): Plain =>
  (typeof value === 'string' || typeof value === 'boolean' || value === null
    || (typeof value === 'number' && Number.isFinite(value)) ? value : null);

/** Notes in round brackets (either width, mixed, nested) or angle brackets 〈〉: removed. */
const NOTE = /[(（][^()（）]*[)）]|〈[^〈〉]*〉/g;
/** Between the places of one day's route line. A single hyphen stays (`泰北傳統少數民族-長頸族村`). */
const ROUTE_SEPARATOR = /[~～|｜→]|-{2,}/;
/** A sentence mark: what follows it in a chunk is prose, left out. */
const SENTENCE_MARK = /[，。；！？：;:!?]/;
/** Leading marks before a chunk's text (`.香港機場集合`, `-酒店`). */
const LEADING_MARKS = /^[\s.\-·•]+/;
/**
 * The longest chunk kept: a place or attraction name (`泰北傳統少數民族-長頸族村` is 13). A longer one is
 * a description (`「伊利健康谷」探訪全自動智慧奶業生產線`) and is left out whole, not cut.
 */
export const MAX_CHUNK_CHARS = 16;

/**
 * The places of one day's route line (`tripContent`), in order: its first line with text only (later lines
 * are notes such as `#註：…`), without bracketed notes, split at the route separators, each chunk cut at
 * its first sentence mark, spaces collapsed, and empty chunks and chunks over MAX_CHUNK_CHARS dropped. Reading the
 * chunks again, joined with ` | `, gives the same chunks, so a trimmed fixture parses as the answer did.
 */
export function routeChunks(tripContent: unknown): string[] {
  if (typeof tripContent !== 'string') return [];
  let line = tripContent.split(/\r?\n/).find(text => text.trim() !== '') ?? '';
  for (let previous = ''; previous !== line;) {
    previous = line;
    line = line.replace(NOTE, '');
  }
  return line.split(ROUTE_SEPARATOR)
    .map(chunk => {
      const lead = chunk.split(SENTENCE_MARK)[0].replace(LEADING_MARKS, '').replace(/\s+/g, ' ').trim();
      return [...lead].length <= MAX_CHUNK_CHARS ? lead : '';
    })
    .filter(chunk => chunk !== '');
}

export interface PublicDetail {
  code: Plain;
  data: {
    id: Plain;
    /** The "from" price the site shows (`memberFee` 起). */
    memberFee: Plain;
    /** `YYYY-MM` months with departures. */
    availableMonths: Plain[];
    basic: { tourNo: Plain; nameCn: Plain; tourDays: Plain };
    /** Each day's route line, reduced to its routeChunks joined with ` | `. */
    projectItinerary: { dailyTripList: { days: Plain; tripContent: string }[] };
    signUp: { settlementCurrencyCode: Plain; locationGroupList: { locationName: Plain }[] };
  } | null;
}

/** The public facts of a tour detail answer (`GET …/product/tour/frontend/detail?id=<id>`). */
export function publicDetail(response: unknown): PublicDetail {
  const answer = objectAt(response);
  const code = plain(answer.code);
  if (!isObject(answer.data)) return { code, data: null };
  const data = answer.data;
  const basic = objectAt(data.basic);
  const signUp = objectAt(data.signUp);
  return {
    code,
    data: {
      id: plain(data.id),
      memberFee: plain(data.memberFee),
      availableMonths: arrayAt(data.availableMonths).map(plain),
      basic: { tourNo: plain(basic.tourNo), nameCn: plain(basic.nameCn), tourDays: plain(basic.tourDays) },
      projectItinerary: {
        dailyTripList: arrayAt(objectAt(data.projectItinerary).dailyTripList).map(day => ({
          days: plain(objectAt(day).days),
          tripContent: routeChunks(objectAt(day).tripContent).join(' | '),
        })),
      },
      signUp: {
        settlementCurrencyCode: plain(signUp.settlementCurrencyCode),
        locationGroupList: arrayAt(signUp.locationGroupList).map(place => ({ locationName: plain(objectAt(place).locationName) })),
      },
    },
  };
}

/** One departure's public facts: its date and price, and the seat facts the full test reads. */
export interface PublicDeparture {
  productId: Plain; scheduleDate: Plain; memberFee: Plain;
  seatRemain: Plain; soldTotal: Plain; maxPersonTotal: Plain; registrationStatus: Plain; tourFlag: Plain; isCutofftour: Plain;
}

export interface PublicDates { code: Plain; data: { list: PublicDeparture[] } | null }

/** The public facts of one month's dates answer (`POST …/product/release/page`). */
export function publicDates(response: unknown): PublicDates {
  const answer = objectAt(response);
  const code = plain(answer.code);
  const list = objectAt(answer.data).list;
  if (!Array.isArray(list)) return { code, data: null };
  return {
    code,
    data: {
      list: list.map(item => {
        const row = objectAt(item);
        return {
          productId: plain(row.productId),
          scheduleDate: plain(row.scheduleDate),
          memberFee: plain(row.memberFee),
          seatRemain: plain(row.seatRemain),
          soldTotal: plain(row.soldTotal),
          maxPersonTotal: plain(row.maxPersonTotal),
          registrationStatus: plain(row.registrationStatus),
          tourFlag: plain(row.tourFlag),
          isCutofftour: plain(row.isCutofftour),
        };
      }),
    },
  };
}
