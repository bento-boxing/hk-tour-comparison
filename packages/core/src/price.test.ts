import { it, expect } from 'vitest';
import { comparePrice, SNAPSHOT_KEEP_NIGHTS } from './index';

const today = '2026-11-12';
const s = (date: string, priceHkd: number) => ({ date, priceHkd });

it('lower than 7 days ago', () => {
  expect(comparePrice(7999, [s('2026-11-05', 8499), s('2026-11-11', 7999)], today))
    .toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' });
});
it('higher than 7 days ago', () => {
  expect(comparePrice(9880, [s('2026-11-05', 9580)], today))
    .toEqual({ kind: 'higher', diffHkd: 300, sinceDate: '2026-11-05' });
});
it('same', () => {
  expect(comparePrice(8499, [s('2026-11-05', 8499)], today)).toEqual({ kind: 'same', sinceDate: '2026-11-05' });
});
it('falls back to the oldest snapshot inside the week for a newer tour', () => {
  expect(comparePrice(5000, [s('2026-11-10', 5200), s('2026-11-09', 5400), s('2026-11-11', 5100)], today))
    .toEqual({ kind: 'lower', diffHkd: 400, sinceDate: '2026-11-09' });
});
it('ignores today, future and too-old snapshots', () => {
  expect(comparePrice(5000, [s('2026-11-12', 4000), s('2026-11-13', 4000), s('2026-11-04', 4000)], today)).toBeNull();
});
it('null with no snapshots', () => { expect(comparePrice(5000, [], today)).toBeNull(); });
it('does not depend on snapshot order', () => {
  expect(comparePrice(5000, [s('2026-11-11', 5100), s('2026-11-05', 6000)], today)!.sinceDate).toBe('2026-11-05');
});

it('ignores snapshots whose date is not a real YYYY-MM-DD date', () => {
  const junk = [s('2026-02-30', 4000), s('not-a-date', 4000), s('2026-11-5', 4000), s('', 4000)];
  expect(comparePrice(5000, junk, today)).toBeNull();
  expect(comparePrice(5000, [...junk, s('2026-11-08', 5300)], today))
    .toEqual({ kind: 'lower', diffHkd: 300, sinceDate: '2026-11-08' });
});
it('uses yesterday when it is the only snapshot in the week', () => {
  expect(comparePrice(5000, [s('2026-11-11', 4800)], today))
    .toEqual({ kind: 'higher', diffHkd: 200, sinceDate: '2026-11-11' });
});
it('works across a month and year boundary', () => {
  expect(comparePrice(5000, [s('2026-12-26', 5500), s('2026-12-25', 9999)], '2027-01-02'))
    .toEqual({ kind: 'lower', diffHkd: 500, sinceDate: '2026-12-26' });
});
it('keeps enough nights of snapshots to cover the week', () => {
  expect(SNAPSHOT_KEEP_NIGHTS).toBe(8);
});
