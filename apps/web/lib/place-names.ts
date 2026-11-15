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

export interface RetiredRegion { name: Readonly<Record<Locale, string>>; replacedBy: readonly string[] }

/**
 * Regions taken out of the places data whose ids saved tour stops can still carry: the name each had, for display
 * only (it is not in data.json, so no operator text is ever matched to it), and the regions that replaced it.
 * - `china-central` 華中: split into 湖北, 河南 and 江西 on 2026-11-15 (task 37). A good nightly run rewrites the stops of
 *   the operator's tours, so this entry can be deleted once every operator has had a good run on that code.
 * - `china-northeast` 東北三省 and `china-northwest` 西北: split into their provinces on 2026-11-15 (task 40), as the
 *   other grouped regions were, whose ids 北京, 上海 and 四川 kept (so they are not retired). Deletable the same way.
 */
const RETIRED_REGIONS: Readonly<Record<string, RetiredRegion>> = {
  'china-central': {
    name: { 'zh-Hant': '華中', 'zh-Hans': '华中', en: 'Central China' },
    replacedBy: ['china-hubei', 'china-henan', 'china-jiangxi'],
  },
  'china-northeast': {
    name: { 'zh-Hant': '東北三省', 'zh-Hans': '东北三省', en: 'Northeast China' },
    replacedBy: ['china-heilongjiang', 'china-jilin', 'china-liaoning', 'china-area-northeast'],
  },
  'china-northwest': {
    name: { 'zh-Hant': '西北', 'zh-Hans': '西北', en: 'Northwest China' },
    replacedBy: ['china-shaanxi', 'china-gansu', 'china-qinghai', 'china-ningxia'],
  },
};

/** The retired region with this id, or undefined (also for every region still in the places data). */
export function retiredRegion(regionId: string): RetiredRegion | undefined {
  return Object.hasOwn(RETIRED_REGIONS, regionId) ? RETIRED_REGIONS[regionId] : undefined;
}

/**
 * An operator's name: its Chinese name in every language, with its English company name beside it in
 * English when it has one ('東瀛遊 (EGL Tours)').
 */
export function operatorName(operator: Named, locale: Locale): string {
  const english = operator.nameEn.trim();
  return locale === 'en' && english !== '' && english !== operator.nameZh ? `${operator.nameZh} (${english})` : operator.nameZh;
}
