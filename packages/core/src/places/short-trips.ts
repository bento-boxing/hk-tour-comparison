/**
 * Rule 3 of a route read from fallback text ("too far for the trip", owner request 2026-11-14): on a tour of at
 * most SHORT_TRIP_MAX_DAYS days, a stop outside these regions is dropped (see extractFallbackStops).
 *
 * Derived on 2026-11-14 (task 33) from every tour of 1 to 4 days whose route came from its day headings in the
 * saved crawl logs (Big Line, EGL, Charming, Yummy) and from the subarea of the saved Sunflower listing. Of the 307
 * tours of 2 or 3 days (there were none of 1), 296 have a stop in Guangdong; the other regions seen are Guangxi,
 * Hunan, Fujian, Jiangxi (華中), Macau, Seoul and Busan. Three more appeared only through wrong matches and are left
 * out: 上海及華東 (南昆山, 廣東小烏鎮, 夜上海風情街), 雲南 (廣東版《麗江古城》) and northern Taiwan (淡水, an old street
 * in Huizhou). At 4 days Japan, Singapore, Vietnam, Taiwan, Hainan and Brunei appear by air, so the limit is 3 days.
 */
export const SHORT_TRIP_MAX_DAYS = 3;

export const SHORT_TRIP_REGION_IDS: readonly string[] = [
  'china-guangdong',
  'china-guangxi',
  'china-hunan',
  'china-fujian',
  'china-central',
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
