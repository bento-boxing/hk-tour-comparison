import { load } from 'cheerio';
import { isIsoDate, parsePriceHkd, type IsoDate, type ScrapedTour } from '@hktours/core';
import { tourIdOf, tourPageUrl } from './discover';
import { tourOrNull } from '../shared/joined';
import { splitPage } from './fetch-page';
import {
  codeOf, DAY_LINE, FROM_PRICE, gatheringOptions, isBookable, NOTICE, noticeLines, PRODUCT_INFO, textOf, TITLE,
} from './public';
import { withoutConnections } from './route';

// Sources: docs/operators/taste.md, "Where each fact comes from". The text is fetchPage's join of the run's date, the
// tour's trimmed page and its dates answer's dates and statuses. Owner decision 2026-11-19 (a reduced listing): every
// date the dates answer lists, each with no price of its own (the site shows it at the tour's "from" price, marked
// 起); the site shows no full marker, so a full date may be listed as bookable.

/** `行程天數：3天`: the days. */
const DAYS = /行程天數\s*[:：]\s*(\d+)\s*天/;
const MAX_DAYS = 60;
/** `⇨`: the arrow the site's long-haul day lines use between places, often with no space (`香港⇨大阪`). */
const OTHER_ARROW = /⇨/g;

/**
 * The gathering point from the booking notes (raw or trimmed HTML): its options' places, joined with ` / `
 * (`落馬洲火車站(福田口岸1號門) / 深圳灣口岸`), or null when the notes name none. The shared rules read it as the
 * other operators' gathering points are: a Shenzhen checkpoint is kind `sz`, Hong Kong (the airport, West Kowloon
 * station) kind `hk`.
 */
export function gatheringPoint(noticeHtml: string): string | null {
  const options = gatheringOptions(noticeLines(noticeHtml));
  return options.length === 0 ? null : options.join(' / ');
}

/**
 * One Taste Travel tour (fetchPage's text for its tour page) as a ScrapedTour, or why it is not one. A page without a
 * code, a day count or a "from" price is not one (never guessed from the title, the code or the dates). The reasons
 * are fixed texts, never anything from the page, so they can be logged.
 */
export function readTour(text: string, url: string): ScrapedTour | { why: string } {
  const id = tourIdOf(url);
  if (id === null) return { why: 'not a Taste Travel tour page' };
  const joined = splitPage(text);
  if (joined === null) return { why: 'not the joined tour page and dates answer' };
  const { today, page, dates } = joined;
  if (!isIsoDate(today)) return { why: 'the run\'s date is not a date' };

  const $ = load(page);
  const code = codeOf(page);
  if (code === null) return { why: 'the tour page has no tour code (.detail-number)' };
  const days = DAYS.exec(textOf($, $(PRODUCT_INFO).first()));
  if (!days || Number(days[1]) < 1 || Number(days[1]) > MAX_DAYS) return { why: 'the tour page has no day count (行程天數)' };
  const fromPriceHkd = parsePriceHkd(textOf($, $(FROM_PRICE).first().find('span').first()));
  if (fromPriceHkd === null) return { why: 'the tour page has no "from" price (.detail-price .tig)' };

  // Every bookable date from the run's date on, once, sorted; none has a price of its own.
  const upcoming = new Set<IsoDate>();
  for (const { date, title } of dates) {
    if (typeof date === 'string' && typeof title === 'string' && isBookable(title) && isIsoDate(date) && date >= today) upcoming.add(date);
  }
  const departures = [...upcoming].sort().map(date => ({ date, priceHkd: null }));

  const notice = $(NOTICE).first();
  const gathering = notice.length > 0 ? gatheringPoint($.html(notice)) : null;
  const title = textOf($, $(TITLE).first());
  return {
    operatorId: 'taste',
    code,
    url: tourPageUrl(id),
    title,
    days: Number(days[1]),
    nights: null,
    // Each day's line (`深圳關口集合 → … 江門 …`) through the shared place matching, the site's other
    // arrow (`香港⇨大阪`) as →, which the shared rules split at, and without the flight hubs and stations it offers as
    // a choice (`杜拜/多哈/伊斯坦堡`, `經深圳北/廣州南站`) or passes (`途經深圳北站`): route.ts (task 48).
    dayHeadings: withoutConnections($(DAY_LINE).toArray().map(line => textOf($, $(line)).replace(OTHER_ARROW, '→')).filter(line => line !== '')),
    // The title, read only when the day lines give no stop (owner ruling 2026-11-19, task 45 fix round 1, as Big Line
    // and Sunflower have it): many Guangdong short trips name their places only inside 【】 in their day lines, which the
    // shared rules drop with their text. The title is read as it is, by the same shared rules, so 【】 in it are dropped
    // too (reading inside them gives wrong places, such as a Foshan town read as the Jiangxi city 九江). The site gives
    // no region or category to fall back on instead.
    ...(title === '' ? {} : { fallbackRoute: title }),
    startPoint: gathering,
    endPoint: gathering,
    fromPriceHkd,
    departures,
  };
}

/** One Taste Travel tour as a ScrapedTour; null when it is not one (see readTour for the reasons). */
export function parse(text: string, url: string): ScrapedTour | null {
  return tourOrNull(readTour(text, url));
}
