import zhHansNames from './names.zh-Hans.json';

// Generated offline by scripts/gen-zh-hans-names.py (OpenCC hk2s, plus a few hand-checked mainland names).
const names: Record<string, string> = zhHansNames;

/**
 * The Simplified Chinese form of a place's Traditional name (a nameZh or an alias in data.json), e.g.
 * 韓國 → 韩国, 紐西蘭 → 新西兰. A name with no entry comes back unchanged.
 */
export function zhHansName(nameZh: string): string {
  return (Object.hasOwn(names, nameZh) && names[nameZh]) || nameZh;
}
