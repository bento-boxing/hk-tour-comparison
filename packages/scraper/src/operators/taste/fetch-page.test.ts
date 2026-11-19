import { describe, expect, it } from 'vitest';
import { DRY_RUN_LOG, PUBLIC_LOG, type LogView } from '../../public-log';
import type { Fetcher } from '../../types';
import { eventUrl, tourPageUrl } from './discover';
import { createFetchPage, joinPage, splitPage } from './fetch-page';
import { publicDates, publicTourPage } from './public';
import { rawDate, rawDates, rawTourPage, SECRETS } from './test-responses';

const TODAY = '2026-11-20';
const PAGE = tourPageUrl('693');

function siteFetcher(answers: Record<string, string | null>) {
  const asked: string[] = [];
  const options: unknown[] = [];
  const fetcher: Fetcher = {
    fetchText: async (url, opts) => {
      asked.push(url);
      options.push(opts);
      return answers[url] ?? null;
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  return { fetcher, asked, options };
}
const fetchPage = (log: (line: string) => void = () => {}, view: LogView = PUBLIC_LOG) => createFetchPage(log, () => view);

describe('joinPage and splitPage', () => {
  it('round-trip the run\'s date, the trimmed tour page and the dates', () => {
    const joined = { today: TODAY, page: publicTourPage(rawTourPage()), dates: publicDates(rawDates())! };
    expect(splitPage(joinPage(joined))).toEqual(joined);
  });
  it.each(['<html></html>', '[]', '{"today":"2026-11-20","page":""}', '{"today":1,"page":"","dates":[]}', '{"today":"2026-11-20","page":"","dates":{}}'])(
    'give null for any other text (%s)', text => {
      expect(splitPage(text)).toBeNull();
    },
  );
});

describe('fetchPage', () => {
  it('requests the tour page, then its dates answer, once each, by GET, and joins them with the run\'s date', async () => {
    const { fetcher, asked, options } = siteFetcher({ [PAGE]: rawTourPage(), [eventUrl('693')]: rawDates() });
    const text = await fetchPage()(fetcher, PAGE, TODAY);
    expect(asked).toEqual([tourPageUrl('693'), eventUrl('693')]);
    expect(options).toEqual([{ sameOriginRedirectsOnly: true }, { sameOriginRedirectsOnly: true }]);
    expect(splitPage(text as string)).toEqual({
      today: TODAY, page: publicTourPage(rawTourPage()), dates: [{ date: '2026-11-27', title: '收客中' }],
    });
  });

  it('keeps none of the page\'s marketing text, notes, contact links or scripts', async () => {
    const { fetcher } = siteFetcher({ [PAGE]: rawTourPage(), [eventUrl('693')]: rawDates() });
    const text = await fetchPage()(fetcher, PAGE, TODAY) as string;
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    for (const never of ['wa.me', '/tour/download/', '/tour/whatsapp/', 'pdf.pdf', '$.get', 'backgroundColor']) expect(text).not.toContain(never);
  });

  it('gives null, not fetched, when either answer is missing, and asks for no dates without a tour page', async () => {
    const noPage = siteFetcher({ [eventUrl('693')]: rawDates() });
    expect(await fetchPage()(noPage.fetcher, PAGE, TODAY)).toBeNull();
    expect(noPage.asked).toEqual([PAGE]);
    expect(await fetchPage()(siteFetcher({ [PAGE]: rawTourPage() }).fetcher, PAGE, TODAY)).toBeNull();
  });

  it('gives null, not fetched, for a dates answer that is not a JSON list (it is parsed, never evaluated)', async () => {
    for (const answer of ['<html>blocked</html>', '{"date":"2026-12-01"}', 'alert(1)']) {
      const logs: string[] = [];
      expect(await fetchPage(line => logs.push(line))(siteFetcher({ [PAGE]: rawTourPage(), [eventUrl('693')]: answer }).fetcher, PAGE, TODAY)).toBeNull();
      expect(logs).toEqual(['taste: CAK03: the dates answer is not a JSON list']);
    }
  });

  it('logs each date with a status other than the three known (the value only), which the parser then skips', async () => {
    const dates = rawDates([rawDate('2026-12-01', '額滿'), rawDate('2026-12-02'), rawDate('2026-12-03', 'FULL'), { date: '2026-12-04' }]);
    const answers = { [PAGE]: rawTourPage(), [eventUrl('693')]: dates };
    const publicLogs: string[] = [];
    await fetchPage(line => publicLogs.push(line), PUBLIC_LOG)(siteFetcher(answers).fetcher, PAGE, TODAY);
    // The public log holds tour codes, dates and plain words only: a status in Chinese is shown by its reference.
    expect(publicLogs).toEqual([
      expect.stringMatching(/^taste: CAK03: date 2026-12-01 has the status \* \(ref [0-9a-f]{8}\), skipped$/),
      'taste: CAK03: date 2026-12-03 has the status FULL, skipped',
      'taste: CAK03: date 2026-12-04 has the status (none), skipped',
    ]);
    const dryLogs: string[] = [];
    await fetchPage(line => dryLogs.push(line), DRY_RUN_LOG)(siteFetcher(answers).fetcher, PAGE, TODAY);
    expect(dryLogs[0]).toMatch(/^taste: CAK03: date 2026-12-01 has the status 額滿 \(ref [0-9a-f]{8}\), skipped$/);
  });

  it('logs how many bookable dates are not a real YYYY-MM-DD date (a count and the tour code only), which the parser skips', async () => {
    const logs: string[] = [];
    const dates = rawDates([rawDate('2026-12-01T00:00'), rawDate('01/12/2026', '已成團'), rawDate('2026-02-30'), rawDate('2026-12-02')]);
    await fetchPage(line => logs.push(line))(siteFetcher({ [PAGE]: rawTourPage(), [eventUrl('693')]: dates }).fetcher, PAGE, TODAY);
    expect(logs).toEqual(['taste: CAK03: 3 bookable dates not in YYYY-MM-DD form, skipped']);
    const one: string[] = [];
    await fetchPage(line => one.push(line))(siteFetcher({ [PAGE]: rawTourPage(), [eventUrl('693')]: rawDates([rawDate('')]) }).fetcher, PAGE, TODAY);
    expect(one).toEqual(['taste: CAK03: 1 bookable date not in YYYY-MM-DD form, skipped']);
  });

  it('names a page without a code by its tour id in the log', async () => {
    const logs: string[] = [];
    const answers = { [PAGE]: rawTourPage({ number: null }), [eventUrl('693')]: rawDates([rawDate('2026-12-01', 'X')]) };
    await fetchPage(line => logs.push(line))(siteFetcher(answers).fetcher, PAGE, TODAY);
    expect(logs).toEqual(['taste: tour_id 693: date 2026-12-01 has the status X, skipped']);
  });

  it('throws, requesting nothing, for a URL that is not a tour page', async () => {
    const { fetcher, asked } = siteFetcher({});
    for (const url of [eventUrl('693'), 'https://tastetravel.com.hk/tour/download/tour_id/693', 'https://tastetravel.com.hk/tour/whatsapp/tour_id/693']) {
      await expect(fetchPage()(fetcher, url, TODAY)).rejects.toThrow('not a Taste Travel tour page');
    }
    expect(asked).toEqual([]);
  });
});

describe('publicTourPage', () => {
  it('keeps the title, code, days line, "from" price, day lines and the gathering lines, and nothing else', () => {
    const trimmed = publicTourPage(rawTourPage());
    for (const kept of ['【江門】三天美食團', '團號：CAK03', '行程天數：3天', '<span>699</span>', '江門 → 入住酒店', '集合時間地點', 'A: 福田口岸', 'B: 深圳灣口岸']) {
      expect(trimmed).toContain(kept);
    }
    for (const dropped of ['行程編號', '早上', '07:30', '出門後', '留意', '產品資訊', '瀏覽行程PDF', 'booking-date']) expect(trimmed).not.toContain(dropped);
  });
  it('is empty for a page without any of them', () => {
    expect(publicTourPage('<html><body>Attention Required! | Cloudflare</body></html>')).toBe('');
  });
});

describe('publicDates', () => {
  it('keeps each date and status as text, and nothing else', () => {
    expect(publicDates(JSON.stringify([rawDate('2026-12-01', '已成團'), { date: 20261202, title: null }, 'x', { date: '2026-12-03', title: '收客中', price: 1 }])))
      .toEqual([{ date: '2026-12-01', title: '已成團' }, { date: '', title: '' }, { date: '', title: '' }, { date: '2026-12-03', title: '收客中' }]);
  });
  it.each(['', 'null', '{}', '<html></html>', '[1,2', 'alert(1)'])('is null for an answer that is not a JSON list (%j)', text => {
    expect(publicDates(text)).toBeNull();
  });
});
