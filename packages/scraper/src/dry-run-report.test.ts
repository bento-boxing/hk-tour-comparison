import { describe, expect, it } from 'vitest';
import { places, type ScrapedTour } from '@hktours/core';
import { describePage } from './dry-run-report';

const TODAY = '2026-11-14';
const tour = (fields: Partial<ScrapedTour>): ScrapedTour => ({
  operatorId: 'egl', code: 'T1', url: 'https://example.test/t/1', title: '中山3天', days: 3, nights: 2,
  dayHeadings: ['香港 → 中山'], startPoint: null, endPoint: null, fromPriceHkd: 1000,
  departures: [{ date: '2026-12-01', priceHkd: 1000 }], ...fields,
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
