import { it, expect } from 'vitest';
import { places } from '@hktours/core';
import { operatorName, placeName, retiredRegion } from './place-names';

it('names a place in each language', () => {
  const korea = places.country('korea')!;
  expect(placeName(korea, 'zh-Hant')).toBe('韓國');
  expect(placeName(korea, 'zh-Hans')).toBe('韩国');
  expect(placeName(korea, 'en')).toBe('South Korea');
  const kansai = places.region('japan-kansai')!;
  expect([placeName(kansai, 'zh-Hant'), placeName(kansai, 'zh-Hans'), placeName(kansai, 'en')]).toEqual(['關西', '关西', 'Kansai']);
  const nz = places.country('new-zealand')!;
  expect(placeName(nz, 'zh-Hans')).toBe('新西兰'); // the mainland name, not 纽西兰
});

it('falls back to the Traditional name when there is no English one', () => {
  expect(placeName({ nameZh: '甲市', nameEn: '' }, 'en')).toBe('甲市');
});

it('keeps the operator\'s Chinese name, adding its English name in English only', () => {
  const egl = { nameZh: '東瀛遊', nameEn: 'EGL Tours' };
  expect(operatorName(egl, 'zh-Hant')).toBe('東瀛遊');
  expect(operatorName(egl, 'zh-Hans')).toBe('東瀛遊');
  expect(operatorName(egl, 'en')).toBe('東瀛遊 (EGL Tours)');
  expect(operatorName({ nameZh: '新華旅遊', nameEn: '' }, 'en')).toBe('新華旅遊');
  expect(operatorName({ nameZh: 'egl', nameEn: 'egl' }, 'en')).toBe('egl'); // an unknown operator: its id, once
});

it('a retired region is not in the places data, and the regions that replaced it are (task 37)', () => {
  const central = retiredRegion('china-central');
  expect(central?.name).toEqual({ 'zh-Hant': '華中', 'zh-Hans': '华中', en: 'Central China' });
  expect(places.region('china-central')).toBeUndefined();
  expect(places.findRegion('華中')).toEqual([]);
  expect(central?.replacedBy.map(id => places.region(id)?.nameZh)).toEqual(['湖北', '河南', '江西']);
  expect(retiredRegion('china-hubei')).toBeUndefined();
  expect(retiredRegion('constructor')).toBeUndefined();
});
