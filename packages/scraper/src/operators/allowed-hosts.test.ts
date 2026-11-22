import { describe, expect, it } from 'vitest';
import { allowedOriginsOf, createFetcher, offAllowedHosts } from '../polite-fetch';
import type { Fetcher } from '../types';
import * as bigline from './bigline';
import * as charming from './charming';
import * as egl from './egl';
import * as jetour from './jetour';
import { SCRAPERS } from '.';
import * as sunflower from './sunflower';
import * as taste from './taste';
import * as texpert from './texpert';
import * as yummy from './yummy';

/**
 * Task 66: each operator's allowed hosts (OperatorScraper.allowedHosts), pinned, and every request URL its module
 * builds checked against them. Offline: the fetchers here are fakes that answer from memory.
 */
const EXPECTED: Record<string, string[]> = {
  bigline: ['bigline.hk', 'www.bigline.hk', 'api.biglinehk.com'],
  charming: ['www.charming-online.com', 'charming-online.com'],
  egl: ['www.egltours.com', 'egltours.com'],
  jetour: ['www.jetour.com.hk', 'jetour.com.hk'],
  sunflower: ['www.sunflower.com.hk'],
  taste: ['tastetravel.com.hk'],
  texpert: ['www.texpert.com', 'texpert.com'],
  yummy: ['api.yummyholiday.net', 'www.yummyholiday.net'],
};

const onHosts = (hosts: readonly string[], url: string) => offAllowedHosts(new URL(url), allowedOriginsOf(hosts));

it('every scraper declares exactly its expected hosts, and createFetcher accepts them', () => {
  expect(Object.keys(SCRAPERS).sort()).toEqual(Object.keys(EXPECTED).sort());
  for (const [id, scraper] of Object.entries(SCRAPERS)) {
    expect([...scraper!.allowedHosts], id).toEqual(EXPECTED[id]);
    expect(() => createFetcher({ userAgent: 'test-bot/0.1', allowedHosts: scraper!.allowedHosts, log: () => {} }), id).not.toThrow();
  }
});

it('Sunflower and Taste stay on one host each (their same-origin rule is pinned by their own tests)', () => {
  expect(sunflower.sunflowerScraper.allowedHosts).toHaveLength(1);
  expect(taste.tasteScraper.allowedHosts).toHaveLength(1);
});

it('Big Line\'s extra header goes to a host on its list', () => {
  for (const host of Object.keys(bigline.biglineScraper.requestHeaders ?? {})) {
    expect(bigline.biglineScraper.allowedHosts).toContain(host);
  }
});

describe.each([
  ['bigline', bigline.ALLOWED_HOSTS, [bigline.detailUrl('9109'), bigline.DATES_URL]],
  ['charming', charming.ALLOWED_HOSTS, [charming.listUrl(1), charming.listUrl(8)]],
  ['egl', egl.ALLOWED_HOSTS, [egl.datesUrl('HTJSJG06')]],
  ['sunflower', sunflower.ALLOWED_HOSTS, [sunflower.LISTING_URL, sunflower.bookingUrl('KKFE05WR')]],
  ['taste', taste.ALLOWED_HOSTS, [taste.listUrl(0), taste.listUrl(310), taste.tourPageUrl('693'), taste.eventUrl('693')]],
  ['yummy', yummy.ALLOWED_HOSTS, [yummy.LISTING_URL, yummy.detailUrl('5906'), yummy.datesUrl('5906'), yummy.tourPageUrl('5906')]],
])('%s', (_id, hosts, urls) => {
  it.each(urls)('builds %s on its allowed hosts', url => {
    expect(onHosts(hosts, url)).toBeNull();
  });
});

/** A fake fetcher for a sitemap operator: an index whose one child (on the sitemap's own origin) lists `pages`. */
function sitemapSite(pages: string[]): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetchText: async url => {
      asked.push(url);
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('child.xml')) return `<urlset>${pages.map(p => `<url><loc>${p}</loc></url>`).join('')}</urlset>`;
      return `<sitemapindex><sitemap><loc>${parsed.origin}/child.xml</loc></sitemap></sitemapindex>`;
    },
  };
}

describe.each([
  ['bigline', bigline.ALLOWED_HOSTS, bigline.discover, 'https://bigline.hk/tour-group/9109'],
  ['egl', egl.ALLOWED_HOSTS, egl.discover, 'https://www.egltours.com/website/itinerary/HTJSJG06'],
  ['jetour', jetour.ALLOWED_HOSTS, jetour.discover, 'https://www.jetour.com.hk/tour/THB'],
  ['texpert', texpert.ALLOWED_HOSTS, texpert.discover, 'https://www.texpert.com/zh-hk/tour/1272-5-day-a-b'],
])('%s discovery', (_id, hosts, discover, tourPage) => {
  it('requests only its allowed hosts, and finds only tour pages on them', async () => {
    const fetcher = sitemapSite([tourPage, 'https://elsewhere.test/tour/1', 'http://elsewhere.test/x']);
    const found = await discover(fetcher);
    expect(found).toEqual([tourPage]);
    expect(fetcher.asked).toHaveLength(2); // the sitemap and its child
    for (const url of [...fetcher.asked, ...found]) expect(onHosts(hosts, url), url).toBeNull();
  });
});

it.each([
  ['bigline', bigline.discover, 'https://bigline.hk/sitemap.xml'],
  ['egl', egl.discover, 'https://www.egltours.com/sitemap.xml'],
  ['jetour', jetour.discover, 'https://www.jetour.com.hk/sitemap.xml'],
  ['texpert', texpert.discover, 'https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml'],
])('%s discovery skips a child sitemap off its hosts, and says so on the log it is given', async (_id, discover, sitemap) => {
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === sitemap ? '<sitemapindex><sitemap><loc>https://elsewhere.test/child.xml</loc></sitemap></sitemapindex>' : null;
    },
  };
  const lines: string[] = [];
  expect(await discover(fetcher, undefined, line => lines.push(line))).toEqual([]);
  expect(asked).toEqual([sitemap]);
  expect(lines).toEqual(['sitemap: skipped 1 child sitemap not on the operator\'s hosts (elsewhere.test)']);
});
