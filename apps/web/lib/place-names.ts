import { zhHansName } from '@hktours/core';
import type { Locale } from './i18n';

/** Anything from the places data: a country, region or city. */
export interface Named { nameZh: string; nameEn: string }

/**
 * A place's name in the visitor's language: Traditional as written, Simplified from the generated map in
 * @hktours/core, English from `nameEn` (Traditional when it has none).
 */
export function placeName(place: Named, locale: Locale): string {
  if (locale === 'en') return place.nameEn || place.nameZh;
  if (locale === 'zh-Hans') return zhHansName(place.nameZh);
  return place.nameZh;
}

/**
 * An operator's name: its Chinese name in every language, with its English company name beside it in
 * English when it has one ('東瀛遊 (EGL Tours)').
 */
export function operatorName(operator: Named, locale: Locale): string {
  const english = operator.nameEn.trim();
  return locale === 'en' && english !== '' && english !== operator.nameZh ? `${operator.nameZh} (${english})` : operator.nameZh;
}
