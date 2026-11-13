import type { IsoDate } from '@hktours/core';
import type { T } from './i18n';

/** 7999 → 'HK$7,999'. */
export function formatPrice(hkd: number): string {
  return `HK$${hkd.toLocaleString('en-US')}`;
}

function dateParts(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** Same year as today → '12/18'; another year → '2027/1/3'. */
export function formatChipDate(date: IsoDate, today: IsoDate): string {
  const { year, month, day } = dateParts(date);
  return year === dateParts(today).year ? `${month}/${day}` : `${year}/${month}/${day}`;
}

/** '5日4夜', or '5日' when the number of nights is unknown. */
export function formatLength(days: number, nights: number | null, t: T): string {
  return nights === null ? t('length.days', { days }) : t('length.daysNights', { days, nights });
}

const hongKongDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** '更新：今日 03:10' when the timestamp falls on today in Hong Kong, else '更新：11月11日 03:10'. */
export function formatUpdated(iso: string, today: IsoDate, t: T): string {
  const parts = hongKongDateTime.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const time = `${part('hour')}:${part('minute')}`;
  if (`${part('year')}-${part('month')}-${part('day')}` === today) return t('updated.today', { time });
  return t('updated.on', { month: Number(part('month')), day: Number(part('day')), time });
}
