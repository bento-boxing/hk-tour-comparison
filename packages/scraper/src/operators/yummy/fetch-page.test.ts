import { describe, expect, it } from 'vitest';
import { MAX_CONSECUTIVE_PUSHBACK } from '../../polite-fetch';
import type { Fetcher } from '../../types';
import { datesUrl, detailUrl } from './discover';
import { createFetchPage, joinTour, splitTour } from './fetch-page';
import { publicDates, publicDetail } from './public';
import { rawDates, rawDetail, rawGroup, SECRET_COUNT, SECRETS } from './test-responses';

const TODAY = '2026-11-14';
const PAGE = 'https://www.yummyholiday.net/#/pages/detail/detail?id=5906';
const pageOf = (id: number) => `https://www.yummyholiday.net/#/pages/detail/detail?id=${id}`;

/** A fetcher serving answers by URL (a value is sent as JSON; undefined is no answer); POSTing fails the test. */
function fakeFetcher(answers: Record<string, unknown>) {
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      const answer = answers[url];
      return answer === undefined ? null : typeof answer === 'string' ? answer : JSON.stringify(answer);
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  return { fetcher, asked };
}

const goodAnswers = (id = 5906): Record<string, unknown> => ({
  [detailUrl(String(id))]: rawDetail({ id }),
  [datesUrl(String(id))]: rawDates([rawGroup('2026-12-10'), rawGroup('2026-12-17', { group_enroll_status: 3 })]),
});

/** A fresh fetchPage (its own refusal count), run on TODAY. */
const fetchPage = () => {
  const run = createFetchPage();
  return (fetcher: Fetcher, url: string) => run(fetcher, url, TODAY);
};

describe('fetchPage', () => {
  it('GETs the detail, then the dates, and joins their public facts', async () => {
    const answers = goodAnswers();
    const { fetcher, asked } = fakeFetcher(answers);
    const text = await fetchPage()(fetcher, PAGE);
    expect(asked).toEqual([detailUrl('5906'), datesUrl('5906')]);
    expect(splitTour(text as string)).toEqual({
      detail: publicDetail(answers[detailUrl('5906')]),
      dates: publicDates(answers[datesUrl('5906')]),
    });
  });
  it('keeps no prose, image or PDF path or booking count in what it hands to parse', async () => {
    const text = (await fetchPage()(fakeFetcher(goodAnswers()).fetcher, PAGE)) as string;
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(text).not.toContain(String(SECRET_COUNT));
  });
  it('is a page not fetched (null) when the detail gets no answer, and then asks nothing more', async () => {
    const { fetcher, asked } = fakeFetcher({});
    expect(await fetchPage()(fetcher, PAGE)).toBeNull();
    expect(asked).toEqual([detailUrl('5906')]);
  });
  it('is a page not fetched (null) when the dates get no answer', async () => {
    const { fetcher } = fakeFetcher({ [detailUrl('5906')]: rawDetail() });
    expect(await fetchPage()(fetcher, PAGE)).toBeNull();
  });
  it.each([
    ['a detail that is not JSON', { [detailUrl('5906')]: '<html>blocked</html>' }, /tour detail: the answer is not JSON/],
    ['a detail with an error code', { [detailUrl('5906')]: { code: 0, msg: SECRETS[0] } }, /tour detail: the API answered code 0/],
    ['dates with an error code', { ...goodAnswers(), [datesUrl('5906')]: { code: 0, msg: SECRETS[0] } }, /dates: the API answered code 0/],
  ])('throws (not fetched, with the reason logged) for %s, never with the answer\'s text', async (_name, answers, reason) => {
    const run = fetchPage()(fakeFetcher(answers).fetcher, PAGE);
    await expect(run).rejects.toThrow(reason);
    await run.catch(error => expect((error as Error).message).not.toContain(SECRETS[0]));
  });
  it('requests nothing for a URL that is not a Yummy Holiday tour page', async () => {
    const { fetcher, asked } = fakeFetcher(goodAnswers());
    await expect(fetchPage()(fetcher, 'https://www.yummyholiday.net/#/pages/content/content?id=7')).rejects.toThrow(/not a Yummy Holiday tour page/);
    expect(asked).toEqual([]);
  });
  it(`stops requesting after ${MAX_CONSECUTIVE_PUSHBACK} refused tours in a row`, async () => {
    const run = fetchPage();
    const { fetcher, asked } = fakeFetcher({ ...goodAnswers(1), [detailUrl('2')]: '<html>blocked</html>', [detailUrl('3')]: { code: 0 } });
    expect(await run(fetcher, pageOf(1))).not.toBeNull();
    await expect(run(fetcher, pageOf(2))).rejects.toThrow(/not JSON/);
    await expect(run(fetcher, pageOf(3))).rejects.toThrow(/code 0/);
    expect(await run(fetcher, pageOf(4))).toBeNull(); // no answer
    const before = asked.length;
    await expect(run(fetcher, pageOf(1))).rejects.toThrow(/not requested: the Yummy Holiday API refused 3 requests in a row/);
    expect(asked).toHaveLength(before);
  });
  it('starts the count again after an answer', async () => {
    const run = fetchPage();
    const { fetcher } = fakeFetcher({ ...goodAnswers(1), [detailUrl('2')]: { code: 0 } });
    for (const id of [2, 2, 1, 2, 2, 1]) await run(fetcher, pageOf(id)).catch(() => null);
    expect(await run(fetcher, pageOf(1))).not.toBeNull();
  });
});

describe('splitTour', () => {
  it('reads back what joinTour wrote, and nothing else', () => {
    const tour = { detail: publicDetail(rawDetail()), dates: publicDates(rawDates([rawGroup('2026-12-10')])) };
    expect(splitTour(joinTour(tour))).toEqual(tour);
    for (const text of ['', '<html>', '[]', '{"detail":{}}', '{"detail":{},"dates":3}']) expect(splitTour(text)).toBeNull();
  });
});
