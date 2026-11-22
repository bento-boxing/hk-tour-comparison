import { afterEach, describe, it, expect } from 'vitest';
import { departureDateText } from './card-text';
import { chipDay, formatCount, formatDayRange, formatPrice, formatChipDate, formatHkDay, formatLength, headlineCount } from './format';
import { makeT } from './i18n';

const tZh = makeT('zh-Hant');

it('formatPrice', () => { expect(formatPrice(7999)).toBe('HK$7,999'); expect(formatPrice(12500)).toBe('HK$12,500'); });

it.each([
  ['zh-Hant', '12/18', '2027/1/3'],
  ['zh-Hans', '12/18', '2027/1/3'],
  ['en', '18 Dec', '3 Jan 2027'],
] as const)('formatChipDate in %s: day and month, with the year only outside today\'s year', (locale, sameYear, otherYear) => {
  expect(formatChipDate('2026-12-18', '2026-11-12', makeT(locale))).toBe(sameYear);
  expect(formatChipDate('2027-01-03', '2026-11-12', makeT(locale))).toBe(otherYear);
});

it('formatLength', () => { expect(formatLength(5, 4, tZh)).toBe('5日4夜'); expect(formatLength(5, null, tZh)).toBe('5日'); });

it('chipDay: the day without its year and a short weekday; in Chinese the weekday in brackets (a bare 一 reads as a dash)', () => {
  expect(chipDay('2026-11-21', tZh)).toEqual({ day: '11/21', weekday: '(六)' });
  expect(chipDay('2026-12-28', tZh)).toEqual({ day: '12/28', weekday: '(一)' });
  expect(chipDay('2027-01-03', makeT('zh-Hans'))).toEqual({ day: '1/3', weekday: '(日)' });
  expect(chipDay('2026-12-29', makeT('zh-Hans'))).toEqual({ day: '12/29', weekday: '(二)' });
  expect(chipDay('2026-12-18', makeT('en'))).toEqual({ day: '18 Dec', weekday: 'Fri' });
});

describe('a departure\'s weekday is the Hong Kong calendar day\'s, whatever time zone the browser is in', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone;
  });
  // UTC+14 and UTC-8: a date read as a moment (new Date('2026-11-21').getDay()) is a day off in one of them.
  it.each(['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Hong_Kong', 'UTC'])('in %s', tz => {
    process.env.TZ = tz;
    // The zone really applies (Node reads TZ again when it changes).
    const offset = { 'Pacific/Kiritimati': -840, 'America/Los_Angeles': 480, 'Asia/Hong_Kong': -480, UTC: 0 }[tz];
    expect(new Date(Date.UTC(2026, 10, 21, 12)).getTimezoneOffset()).toBe(offset);
    expect(chipDay('2026-11-21', tZh).weekday).toBe('(六)');
    expect(chipDay('2026-11-22', makeT('en')).weekday).toBe('Sun');
    expect(chipDay('2027-01-01', makeT('zh-Hans')).weekday).toBe('(五)');
    expect(departureDateText('2026-11-21', tZh)).toBe('2026年11月21日（六）');
    expect(departureDateText('2026-11-22', makeT('en'))).toBe('Sun 22 Nov 2026');
  });
});

it('formatHkDay: the Hong Kong calendar day of a timestamp', () => {
  // 19:10 UTC on 11 Nov is 03:10 on 12 Nov in Hong Kong.
  expect(formatHkDay('2026-11-11T19:10:00Z', tZh)).toBe('11月12日');
  expect(formatHkDay('2026-11-11T15:59:00Z', tZh)).toBe('11月11日');
  expect(formatHkDay('2026-11-11T19:10:00Z', makeT('zh-Hans'))).toBe('11月12日');
  expect(formatHkDay('2026-11-11T19:10:00Z', makeT('en'))).toBe('12 Nov');
  expect(formatHkDay('garbage', tZh)).toBeNull();
});

it('headlineCount: a Chinese numeral up to 99 (兩 for 2), an English word up to twelve, digits beyond', () => {
  const zh = (n: number) => headlineCount(n, 'zh-Hant');
  expect([1, 2, 3, 7, 8, 9, 10, 11, 12, 19, 20, 21, 30, 45, 99].map(zh))
    .toEqual(['一', '兩', '三', '七', '八', '九', '十', '十一', '十二', '十九', '二十', '二十一', '三十', '四十五', '九十九']);
  expect(zh(100)).toBe('100');
  expect(headlineCount(2, 'zh-Hans')).toBe('两');
  expect(headlineCount(20, 'zh-Hans')).toBe('二十');
  expect([1, 7, 12, 13, 120].map(n => headlineCount(n, 'en'))).toEqual(['One', 'Seven', 'Twelve', '13', '120']);
  for (const odd of [0, -3, 2.5, NaN]) expect(zh(odd)).toBe(String(odd));
});

it('formatCount groups thousands', () => {
  expect([7, 2122, 1234567].map(formatCount)).toEqual(['7', '2,122', '1,234,567']);
});

it('formatLength in each language, HKD prices throughout', () => {
  expect(formatLength(5, 4, makeT('zh-Hans'))).toBe('5天4晚');
  expect(formatLength(1, null, makeT('en'))).toBe('1 day');
  expect(formatLength(2, 1, makeT('en'))).toBe('2 days, 1 night');
  expect(formatPrice(7999)).toBe('HK$7,999');
});

it('formatDayRange: two days without their year, the month once within one month', () => {
  expect(formatDayRange('2026-12-19', '2026-12-27', makeT('zh-Hant'))).toBe('12月19日至27日');
  expect(formatDayRange('2029-03-28', '2029-04-03', makeT('zh-Hant'))).toBe('3月28日至4月3日');
  expect(formatDayRange('2027-02-03', '2027-02-10', makeT('zh-Hans'))).toBe('2月3日至10日');
  expect(formatDayRange('2026-12-19', '2026-12-27', makeT('en'))).toBe('19 to 27 Dec');
  expect(formatDayRange('2029-03-28', '2029-04-03', makeT('en'))).toBe('28 Mar to 3 Apr');
});
