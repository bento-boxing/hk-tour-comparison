import { it, expect } from 'vitest';
import { normaliseStartPoint, buildPlacesIndex } from './index';

it.each([
  [null, 'hk', null], ['', 'hk', null], ['香港國際機場集合', 'hk', null],
  ['香港西九龍站', 'hk', null], ['深圳灣口岸集合', 'sz', null], ['福田口岸', 'sz', null],
  ['澳門外港碼頭', 'other', '澳門外港碼頭'], ['東京成田機場當地集合', 'other', '東京成田機場當地集合'],
  ['大阪關西當地參團', 'other', '大阪關西當地參團'],
  // A named non-HK, non-SZ city beats bare 機場; bare 機場 alone means Hong Kong airport.
  ['新加坡樟宜國際機場集合', 'other', '新加坡樟宜國際機場集合'], // 11 characters, so the 12-character cut keeps it whole
  ['東京成田機場集合', 'other', '東京成田機場集合'], ['機場一號客運大樓集合', 'hk', null],
  ['深圳寶安國際機場', 'sz', null], ['澳門國際機場', 'other', '澳門國際機場'],
  ['香港機場', 'hk', null], ['珠海九洲港', 'other', '珠海九洲港'],
])('normaliseStartPoint(%j)', (raw, kind, label) => {
  expect(normaliseStartPoint(raw)).toEqual({ kind, label });
});

it('treats whitespace-only text as Hong Kong', () => {
  expect(normaliseStartPoint('  \t ')).toEqual({ kind: 'hk', label: null });
});
it('looks city names up in the index it is given', () => {
  const empty = buildPlacesIndex({ countries: [], regions: [], cities: [] });
  expect(normaliseStartPoint('東京成田機場集合', empty)).toEqual({ kind: 'hk', label: null });
});
it('trims an other label and cuts it to 12 characters', () => {
  expect(normaliseStartPoint('  新加坡樟宜一號客運大樓出境大堂集合  ')).toEqual({ kind: 'other', label: '新加坡樟宜一號客運大樓出' });
});
