import { describe, expect, it } from 'vitest';
import { places, type ScrapedTour } from '@hktours/core';
import { describePage, recordDryRun } from './dry-run-report';
import { addressRefId, DRY_RUN_LOG, PUBLIC_LOG } from './public-log';
import type { Fetcher, OperatorScraper } from './types';

const TODAY = '2026-11-14';
const tour = (fields: Partial<ScrapedTour>): ScrapedTour => ({
  operatorId: 'egl', code: 'T1', url: 'https://example.test/t/1', title: '中山3天', days: 3, nights: 2,
  dayHeadings: ['香港 → 中山'], startPoint: null, endPoint: null, fromPriceHkd: 1000,
  departures: [{ date: '2026-12-01', priceHkd: 1000 }], ...fields,
});

it('the recorded scraper hands discover the run\'s log view (task 36)', async () => {
  const views: unknown[] = [];
  const scraper: OperatorScraper = {
    id: 'egl', allowedHosts: ['example.test'], parse: () => null,
    discover: async (_fetcher, logView) => { views.push(logView); return ['https://example.test/t/1']; },
  };
  const fetcher: Fetcher = { fetchText: async () => null };
  expect(await recordDryRun(scraper, null).scraper.discover(fetcher, DRY_RUN_LOG)).toEqual(['https://example.test/t/1']);
  expect(views).toEqual([DRY_RUN_LOG]);
});

it('the recorded scraper hands discover the run\'s log, and keeps the scraper\'s allowed hosts (task 66)', async () => {
  const lines: string[] = [];
  const scraper: OperatorScraper = {
    id: 'egl', allowedHosts: ['example.test'], parse: () => null,
    discover: async (_fetcher, _logView, log) => { log?.('from discover'); return []; },
  };
  const recorded = recordDryRun(scraper, null).scraper;
  await recorded.discover({ fetchText: async () => null }, DRY_RUN_LOG, line => lines.push(line));
  expect(lines).toEqual(['from discover']);
  expect(recorded.allowedHosts).toBe(scraper.allowedHosts);
});

describe('the dry-run page line carries the page\'s reference, as the public log gives it (task 36 fix 1)', () => {
  const titled = `https://example.test/?tour=${encodeURIComponent('5天測試之旅')}`;
  it.each([
    ['a saved tour', { url: titled, parsed: tour({ url: titled }) }],
    ['a page the parser rejected', { url: titled, parsed: null }],
    ['a page that fails the schema', { url: titled, parsed: { code: 'X' } }],
  ])('%s', (_name, page) => {
    const described = describePage(page, places, TODAY);
    expect(described).toMatchObject({ url: titled, ref: addressRefId(titled) });
    expect(PUBLIC_LOG.address(titled)).toContain(`(ref ${described.ref})`);
  });
  it('a raw non-ASCII address gets the reference of its rewritten form, as on every log line', () => {
    const raw = 'https://example.test/tour/測試';
    expect(describePage({ url: raw, parsed: null }, places, TODAY).ref).toBe(addressRefId(new URL(raw).href));
  });
});

describe('the dry-run page line', () => {
  it('gives every page its days and the places the day-line rules dropped, with or without a fallback text', () => {
    const page = describePage({ url: 'u', parsed: tour({ dayHeadings: ['香港 → 中山', '高山賞紅葉', '東方威尼斯水鄉', '珠海'] }) }, places, TODAY);
    expect(page).toMatchObject({
      result: 'ok', route: ['中山 (中國)', '珠海 (中國)'], days: 3,
      dayHeadingsDropped: [{ name: '威尼斯', rule: 'comparison' }, { name: '高山', rule: 'too-far' }],
    });
    expect(page).not.toHaveProperty('fallbackDropped');
  });
  it('lists no day-line drops as an empty list', () => {
    expect(describePage({ url: 'u', parsed: tour({}) }, places, TODAY)).toMatchObject({ days: 3, dayHeadingsDropped: [] });
  });
  it('keeps both lists apart when the fallback text is read after the day-line rules emptied the route', () => {
    const page = describePage({ url: 'u', parsed: tour({ dayHeadings: ['香港 → 東方威尼斯水鄉'], fallbackRoute: '高山 中山3天' }) }, places, TODAY);
    expect(page).toMatchObject({
      result: 'ok', route: ['中山 (中國)'], routeFromFallback: true, days: 3,
      dayHeadingsDropped: [{ name: '威尼斯', rule: 'comparison' }], fallbackDropped: [{ name: '高山', rule: 'too-far' }],
    });
  });
});
