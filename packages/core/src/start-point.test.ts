import { it, expect } from 'vitest';
import { normaliseStartPoint } from './index';

it.each([
  [null, 'hk', null], ['', 'hk', null], ['香港國際機場集合', 'hk', null],
  ['香港西九龍站', 'hk', null], ['深圳灣口岸集合', 'sz', null], ['福田口岸', 'sz', null],
  ['澳門外港碼頭', 'other', '澳門外港碼頭'], ['東京成田機場當地集合', 'other', '東京成田機場當地集合'],
  ['大阪關西當地參團', 'other', '大阪關西當地參團'],
])('normaliseStartPoint(%j)', (raw, kind, label) => {
  expect(normaliseStartPoint(raw)).toEqual({ kind, label });
});

it('treats whitespace-only text as Hong Kong', () => {
  expect(normaliseStartPoint('  \t ')).toEqual({ kind: 'hk', label: null });
});
// As the rule is written, 機場 alone means hk, so a foreign airport without 當地 is classed as Hong Kong.
it('classes any 機場 text without 當地 as Hong Kong', () => {
  expect(normaliseStartPoint('新加坡樟宜國際機場集合')).toEqual({ kind: 'hk', label: null });
});
it('trims an other label and cuts it to 12 characters', () => {
  expect(normaliseStartPoint('  新加坡樟宜一號客運大樓出境大堂集合  ')).toEqual({ kind: 'other', label: '新加坡樟宜一號客運大樓出' });
});
