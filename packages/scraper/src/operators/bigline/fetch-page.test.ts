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

/** A fresh fetchPage (its own refusal counts), run on TODAY. */
const fetchPage = () => {
  const run = createFetchPage();
  return (fetcher: Fetcher, url: string) => run(fetcher, url, TODAY);
};
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
    expect(splitTour(text as string)).toEqual({
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
    expect(splitTour(text as string)?.months).toEqual([]);
  });
  it('is null, with no POST, when the detail cannot be fetched', async () => {
    const { fetcher, asked } = fakeFetcher(undefined);
    expect(await fetchPage()(fetcher, PAGE)).toBeNull();
    expect(asked).toHaveLength(1);
  });
  it.each([
    ['refuses (code 401)', { code: 401, msg: '未授权' }, /code 401/],
    ['reports another error (code 500)', { code: 500, msg: 'server error' }, /code 500/],
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
  it('after three refused details in a row sends nothing more, for any tour', async () => {
    const run = fetchPage();
    const refusing = fakeFetcher({ code: 401, msg: '未授权' });
    for (let i = 0; i < 3; i++) await expect(run(refusing.fetcher, PAGE)).rejects.toThrow(/code 401/);
    const fine = fakeFetcher(rawDetail({ availableMonths: [] }));
    await expect(run(fine.fetcher, PAGE)).rejects.toThrow(/refused 3 tour detail requests in a row/);
    expect(refusing.asked).toHaveLength(3);
    expect(fine.asked).toEqual([]);
  });
  it('a detail the fetcher gave up on (null: HTTP 401/403/429, network) counts toward the same three', async () => {
    const run = fetchPage();
    const unanswered = fakeFetcher(undefined);
    for (let i = 0; i < 3; i++) expect(await run(unanswered.fetcher, PAGE)).toBeNull();
    await expect(run(unanswered.fetcher, PAGE)).rejects.toThrow(/in a row/);
    expect(unanswered.asked).toHaveLength(3);
  });
  it.each([
    ['refused (code 401)', { code: 401, msg: '未授权' }],
    ['not answered (null)', undefined],
  ])('when every details answers but every dates POST is %s, it stops after three tours', async (_name, refusal) => {
    const run = fetchPage();
    const datesRefused = fakeFetcher(rawDetail({ availableMonths: ['2026-11', '2026-12'] }), { '2026-11': refusal, '2026-12': refusal });
    for (let i = 0; i < 3; i++) await run(datesRefused.fetcher, PAGE).catch(() => null);
    expect(datesRefused.asked.map(a => a.method)).toEqual(['GET', 'POST', 'GET', 'POST', 'GET', 'POST']);
    for (let i = 0; i < 5; i++) await expect(run(datesRefused.fetcher, PAGE)).rejects.toThrow(/refused 3 dates requests in a row/);
    expect(datesRefused.asked).toHaveLength(6); // nothing more was sent
  });
  it('a success resets only the count of its own kind', async () => {
    const run = fetchPage();
    const detailRefused = fakeFetcher({ code: 401 });
    const datesRefused = fakeFetcher(rawDetail({ availableMonths: ['2026-11'] }), { '2026-11': { code: 401 } });
    const noMonths = fakeFetcher(rawDetail({ availableMonths: [] }));
    const datesFine = fakeFetcher(rawDetail({ availableMonths: ['2026-11'] }), { '2026-11': rawDates([]) });
    // Two refused details, then a good detail with refused dates: the detail count starts again, the dates count is 1.
    for (const f of [detailRefused, detailRefused, datesRefused]) await run(f.fetcher, PAGE).catch(() => null);
    // Two more refused details (detail count 2) and a refused dates (dates count 2): still sending.
    for (const f of [detailRefused, detailRefused, datesRefused]) await run(f.fetcher, PAGE).catch(() => null);
    // A tour with no months resets the detail count only; a good dates answer resets the dates count.
    expect(await run(noMonths.fetcher, PAGE)).not.toBeNull();
    expect(await run(datesFine.fetcher, PAGE)).not.toBeNull();
    for (const f of [detailRefused, detailRefused, datesRefused, datesRefused]) await run(f.fetcher, PAGE).catch(() => null);
    expect(await run(noMonths.fetcher, PAGE)).not.toBeNull(); // detail 0 after the dates tours, dates 2: still sending
    await run(datesRefused.fetcher, PAGE).catch(() => null); // dates 3
    await expect(run(noMonths.fetcher, PAGE)).rejects.toThrow(/refused 3 dates requests in a row/);
  });
  it('a detail answering code 500 "404 NOT_FOUND" means the tour is gone: a skip, no POST, not a refusal', async () => {
    const run = fetchPage();
    const gone = fakeFetcher({ code: 500, msg: '404 NOT_FOUND' });
    for (let i = 0; i < 4; i++) expect(await run(gone.fetcher, PAGE)).toEqual({ skip: 'gone' });
    expect(gone.asked.map(a => a.method)).toEqual(['GET', 'GET', 'GET', 'GET']);
  });
  it.each([
    ['another message', { code: 500, msg: 'NOT_FOUND_ELSEWHERE' }, /code 500/],
    ['a message that only contains it', { code: 500, msg: 'upstream 404 NOT_FOUND: x' }, /code 500/],
    ['the message with another code', { code: 404, msg: '404 NOT_FOUND' }, /code 404/],
  ])('only that exact not-found answer is gone; %s fails the tour', async (_name, answer, message) => {
    await expect(fetchPage()(fakeFetcher(answer).fetcher, PAGE)).rejects.toThrow(message);
  });
  it('after 10 gone answers in a row sends nothing more: the endpoint may have changed', async () => {
    const run = fetchPage();
    const gone = fakeFetcher({ code: 500, msg: '404 NOT_FOUND' });
    for (let i = 0; i < 10; i++) expect(await run(gone.fetcher, PAGE)).toEqual({ skip: 'gone' });
    const fine = fakeFetcher(rawDetail({ availableMonths: [] }));
    await expect(run(fine.fetcher, PAGE)).rejects.toThrow(/10 tours in a row/);
    expect(gone.asked).toHaveLength(10);
    expect(fine.asked).toEqual([]);
  });
  it('a found tour between gone answers starts that count again', async () => {
    const run = fetchPage();
    const gone = fakeFetcher({ code: 500, msg: '404 NOT_FOUND' });
    const fine = fakeFetcher(rawDetail({ availableMonths: [] }));
    for (let i = 0; i < 9; i++) await run(gone.fetcher, PAGE);
    expect(await run(fine.fetcher, PAGE)).not.toBeNull();
    for (let i = 0; i < 9; i++) expect(await run(gone.fetcher, PAGE)).toEqual({ skip: 'gone' });
  });
  it.each([
    ['code 503', { code: 503, msg: 'busy' }],
    ['a JSON answer with no code', { msg: 'x' }],
  ])('counts %s toward the refusal stop', async (_name, answer) => {
    const run = fetchPage();
    const refusing = fakeFetcher(answer);
    for (let i = 0; i < 3; i++) await run(refusing.fetcher, PAGE).catch(() => null);
    await expect(run(refusing.fetcher, PAGE)).rejects.toThrow(/refused 3 tour detail requests in a row/);
    expect(refusing.asked).toHaveLength(3);
  });
  it('counts a page that is not JSON as a refusal (a block page)', async () => {
    const run = fetchPage();
    const blocked = fakeFetcher('<html>blocked</html>');
    for (let i = 0; i < 3; i++) await run(blocked.fetcher, PAGE).catch(() => null);
    await expect(run(blocked.fetcher, PAGE)).rejects.toThrow(/in a row/);
    expect(blocked.asked).toHaveLength(3);
  });
  it('a refused month counts toward the dates count once, and asks for no later month', async () => {
    const run = fetchPage();
    const detail = rawDetail({ availableMonths: ['2026-11', '2026-12', '2027-01'] });
    const refused = fakeFetcher(detail, { '2026-11': rawDates([]), '2026-12': { code: 429 } });
    for (let i = 0; i < 3; i++) await expect(run(refused.fetcher, PAGE)).rejects.toThrow(/code 429/);
    expect(posted(refused.asked)).toEqual(['2026-11', '2026-12', '2026-11', '2026-12', '2026-11', '2026-12']);
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
  it('asks for months from the month of the today it is given (the run\'s, in Hong Kong)', async () => {
    const { fetcher, asked } = fakeFetcher(rawDetail({ availableMonths: ['2027-02', '2027-03'] }), { '2027-03': rawDates([]) });
    expect(await createFetchPage()(fetcher, PAGE, '2027-03-31')).not.toBeNull();
    expect(posted(asked)).toEqual(['2027-03']);
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
