/**
 * Rule 3 of a route read from fallback text ("too far for the trip", owner request 2026-11-14): on a tour of at
 * most SHORT_TRIP_MAX_DAYS days, a stop outside these regions is dropped (see extractFallbackStops).
 *
 * Derived on 2026-11-14 (task 33) from every tour of 1 to 4 days whose route came from its day headings in the
 * saved crawl logs (Big Line, EGL, Charming, Yummy) and from the subarea of the saved Sunflower listing: tours of up
 * to 3 days went to Guangdong (299), Guangxi, Hunan, Fujian, Jiangxi (華中), Macau, Seoul and Busan. Three regions
 * also appeared there only through wrong matches and are left out: 上海及華東 (南昆山, 廣東小烏鎮, 夜上海風情街),
 * 雲南 (廣東版《麗江古城》) and northern Taiwan (淡水, an old street in Huizhou). At 4 days Japan, Singapore, Vietnam,
 * Taiwan, Hainan and Brunei appear by air, so the limit is 3 days.
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
