import { expect, it } from 'vitest';
import { EITHER_OR, withoutEitherOr } from './patterns';

it('EITHER_OR matches two or more places split by a slash of either width', () => {
  expect(['大阪/東京', '杭州／上海', '無錫/南京/上海'].map(text => EITHER_OR.test(text))).toEqual([true, true, true]);
  expect(['大阪', '/東京', '大阪/', '大阪//東京'].map(text => EITHER_OR.test(text))).toEqual([false, false, false, false]);
});

it('withoutEitherOr removes the stop at the index only when it is an either/or leg', () => {
  expect(withoutEitherOr(['大阪/東京', '京都'], 0)).toEqual(['京都']);
  expect(withoutEitherOr(['大阪', '京都'], 0)).toEqual(['大阪', '京都']);
  expect(withoutEitherOr(['大阪/東京'], -1)).toEqual(['大阪/東京']);
  expect(withoutEitherOr(['大阪/東京'], 3)).toEqual(['大阪/東京']);
});
