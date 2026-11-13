import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Not new URL(…, import.meta.url): under jsdom, URL is jsdom's and rejects the file scheme.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!match) throw new Error(`--${name} not found as a 6-digit hex colour in theme.css`);
  return match[1];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

it('muted text meets WCAG AA (4.5:1) on white and on the highlighted row', () => {
  expect(contrast(token('text-muted'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token('text-muted'), token('hit'))).toBeGreaterThanOrEqual(4.5);
});
