// WCAG 2 colour arithmetic for #rrggbb colours. Pure; used by the operator tag and by the theme's contrast test.

import type { CSSProperties } from 'react';

/** The two text colours an operator tag can use (theme.css --on-operator-light / --on-operator-dark; a test pins them). */
export const ON_OPERATOR = { light: '#ffffff', dark: '#1c1d1b' } as const;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(c => c / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Which of the two tag text colours reads better on an operator's #rrggbb colour. */
export function operatorTextTone(color: string): keyof typeof ON_OPERATOR {
  return contrast(ON_OPERATOR.light, color) >= contrast(ON_OPERATOR.dark, color) ? 'light' : 'dark';
}

/** Only #rrggbb reaches an inline style: anything else could carry other declarations. */
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The inline style that paints an operator's tag, dot or leg (`--c`), and whether the tag's text is dark: the
 * operator's colour when it is exactly #rrggbb (it comes from the database); otherwise, or with none, the fallback
 * grey (--op-fallback) with light text.
 */
export function operatorTagStyle(color: string | undefined): { style: CSSProperties; dark: boolean } {
  if (color === undefined || !SAFE_COLOR.test(color)) return { style: { '--c': 'var(--op-fallback)' } as CSSProperties, dark: false };
  return { style: { '--c': color } as CSSProperties, dark: operatorTextTone(color) === 'dark' };
}
