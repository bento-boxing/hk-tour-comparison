import { expect, it } from 'vitest';
import { groupBy } from './group-by';
import { isOperatorId, OPERATOR_IDS } from './types';

it('groupBy keeps the keys in the order first seen and each group in item order', () => {
  const rows = [{ id: 'b', n: 1 }, { id: 'a', n: 2 }, { id: 'b', n: 3 }];
  const groups = groupBy(rows, row => row.id);
  expect([...groups.keys()]).toEqual(['b', 'a']);
  expect(groups.get('b')).toEqual([rows[0], rows[2]]);
  expect(groupBy(rows, row => row.id, row => row.n)).toEqual(new Map([['b', [1, 3]], ['a', [2]]]));
  expect(groupBy([], () => 'x').size).toBe(0);
});

it('isOperatorId is true for each approved operator id only', () => {
  for (const id of OPERATOR_IDS) expect(isOperatorId(id)).toBe(true);
  for (const id of ['', 'EGL', 'egl ', 'other']) expect(isOperatorId(id)).toBe(false);
});
