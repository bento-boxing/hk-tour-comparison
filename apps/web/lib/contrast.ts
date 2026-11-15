// WCAG 2 colour arithmetic for #rrggbb colours. Pure; used by the operator tag and by the theme's contrast test.

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

/** `fg` drawn at `opacity` over `bg`, as the browser composites it: a #rrggbb colour. */
export function blend(fg: string, bg: string, opacity: number): string {
  const [f, b] = [channels(fg), channels(bg)];
  return `#${f.map((c, i) => Math.round(c * opacity + b[i] * (1 - opacity)).toString(16).padStart(2, '0')).join('')}`;
}

/** Which of the two tag text colours reads better on an operator's #rrggbb colour. */
export function operatorTextTone(color: string): keyof typeof ON_OPERATOR {
  return contrast(ON_OPERATOR.light, color) >= contrast(ON_OPERATOR.dark, color) ? 'light' : 'dark';
}
