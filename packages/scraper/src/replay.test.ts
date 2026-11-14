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
    const replayed = replayPage('egl', page({ result: 'no-departures', dayHeadings: ['大阪 → 京都'] }), core);
    expect(replayed).toEqual({ url: 'https://example.test/t/1', code: 'T1', result: 'no-departures', route: ['japan-kansai-osaka', 'japan-kansai-kyoto'] });
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

  it('drops a province beside its own city for the operators whose parser asks for it', () => {
    expect(replayPage('yummy', page({ dayHeadings: ['雲南', '大理'] }), core).route).toEqual(['china-yunnan-dali']);
    expect(replayPage('egl', page({ dayHeadings: ['雲南', '大理'] }), core).route).toEqual(['region:china-yunnan', 'china-yunnan-dali']);
  });

  it('counts pages as a run does, and lists the pages whose route changed between two cores', () => {
    const pages = [
      page({ url: 'a', code: 'A', dayHeadings: ['大阪'] }), page({ url: 'b', code: 'B', dayHeadings: ['溫泉'] }),
      page({ url: 'c', code: 'C', result: 'no-departures', dayHeadings: ['京都'] }), { url: 'd', result: 'parser-null' },
    ];
    const after = pages.map(p => replayPage('egl', p, core));
    expect(countsOf(after)).toEqual({ pages: 4, saved: 1, noStops: 1, noDepartures: 1, noPrice: 0, notParsed: 1, failures: 2, failureRate: 0.5 });
    // A core that reads every route as no-stops: pages a and c changed (b had no route, d was never parsed).
    const nothing = { normaliseTour: (): NormaliseResult => ({ ok: false, reason: 'no-stops', unmatched: [] }), places };
    const before = pages.map(p => replayPage('egl', p, nothing));
    expect(changedRoutes(before, after).map(c => [c.code, c.before, c.after])).toEqual([
      ['A', [], ['japan-kansai-osaka']], ['C', [], ['japan-kansai-kyoto']],
    ]);
  });
});
