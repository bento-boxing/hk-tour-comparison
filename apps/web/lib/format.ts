import type { IsoDate } from '@hktours/core';
import type { DictKey, Locale, T } from './i18n';

/** 7999 → 'HK$7,999'. */
export function formatPrice(hkd: number): string {
  return `HK$${hkd.toLocaleString('en-US')}`;
}

function dateParts(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/**
 * A short date: Chinese '12/18', or '2027/1/3' outside today's year; English '18 Dec' / '3 Jan 2027' (day first,
 * month by name, so a Hong Kong or British reader never reads 3/1 the wrong way round).
 */
export function formatChipDate(date: IsoDate, today: IsoDate, t: T): string {
  const { year, month, day } = dateParts(date);
  const sameYear = year === dateParts(today).year;
  if (t.locale === 'en') return sameYear ? `${day} ${monthName(month, t)}` : `${day} ${monthName(month, t)} ${year}`;
  return sameYear ? `${month}/${day}` : `${year}/${month}/${day}`;
}

/** '5日4夜', or '5日' when the number of nights is unknown. */
export function formatLength(days: number, nights: number | null, t: T): string {
  return nights === null ? t('length.days', { days }) : t('length.daysNights', { days, nights });
}

const hongKongDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const MONTH_KEYS = [
  'date.month.1', 'date.month.2', 'date.month.3', 'date.month.4', 'date.month.5', 'date.month.6',
  'date.month.7', 'date.month.8', 'date.month.9', 'date.month.10', 'date.month.11', 'date.month.12',
] as const satisfies readonly DictKey[];

/** '11月' (en: 'Nov') for 11. */
export function monthName(month: number, t: T): string {
  return t(MONTH_KEYS[month - 1]);
}

/** The weekdays' dictionary keys, Sunday first (Date.getUTCDay order). */
export const WEEKDAY_KEYS = [
  'date.weekday.0', 'date.weekday.1', 'date.weekday.2', 'date.weekday.3', 'date.weekday.4', 'date.weekday.5', 'date.weekday.6',
] as const satisfies readonly DictKey[];

/**
 * A departure as a row's date chip writes it: the day ('12/18'; English '18 Dec') and its weekday as the chip shows it
 * ('(五)'; 'Fri'), with no year. The chips sit in date order on a row of this season, so the year is left out; the
 * chip's accessible name gives the full date (lib/card-text.ts departureDateText).
 * The weekday is the calendar date's own (worked out in UTC from the date's digits), so it is Hong Kong's weekday
 * whatever time zone the browser is in.
 */
export function chipDay(date: IsoDate, t: T): { day: string; weekday: string } {
  const { year, month, day } = dateParts(date);
  const weekday = t('date.chipWeekday', { weekday: t(WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]) });
  return { day: t.locale === 'en' ? `${day} ${monthName(month, t)}` : `${month}/${day}`, weekday };
}

/** The Hong Kong calendar day of a timestamp: '11月19日' (en: '19 Nov'). Null for a timestamp that is not one. */
export function formatHkDay(iso: string, t: T): string | null {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return null;
  const parts = hongKongDateTime.formatToParts(time);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  return t('date.monthDay', { monthName: monthName(part('month'), t), day: part('day') });
}

/**
 * Two calendar days without their year, as a range: '12月19日至27日' within one month, '3月28日至4月3日' across two
 * (en: '19 to 27 Dec', '28 Mar to 3 Apr'). The days as date.monthDay writes them.
 */
export function formatDayRange(from: IsoDate, to: IsoDate, t: T): string {
  const a = dateParts(from);
  const b = dateParts(to);
  if (a.year === b.year && a.month === b.month) return t('date.rangeSameMonth', { monthName: monthName(a.month, t), from: a.day, to: b.day });
  const day = (d: { month: number; day: number }) => t('date.monthDay', { monthName: monthName(d.month, t), day: d.day });
  return t('date.range', { from: day(a), to: day(b) });
}

const CHINESE_DIGITS =['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const ENGLISH_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/**
 * A count at the start of the home page's headline, written as a reader expects it there: a Chinese numeral from 1
 * to 99 ('七', '十二', '二十', '九十九'; 2 is '兩' / '两', as in 兩間旅行社), and digits from 100; in English a word
 * up to twelve ('Seven', capitalised: it starts the sentence), and digits from 13. Zero and anything that is not a
 * whole number are digits.
 */
export function headlineCount(n: number, locale: Locale): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  if (locale === 'en') return n < ENGLISH_WORDS.length ? ENGLISH_WORDS[n] : String(n);
  if (n >= 100) return String(n);
  if (n === 2) return locale === 'zh-Hant' ? '兩' : '两';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tensText = tens === 0 ? '' : tens === 1 ? '十' : `${CHINESE_DIGITS[tens]}十`;
  return `${tensText}${ones === 0 ? '' : CHINESE_DIGITS[ones]}`;
}

/** 2122 → '2,122': a count in running text, grouped by thousands in every language. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
