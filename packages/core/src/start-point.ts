import type { TourPoint } from './types';
import { normaliseName, places } from './places/index';
import type { PlacesIndex } from './places/index';

/** "Join locally": the tour starts at the destination, whatever else the text names. */
const JOIN_LOCALLY = '當地';
const HK_KEYWORDS = ['香港', '赤鱲角', '西九龍', '紅磡', '啟德', '中港城', '港澳碼頭'];
const SZ_KEYWORDS = ['深圳', '福田', '羅湖', '蛇口', '寶安', '深圳灣', '皇崗', '蓮塘'];
/** A bare airport, with no other city named, is Hong Kong's (the operators are Hong Kong agencies). */
const AIRPORT = '機場';
const HOME_CITY_IDS = new Set(['hongkong-hongkong-hongkong', 'china-guangdong-shenzhen']);
const MAX_LABEL_LENGTH = 12;

const other = (text: string): TourPoint =>
  ({ kind: 'other', label: [...text].slice(0, MAX_LABEL_LENGTH).join('') });

/** True when the text names any city (nameZh or alias of 2+ characters) other than Hong Kong and Shenzhen. */
function namesAwayCity(text: string, index: PlacesIndex): boolean {
  const key = normaliseName(text);
  return index.data.cities.some(city =>
    !HOME_CITY_IDS.has(city.id) &&
    [city.nameZh, ...city.aliases].some(name => {
      const cityKey = normaliseName(name);
      return [...cityKey].length >= 2 && key.includes(cityKey);
    }));
}

/** Classifies a tour's stated start or end point; no stated point means Hong Kong. */
export function normaliseStartPoint(raw: string | null, index: PlacesIndex = places): TourPoint {
  const text = raw?.trim() ?? '';
  if (text === '') return { kind: 'hk', label: null };
  if (text.includes(JOIN_LOCALLY)) return other(text);
  if (HK_KEYWORDS.some(keyword => text.includes(keyword))) return { kind: 'hk', label: null };
  if (SZ_KEYWORDS.some(keyword => text.includes(keyword))) return { kind: 'sz', label: null };
  if (namesAwayCity(text, index)) return other(text);
  if (text.includes(AIRPORT)) return { kind: 'hk', label: null };
  return other(text);
}
