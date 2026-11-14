import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { fetchPage, joinPage, splitPage } from './fetch-page';
import { eglScraper } from './index';

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const PAGE_URL = 'https://www.egltours.com/website/itinerary/HTJSJG06';
const DATES_URL = 'https://www.egltours.com/api/v1/tours/HTJSJG06/dates?currencyCode=HKD';
const html = readFixture('multi-city.html');
const dates = readFixture('multi-city.dates.json');

function fakeFetcher(pages: Record<string, string | null>): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return { asked, fetchText: async url => { asked.push(url); return pages[url] ?? null; } };
}

it('fetches the page, then its dates, through the fetcher it is given, and joins them', async () => {
  const fetcher = fakeFetcher({ [PAGE_URL]: html, [DATES_URL]: dates });
  const text = await fetchPage(fetcher, PAGE_URL);
  expect(fetcher.asked).toEqual([PAGE_URL, DATES_URL]);
  expect(splitPage(text!)).toEqual({ html, datesJson: dates });
});

it('is null, a page not fetched, when the page cannot be fetched; the dates are not asked for', async () => {
  const fetcher = fakeFetcher({ [DATES_URL]: dates });
  expect(await fetchPage(fetcher, PAGE_URL)).toBeNull();
  expect(fetcher.asked).toEqual([PAGE_URL]);
});

it('is null, a page not fetched, when the dates cannot be fetched', async () => {
  const fetcher = fakeFetcher({ [PAGE_URL]: html });
  expect(await fetchPage(fetcher, PAGE_URL)).toBeNull();
  expect(fetcher.asked).toEqual([PAGE_URL, DATES_URL]);
});

it('does not ask for dates when the page has no tour code; the parser then rejects the page', async () => {
  const notTour = '<html><body>404</body></html>';
  const fetcher = fakeFetcher({ [PAGE_URL]: notTour });
  const text = await fetchPage(fetcher, PAGE_URL);
  expect(fetcher.asked).toEqual([PAGE_URL]);
  expect(splitPage(text!)).toEqual({ html: notTour, datesJson: null });
  expect(eglScraper.parse(text!, PAGE_URL)).toBeNull();
});

it('asks for the dates of the code the page states, not one read from the URL', async () => {
  const otherUrl = 'https://www.egltours.com/website/itinerary/htjsjg06';
  const fetcher = fakeFetcher({ [otherUrl]: html, [DATES_URL]: dates });
  expect(await fetchPage(fetcher, otherUrl)).not.toBeNull();
  expect(fetcher.asked).toEqual([otherUrl, DATES_URL]);
});

it('splitPage gives null for text that is not a joined page', () => {
  expect(splitPage(html)).toBeNull();
  expect(splitPage('')).toBeNull();
  expect(splitPage('{"html":1}')).toBeNull();
  expect(splitPage(JSON.stringify({ html: 'x', datesJson: 2 }))).toBeNull();
  expect(splitPage(joinPage('x', null))).toEqual({ html: 'x', datesJson: null });
});

it('the scraper parses a joined page, and returns null for anything else', () => {
  expect(eglScraper.parse(joinPage(html, dates), PAGE_URL)).toMatchObject({ operatorId: 'egl', code: 'HTJSJG06', days: 6 });
  expect(eglScraper.parse(html, PAGE_URL)).toBeNull();
  expect(eglScraper.parse(joinPage(html, null), PAGE_URL)).toBeNull();
});

it('the scraper fetches through fetchPage and has a first-run floor of a third of the measured tours', () => {
  expect(eglScraper.id).toBe('egl');
  expect(eglScraper.fetchPage).toBe(fetchPage);
  expect(eglScraper.minExpectedTours).toBe(165);
});
