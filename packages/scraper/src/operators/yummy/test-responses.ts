/**
 * Raw Yummy Holiday API answers for tests: the public facts, surrounded by the kinds of fields the real API
 * sends that must never be kept (docs/operators/yummy.md, "Fields not to take"): booking counts, marketing
 * prose, tips, image and PDF paths. Every such string is one of SECRETS, and every booking count is SECRET_COUNT.
 */

/** Strings that stand for what must never be kept: operator prose, image and PDF paths. */
export const SECRETS = [
  'SELL-POINT-行程特色甲', 'DESCP-說明乙', 'TIPS-貼士丙', '/uploads/SECRET-IMAGE.jpg', '/uploads/SECRET-ITINERARY.pdf',
  'REMARK-備註丁',
];
/** A booking count no kept field ever holds (prices are 3-4 digits, ids 4-6). */
export const SECRET_COUNT = 9876543;

/** The listing (`/bussiness/line/index?limit=500`) as the API sends it, holding `rows`. */
export function rawListing(rows: Record<string, unknown>[], patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { code: 1, msg: '返回成功', time: '1794613923', data: { rows, total: rows.length, last_page: 1, page: 1, ...patch } };
}

/** One listing row as the API sends it. */
export function rawListingRow(id: number, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, code: `AA-J-T${id}`, name: `東京${id}五天團`, is_website_name: 0, website_name: '', daycount: 5, price: 5399,
    adult_price: 5399, child_price: 4599, baby_price: 1499, vehicle_name: '飛機',
    cover_image: SECRETS[3], sell_point: SECRETS[0], hotel_name_list: SECRETS[5],
    group_list: [{ id: 1, line_id: id, code: `AA-J-T${id}-261210`, start_date: '2026-12-10', return_date: '2026-12-14', group_enroll_status: 0, enroll_end_time_text: '' }],
    ...patch,
  };
}

/** A detail answer (`/bussiness/line/detail?id=<id>`) as the API sends it. */
export function rawDetail(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 1, msg: '返回成功', time: '1794614248',
    data: {
      id: 5906, code: 'AA-J-TD05', name: '【關東巡遊】東京・富士・鎌倉古都(紅葉)溫泉五天團', is_website_name: 0, website_name: '',
      daycount: 5, price: 5399, adult_price: 5399, child_price: 4599, baby_price: 1499, dist_list: '日本,東京,富士',
      type: 3, vehicle_type: 5, total_enroll_headcount: SECRET_COUNT, is_prefer: 0, prefer_adult: null,
      descp: SECRETS[1], sell_point: SECRETS[0], tips: SECRETS[2], int_information_remark: SECRETS[5],
      cover_image: SECRETS[3], descp_images: SECRETS[3], promot_page_images: SECRETS[3], promot_file_images: SECRETS[4],
      set_date: [], expire_date: '0000-00-00',
      ...patch,
    },
  };
}

/** A dates answer (`/bussiness/group/list?line_id=<id>`) as the API sends it, holding `groups`. */
export function rawDates(groups: Record<string, unknown>[]): Record<string, unknown> {
  return { code: 1, msg: '返回成功', time: '1794614167', data: { list: groups, month_list: [{ year: 2026, month: 12 }] } };
}

/** One group (one departure of one bus or flight) as the dates answer sends it: taking bookings unless patched. */
export function rawGroup(startDate: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 197538, line_id: 5906, code: `AA-J-TD05-${startDate.slice(2).replaceAll('-', '')}`, name: SECRETS[0],
    start_date: startDate, return_date: startDate, price: 5699, adult_price: 5699, child_price: 4899, baby_price: 1499,
    group_enroll_status: 0, team_status: '', group_status: 0, enroll_status: 0, is_website_show: 0,
    cur_enroll_headcount: SECRET_COUNT, start_headcount: SECRET_COUNT, early_prefer_used_headcount: SECRET_COUNT,
    early_prefer_headcount: SECRET_COUNT, is_prefer: 1, prefer_adult: 200, early_prefer_amount: '200.00',
    promot_files: SECRETS[4], promot_pages: SECRETS[3], enroll_end_time_text: '',
    ...patch,
  };
}
