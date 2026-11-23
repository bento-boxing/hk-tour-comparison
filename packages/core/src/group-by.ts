/**
 * The items by `key`, keys in the order first seen and each group in item order; `map` gives what each group keeps of an
 * item (unset: the item itself). Used by the places index and the database's search.
 */
export function groupBy<T, V = T>(items: readonly T[], key: (item: T) => string, map?: (item: T) => V): Map<string, V[]> {
  const groups = new Map<string, V[]>();
  for (const item of items) {
    const k = key(item);
    const value = map === undefined ? (item as unknown as V) : map(item);
    const group = groups.get(k);
    if (group) group.push(value);
    else groups.set(k, [value]);
  }
  return groups;
}
