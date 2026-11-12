import type { TourPoint } from './types';

/** "Join locally": the tour starts at the destination, whatever else the text names. */
const JOIN_LOCALLY = '當地';
const HK_KEYWORDS = ['香港', '機場', '赤鱲角', '西九龍', '紅磡', '啟德', '中港城', '港澳碼頭'];
const SZ_KEYWORDS = ['深圳', '福田', '羅湖', '蛇口', '寶安', '深圳灣', '皇崗', '蓮塘'];
const MAX_LABEL_LENGTH = 12;

const other = (text: string): TourPoint =>
  ({ kind: 'other', label: [...text].slice(0, MAX_LABEL_LENGTH).join('') });

/** Classifies a tour's stated start or end point; no stated point means Hong Kong. */
export function normaliseStartPoint(raw: string | null): TourPoint {
  const text = raw?.trim() ?? '';
  if (text === '') return { kind: 'hk', label: null };
  if (text.includes(JOIN_LOCALLY)) return other(text);
  if (HK_KEYWORDS.some(keyword => text.includes(keyword))) return { kind: 'hk', label: null };
  if (SZ_KEYWORDS.some(keyword => text.includes(keyword))) return { kind: 'sz', label: null };
  return other(text);
}
