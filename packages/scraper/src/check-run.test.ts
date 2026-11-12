import { it, expect } from 'vitest';
import { checkRun, type RunCheckInput, type RunFailureReason } from './check-run';

it.each<[RunCheckInput, RunFailureReason[]]>([
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: 105 }, []],
  [{ toursNormalised: 100, tourPagesFetched: 110, parseFailures: 5,  previousGoodCount: null }, []],   // first ever run
  [{ toursNormalised: 0,   tourPagesFetched: 0,   parseFailures: 0,  previousGoodCount: null }, ['no-tours']],
  [{ toursNormalised: 59,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100 }, ['tour-count-dropped']],
  [{ toursNormalised: 60,  tourPagesFetched: 60,  parseFailures: 0,  previousGoodCount: 100 }, []],    // exactly 60% passes
  [{ toursNormalised: 5,   tourPagesFetched: 5,   parseFailures: 0,  previousGoodCount: 19 },  []],    // too small to judge
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 21, previousGoodCount: 85 },  ['too-many-parse-failures']],
  [{ toursNormalised: 80,  tourPagesFetched: 100, parseFailures: 20, previousGoodCount: 85 },  []],    // exactly 20% passes
  [{ toursNormalised: 0,   tourPagesFetched: 100, parseFailures: 100, previousGoodCount: 90 },
    ['no-tours', 'tour-count-dropped', 'too-many-parse-failures']],
])('checkRun(%j) → %j', (input, reasons) => {
  expect(checkRun(input)).toEqual({ ok: reasons.length === 0, reasons });
});
