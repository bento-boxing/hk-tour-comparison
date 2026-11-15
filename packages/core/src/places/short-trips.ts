/**
 * "Too far for the trip" (owner requests 2026-11-14 for routes read from fallback text, 2026-11-15 for routes read
 * from day lines too): on a tour of at most SHORT_TRIP_MAX_DAYS days, a stop outside these regions is out of reach
 * (see withinReachOfTrip in stops.ts, used by extractDayLineStops and extractFallbackStops). On fallback text every
 * stop out of reach is dropped, even all of them. On day lines the stops out of reach are dropped only when they are
 * strictly fewer distinct places than those within reach, not counting the places the stated start or end names
 * (gateways, which the rule never drops); otherwise the route stays as read (a flight package or a tour abroad).
 *
 * Derived on 2026-11-14 (task 33) from every tour of 1 to 4 days whose route came from its day headings in the
 * saved crawl logs (Big Line, EGL, Charming, Yummy) and from the subarea of the saved Sunflower listing. Of the 307
 * tours of 2 or 3 days (there were none of 1), 296 have a stop in Guangdong; the other regions seen are Guangxi,
 * Hunan, Fujian, Jiangxi (then part of 華中), Macau, Seoul and Busan. Three more appeared only through wrong matches and
 * are left out: 上海及華東 (南昆山, 廣東小烏鎮, 夜上海風情街), 雲南 (廣東版《麗江古城》) and northern Taiwan (淡水, an old street
 * in Huizhou). At 4 days Japan, Singapore, Vietnam, Taiwan, Hainan and Brunei appear by air, so the limit is 3 days.
 *
 * Re-derived on 2026-11-15 (task 37), when 華中 became 湖北, 河南 and 江西: in the same saved logs the one tour of 2 or 3
 * days with a stop in any of the three is a 3-day Jiangxi tour (Yummy BL-J-ZC03, tagged 江西). At 4 days there are four
 * more, all Jiangxi (Big Line CKOW04W 贛州, Sunflower LNHK04MY, Yummy CL-F-CE04 and CL-J-TC04); Hubei and Henan appear
 * only on tours of 5 days or more. So Jiangxi stays and Hubei and Henan are out of reach.
 *
 * Checked again on 2026-11-15 (task 40), when 北京及華北, 上海及華東, 四川重慶, 東北三省 and 西北 became their provinces
 * and municipalities: read without this rule, the one logged tour of 1 to 3 days with a stop in any of them is a wrong
 * match (Big Line C25326, 2 days: 臨海 from a hotel's description, which the rule drops); the shortest real one is a
 * 4-day Hangzhou tour (Charming GCEB). So none of the new regions is within reach.
 */
export const SHORT_TRIP_MAX_DAYS = 3;

export const SHORT_TRIP_REGION_IDS: readonly string[] = [
  'china-guangdong',
  'china-guangxi',
  'china-hunan',
  'china-fujian',
  'china-jiangxi',
  'macau-macau',
  'korea-seoul',
  'korea-busan',
];

/**
 * Of SHORT_TRIP_REGION_IDS, the ones kept only on a route with no China-group stop (mainland, Hong Kong, Macau,
 * Taiwan): a short Seoul or Busan tour is a flight there, so a Korean word beside a Guangdong town (`中山溫泉
 * 首爾炸雞`) is a dish or a likeness, not a second country on a 3-day coach trip (review of task 33, 2026-11-14).
 */
export const SHORT_TRIP_REGION_IDS_WITHOUT_CHINA: readonly string[] = ['korea-seoul', 'korea-busan'];
