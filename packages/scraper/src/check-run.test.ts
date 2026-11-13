import { it, expect } from 'vitest';
import { checkRun, MAX_FETCH_FAILURE_RATE, type RunCheckInput, type RunFailureReason } from './check-run';

it.each<[RunCheckInput, RunFailureReason[]]>([
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: 105, pagesDiscovered: 0, pagesNotFetched: 0 }, []],
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: null, pagesDiscovered: 0, pagesNotFetched: 0 }, []],   // first ever run
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null, pagesDiscovered: 0, pagesNotFetched: 0 }, ['no-tours']],
  [{ toursNormalised: 59,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100, pagesDiscovered: 0, pagesNotFetched: 0 }, ['tour-count-dropped']],
  [{ toursNormalised: 60,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100, pagesDiscovered: 0, pagesNotFetched: 0 }, []],    // exactly 60% passes
  [{ toursNormalised: 5,   tourPagesFetched: 5,   parseFailures: 0,  previousGoodCount: 19, pagesDiscovered: 0, pagesNotFetched: 0 },  []],    // too small to judge
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 21, previousGoodCount: 85, pagesDiscovered: 0, pagesNotFetched: 0 },  ['too-many-parse-failures']],
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 20, previousGoodCount: 85, pagesDiscovered: 0, pagesNotFetched: 0 },  []],    // exactly 20% passes
  [{ toursNormalised: 0,   tourPagesFetched: 100, parseFailures: 100, previousGoodCount: 90, pagesDiscovered: 0, pagesNotFetched: 0 },
    ['no-tours', 'tour-count-dropped', 'too-many-parse-failures']],
  // A floor for runs with no history: a sitemap caught mid-rebuild must not pass a first run with a handful of tours.
  [{ toursNormalised: 5,   tourPagesFetched: 5,   parseFailures: 0,  previousGoodCount: null, minExpectedTours: 150, pagesDiscovered: 0, pagesNotFetched: 0 }, ['below-minimum']],
  [{ toursNormalised: 150, tourPagesFetched: 160, parseFailures: 0,  previousGoodCount: null, minExpectedTours: 150, pagesDiscovered: 0, pagesNotFetched: 0 }, []],  // at the floor
  [{ toursNormalised: 5,   tourPagesFetched: 5,   parseFailures: 0,  previousGoodCount: null, minExpectedTours: null, pagesDiscovered: 0, pagesNotFetched: 0 }, []], // no floor set
  // with a previous good count the floor is ignored: 140 is within 60% of 200
  [{ toursNormalised: 140, tourPagesFetched: 150, parseFailures: 0,  previousGoodCount: 200, minExpectedTours: 150, pagesDiscovered: 0, pagesNotFetched: 0 }, []],
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null, minExpectedTours: 0, pagesDiscovered: 0, pagesNotFetched: 0 }, ['no-tours']], // a zero floor is no floor
  [{ toursNormalised: 0,   tourPagesFetched: 10,  parseFailures: 10, previousGoodCount: null, minExpectedTours: 40, pagesDiscovered: 0, pagesNotFetched: 0 },
    ['no-tours', 'below-minimum', 'too-many-parse-failures']],                                                    // order of reasons
  // Pages that were discovered but could not be fetched (fetchText returned null).
  [{ toursNormalised: 80,  tourPagesFetched: 80,  parseFailures: 0,  previousGoodCount: 85, pagesDiscovered: 100, pagesNotFetched: 20 }, []], // exactly 20% passes
  [{ toursNormalised: 79,  tourPagesFetched: 79,  parseFailures: 0,  previousGoodCount: 85, pagesDiscovered: 100, pagesNotFetched: 21 }, ['too-many-fetch-failures']],
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null, pagesDiscovered: 0, pagesNotFetched: 0 }, ['no-tours']], // nothing discovered: no rate
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null, pagesDiscovered: 450, pagesNotFetched: 450 },
    ['no-tours', 'too-many-fetch-failures']],                                                                      // a site refused from the start
  [{ toursNormalised: 0,   tourPagesFetched: 10,  parseFailures: 10, previousGoodCount: 100, minExpectedTours: 40, pagesDiscovered: 40, pagesNotFetched: 30 },
    ['no-tours', 'tour-count-dropped', 'too-many-parse-failures', 'too-many-fetch-failures']],                     // order of reasons
  [{ toursNormalised: 0,   tourPagesFetched: 10,  parseFailures: 10, previousGoodCount: null, minExpectedTours: 40, pagesDiscovered: 40, pagesNotFetched: 30 },
    ['no-tours', 'below-minimum', 'too-many-parse-failures', 'too-many-fetch-failures']],                          // order of reasons, first run
])('checkRun(%j) → %j', (input, reasons) => {
  expect(checkRun(input)).toEqual({ ok: reasons.length === 0, reasons });
});

it('the fetch-failure limit is 20%', () => { expect(MAX_FETCH_FAILURE_RATE).toBe(0.2); });
