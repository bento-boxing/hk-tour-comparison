import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { DATES_URL, detailUrl } from './discover';
import { createFetchPage, joinTour, MAX_MONTHS_PER_TOUR, monthsToRequest, splitTour } from './fetch-page';
import { publicDates, publicDetail } from './public';
import { rawDates, rawDetail, rawRow, SECRETS } from './test-responses';

const TODAY = '2026-11-13';
const PAGE = 'https://bigline.hk/tour-group/9109';

interface Asked { method: 'GET' | 'POST'; url: string; body?: unknown }

/** A fetcher serving the detail answer and one dates answer per month; anything else is null. */
function fakeFetcher(detail: unknown, months: Record<string, unknown> = {}, opts: { canPost?: boolean } = {}) {
  const asked: Asked[] = [];
  const text = (value: unknown) => (value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value));
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push({ method: 'GET', url });
      return url === detailUrl('9109') ? text(detail) : null;
    },
  };
  if (opts.canPost !== false) {
    fetcher.postJson = async (url, body) => {
      asked.push({ method: 'POST', url, body });
      const month = (body as { yearMonth?: string }).yearMonth ?? '';
      return url === DATES_URL ? text(months[month]) : null;
    };
  }
  return { fetcher, asked };
}

const fetchPage = () => createFetchPage({ today: () => TODAY });
const posted = (asked: Asked[]) => asked.filter(a => a.method === 'POST').map(a => (a.body as { yearMonth: string }).yearMonth);

describe('monthsToRequest', () => {
  it('is at most the first three listed months from the current Hong Kong month on', () => {
    expect(MAX_MONTHS_PER_TOUR).toBe(3);
    expect(monthsToRequest(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'], TODAY)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('counts listed months, not calendar months: a gap does not use up the three', () => {
    expect(monthsToRequest(['2027-03', '2026-12', '2027-06', '2027-04'], TODAY)).toEqual(['2026-12', '2027-03', '2027-04']);
  });
  it('is empty when no listed month is the current one or later', () => {
    expect(monthsToRequest(['2026-09', '2026-10'], TODAY)).toEqual([]);
    expect(monthsToRequest([], TODAY)).toEqual([]);
    expect(monthsToRequest(null, TODAY)).toEqual([]);
  });
  it('skips anything that is not a YYYY-MM month, and takes each month once', () => {
    expect(monthsToRequest(['2026-12&x=1', '2026-13', 'soon', 202612, null, '2026-12', '2026-12'], TODAY)).toEqual(['2026-12']);
  });
});

describe('fetchPage', () => {
  it('GETs the detail, then POSTs the site\'s own body for each month to request, and joins the public facts', async () => {
    const months = { '2026-11': rawDates([rawRow('2026-11-29')]), '2026-12': rawDates([rawRow('2026-12-04')]) };
    const { fetcher, asked } = fakeFetcher(rawDetail(), months);
    const text = await fetchPage()(fetcher, PAGE);
    expect(asked).toEqual([
      { method: 'GET', url: detailUrl('9109') },
      { method: 'POST', url: DATES_URL, body: { pageNo: 1, productId: '9109', yearMonth: '2026-11', pageSize: 1000 } },
      { method: 'POST', url: DATES_URL, body: { pageNo: 1, productId: '9109', yearMonth: '2026-12', pageSize: 1000 } },
    ]);
    expect(splitTour(text!)).toEqual({
      detail: publicDetail(rawDetail()),
      months: [
        { yearMonth: '2026-11', dates: publicDates(months['2026-11']) },
        { yearMonth: '2026-12', dates: publicDates(months['2026-12']) },
      ],
    });
  });
  it('keeps no name, note, supplier or cost in what it hands to parse', async () => {
    const { fetcher } = fakeFetcher(rawDetail(), { '2026-11': rawDates([rawRow('2026-11-29')]), '2026-12': rawDates([]) });
    const text = (await fetchPage()(fetcher, PAGE))!;
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });
  it('requests at most three months', async () => {
    const detail = rawDetail({ availableMonths: ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'] });
    const all = Object.fromEntries(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map(m => [m, rawDates([])]));
    const { fetcher, asked } = fakeFetcher(detail, all);
    expect(await fetchPage()(fetcher, PAGE)).not.toBeNull();
    expect(posted(asked)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('sends no POST for a tour with no month from the current one on, and hands parse no months', async () => {
    const { fetcher, asked } = fakeFetcher(rawDetail({ availableMonths: ['2026-10'] }), {}, { canPost: false });
    const text = await fetchPage()(fetcher, PAGE);
    expect(asked.map(a => a.method)).toEqual(['GET']);
    expect(splitTour(text!)?.months).toEqual([]);
  });
  it('is null, with no POST, when the detail cannot be fetched', async () => {
    const { fetcher, asked } = fakeFetcher(undefined);
    expect(await fetchPage()(fetcher, PAGE)).toBeNull();
    expect(asked).toHaveLength(1);
  });
  it.each([
    ['refuses (code 401)', { code: 401, msg: '未授权' }, /code 401/],
    ['reports another error (code 500)', { code: 500, msg: '404 NOT_FOUND' }, /code 500/],
    ['answers without a code', { data: {} }, /code none/],
    ['answers with a page that is not JSON', '<html>blocked</html>', /not JSON/],
  ])('fails the tour, with no POST, when the API %s', async (_name, answer, message) => {
    const { fetcher, asked } = fakeFetcher(answer);
    await expect(fetchPage()(fetcher, PAGE)).rejects.toThrow(message);
    expect(asked).toHaveLength(1);
  });
  it('is null when a month cannot be fetched, and asks for no later month', async () => {
    const detail = rawDetail({ availableMonths: ['2026-11', '2026-12', '2027-01'] });
    const { fetcher, asked } = fakeFetcher(detail, { '2026-12': rawDates([]) });
    expect(await fetchPage()(fetcher, PAGE)).toBeNull();
    expect(posted(asked)).toEqual(['2026-11']);
  });
  it('fails the tour when a month\'s answer carries an error code, and asks for no later month', async () => {
    const detail = rawDetail({ availableMonths: ['2026-11', '2026-12'] });
    const { fetcher, asked } = fakeFetcher(detail, { '2026-11': { code: 401, msg: '未授权' }, '2026-12': rawDates([]) });
    await expect(fetchPage()(fetcher, PAGE)).rejects.toThrow(/code 401/);
    expect(posted(asked)).toEqual(['2026-11']);
  });
  it('never logs or throws with what the API said, only its code', async () => {
    const { fetcher } = fakeFetcher({ code: 401, msg: SECRETS[1] });
    await expect(fetchPage()(fetcher, PAGE)).rejects.toThrow(/^(?!.*SALE-REMARK)/s);
  });
  it('after three refusals in a row sends nothing more, for any tour', async () => {
    const run = fetchPage();
    const refusing = fakeFetcher({ code: 401, msg: '未授权' });
    for (let i = 0; i < 3; i++) await expect(run(refusing.fetcher, PAGE)).rejects.toThrow(/code 401/);
    const fine = fakeFetcher(rawDetail({ availableMonths: [] }));
    await expect(run(fine.fetcher, PAGE)).rejects.toThrow(/refused 3 requests in a row/);
    expect(refusing.asked).toHaveLength(3);
    expect(fine.asked).toEqual([]);
  });
  it('a good answer between refusals starts the count again; a not-found code is not a refusal', async () => {
    const run = fetchPage();
    const refusing = fakeFetcher({ code: 401 });
    const notFound = fakeFetcher({ code: 500, msg: '404 NOT_FOUND' });
    const fine = fakeFetcher(rawDetail({ availableMonths: [] }));
    for (const f of [refusing, refusing, fine, refusing, notFound, refusing]) await run(f.fetcher, PAGE).catch(() => null);
    expect(await run(fine.fetcher, PAGE)).not.toBeNull();
  });
  it('counts a page that is not JSON as a refusal (a block page)', async () => {
    const run = fetchPage();
    const blocked = fakeFetcher('<html>blocked</html>');
    for (let i = 0; i < 3; i++) await run(blocked.fetcher, PAGE).catch(() => null);
    await expect(run(blocked.fetcher, PAGE)).rejects.toThrow(/in a row/);
    expect(blocked.asked).toHaveLength(3);
  });
  it('fails the tour, without a request, for a URL that is not a Big Line tour page', async () => {
    const { fetcher, asked } = fakeFetcher(rawDetail());
    await expect(fetchPage()(fetcher, 'https://bigline.hk/tour-group/9109x')).rejects.toThrow(/not a Big Line tour page/);
    expect(asked).toEqual([]);
  });
  it('fails the tour when it needs dates and the fetcher cannot POST', async () => {
    const { fetcher } = fakeFetcher(rawDetail(), {}, { canPost: false });
    await expect(fetchPage()(fetcher, PAGE)).rejects.toThrow(/cannot POST/);
  });
  it('asks for months from the current Hong Kong month by default', async () => {
    const { fetcher, asked } = fakeFetcher(rawDetail({ availableMonths: ['2000-01', '2999-12'] }), { '2999-12': rawDates([]) });
    expect(await createFetchPage()(fetcher, PAGE)).not.toBeNull();
    expect(posted(asked)).toEqual(['2999-12']);
  });
});

describe('joinTour and splitTour', () => {
  it('round-trip', () => {
    const tour = { detail: publicDetail(rawDetail()), months: [{ yearMonth: '2026-11', dates: publicDates(rawDates([])) }] };
    expect(splitTour(joinTour(tour))).toEqual(tour);
  });
  it.each(['', 'null', '[]', '<html>', '{"detail":{}}', '{"detail":{},"months":{}}', '{"detail":{},"months":[{"yearMonth":1}]}'])(
    'splitTour(%j) is null', text => { expect(splitTour(text)).toBeNull(); },
  );
});
