import { describe, expect, it } from 'vitest';
import { normaliseTour, places, type NormaliseResult } from '@hktours/core';
import { changedRoutes, countsOf, logPages, replayPage, type LoggedPage } from './replay';

const core = { normaliseTour, places };
const page = (fields: Partial<LoggedPage>): LoggedPage => ({
  url: 'https://example.test/t/1', code: 'T1', result: 'ok', dayHeadings: [], startPoint: null, endPoint: null, ...fields,
});

describe('replaying saved crawl logs', () => {
  it('reads only the page lines of a log', () => {
    const log = ['dry run of x', `page ${JSON.stringify(page({ dayHeadings: ['大阪'] }))}`, '  3 大阪', 'page {"url":"u","result":"parser-null"}'].join('\n');
    expect(logPages(log).map(p => p.url)).toEqual(['https://example.test/t/1', 'u']);
  });

  it('gives a page with no dates on sale a route, while its result stays as logged', () => {
    const replayed = replayPage('egl', page({ result: 'no-departures', dayHeadings: ['大阪 → 京都'], days: 6 }), core);
    expect(replayed).toEqual({
      url: 'https://example.test/t/1', code: 'T1', result: 'no-departures', route: ['japan-kansai-osaka', 'japan-kansai-kyoto'],
      days: 6, daysFrom: 'log',
    });
  });

  it('reads the logged fallback texts, and the days from the log or the text, for the title rules', () => {
    // 高山 is too far for a 2-day trip: dropped whether the days are logged or only stated in the text.
    expect(replayPage('bigline', page({ fallbackRoute: '高山 中山', days: 2 }), core).route).toEqual(['china-guangdong-zhongshan']);
    expect(replayPage('bigline', page({ fallbackRoute: '高山 中山2天' }), core).route).toEqual(['china-guangdong-zhongshan']);
    expect(replayPage('sunflower', page({ fallbackRoute: ['溫泉', '中山'], days: 2 }), core).route).toEqual(['china-guangdong-zhongshan']);
    // no logged days: Sunflower's code carries them (8 days: 長白山 is not too far)
    expect(replayPage('sunflower', page({ code: 'LRHC08SS', fallbackRoute: '長白山' }), core).route).toEqual(['china-northeast-changbaishan']);
    expect(replayPage('sunflower', page({ code: 'LRHC02SS', fallbackRoute: '長白山' }), core).route).toEqual([]);
  });

  it('takes the days from the log, else the fallback text, else the code, else one per day heading, and says which', () => {
    const daysOf = (operator: string, fields: Partial<LoggedPage>) => {
      const { days, daysFrom } = replayPage(operator, page(fields), core);
      return [days, daysFrom];
    };
    expect(daysOf('bigline', { days: 5, fallbackRoute: '中山2天' })).toEqual([5, 'log']);
    expect(daysOf('bigline', { fallbackRoute: '中山2天' })).toEqual([2, 'text']);
    // an early-booking offer is not the tour's length: `N天前` (N days before) and `提前N天` are passed over
    // invented titles: the real count first, an early-booking count after it
    expect(daysOf('bigline', { fallbackRoute: '甲地10天 早訂：45天前' })).toEqual([10, 'text']);
    expect(daysOf('bigline', { fallbackRoute: '乙地8天 早訂：5/1天前' })).toEqual([8, 'text']);
    expect(daysOf('bigline', { fallbackRoute: '丙地3天 提前45天訂' })).toEqual([3, 'text']);
    expect(daysOf('egl', { code: 'HTJEKT06' })).toEqual([6, 'code']);
    expect(daysOf('charming', { code: 'GRCLL', dayHeadings: ['倫敦', '溫莎', '倫敦'] })).toEqual([3, 'headings']);
    expect(daysOf('charming', { code: 'GRCLL', dayHeadings: [] })).toEqual([1, 'headings']);
  });

  it('applies the day-line rules with those days: a page whose days come from its headings can lose a place too far', () => {
    // two headings and no other count: 2 days, so 大阪 beside 中山 and 珠海 is too far (the run prints how many pages are so)
    expect(replayPage('charming', page({ code: 'GRCLL', dayHeadings: ['香港 → 中山 → 珠海', '大阪 → 香港'] }), core).route)
      .toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai']);
    expect(replayPage('charming', page({ code: 'GRCLL', dayHeadings: ['香港 → 中山 → 珠海', '大阪 → 香港'], days: 5 }), core).route)
      .toEqual(['china-guangdong-zhongshan', 'china-guangdong-zhuhai', 'japan-kansai-osaka']);
  });

  it('drops a province beside its own city for the operators whose parser asks for it', () => {
    expect(replayPage('yummy', page({ dayHeadings: ['雲南', '大理'], days: 8 }), core).route).toEqual(['china-yunnan-dali']);
    expect(replayPage('egl', page({ dayHeadings: ['雲南', '大理'], days: 8 }), core).route).toEqual(['region:china-yunnan', 'china-yunnan-dali']);
  });

  it('counts pages as a run does, and lists the pages whose route changed between two cores', () => {
    const pages = [
      page({ url: 'a', code: 'A06', dayHeadings: ['大阪'] }), page({ url: 'b', code: 'B', dayHeadings: ['溫泉'] }),
      page({ url: 'c', code: 'C06', result: 'no-departures', dayHeadings: ['京都'] }), { url: 'd', result: 'parser-null' },
    ];
    const after = pages.map(p => replayPage('egl', p, core));
    expect(countsOf(after)).toEqual({
      pages: 4, saved: 1, noStops: 1, noDepartures: 1, noPrice: 0, notParsed: 1, failures: 2, failureRate: 0.5, daysFromHeadings: 1,
    });
    // A core that reads every route as no-stops: pages a and c changed (b had no route, d was never parsed).
    const nothing = { normaliseTour: (): NormaliseResult => ({ ok: false, reason: 'no-stops', unmatched: [] }), places };
    const before = pages.map(p => replayPage('egl', p, nothing));
    expect(changedRoutes(before, after).map(c => [c.code, c.before, c.after, c.days, c.daysFrom])).toEqual([
      ['A06', [], ['japan-kansai-osaka'], 6, 'code'], ['C06', [], ['japan-kansai-kyoto'], 6, 'code'],
    ]);
  });
});
