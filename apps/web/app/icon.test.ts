import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { markShapes } from '../components/Mark';

// Next.js serves app/icon.svg as the site icon (<link rel="icon" type="image/svg+xml">).
const iconPath = join(__dirname, 'icon.svg');
const themeCss = readFileSync(join(__dirname, '..', 'lib', 'theme.css'), 'utf8');

function token(name: string): string {
  const match = themeCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!match) throw new Error(`--${name} not found as a 6-digit hex colour in theme.css`);
  return match[1].toLowerCase();
}

function icon(): Document {
  return new DOMParser().parseFromString(readFileSync(iconPath, 'utf8'), 'image/svg+xml');
}

it('the site icon is app/icon.svg, with no other favicon file to shadow it', () => {
  expect(existsSync(iconPath)).toBe(true);
  expect(existsSync(join(__dirname, 'favicon.ico'))).toBe(false);
  expect(existsSync(join(__dirname, '..', 'public', 'favicon.ico'))).toBe(false);
  expect(icon().querySelector('parsererror')).toBeNull();
});

it('is the mark in ink with its gold next leg, on a page-coloured rounded square', () => {
  const svg = icon().documentElement;
  expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
  const bg = svg.querySelector('rect')!;
  expect([bg.getAttribute('width'), bg.getAttribute('height'), bg.getAttribute('rx')]).toEqual(['48', '48', '9']);
  expect(bg.getAttribute('fill')?.toLowerCase()).toBe(token('page'));

  const dot = svg.querySelector('circle')!;
  expect([dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')].map(Number))
    .toEqual([markShapes.dot.cx, markShapes.dot.cy, markShapes.dot.r]);
  expect(dot.getAttribute('fill')?.toLowerCase()).toBe(token('ink'));

  const paths = [...svg.querySelectorAll('path')];
  expect(paths.map(p => p.getAttribute('d'))).toEqual([...markShapes.route, markShapes.next]);
  expect(paths.map(p => p.getAttribute('stroke')?.toLowerCase()))
    .toEqual([token('ink'), token('ink'), token('gold')]);
  for (const p of paths) {
    expect(p.getAttribute('fill')).toBe('none');
    expect(Number(p.getAttribute('stroke-width'))).toBe(markShapes.strokeWidth);
    expect(p.getAttribute('stroke-linecap')).toBe('round');
    expect(p.getAttribute('stroke-linejoin')).toBe('round');
  }
});

it('fits the mark inside the square with padding', () => {
  const g = icon().querySelector('g')!;
  const m = g.getAttribute('transform')!.match(/^translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)$/);
  expect(m).not.toBeNull();
  const [tx, ty, s] = m!.slice(1).map(Number);
  // The mark's ink, round caps included, spans about 3.8–46.4 of its 48 box; keep at least 5 of 48 clear each side.
  const half = markShapes.strokeWidth / 2;
  for (const [t, lo, hi] of [[tx, 6 - half, 44 + half], [ty, markShapes.dot.cy - markShapes.dot.r, 44.4 + half]]) {
    expect(t + s * lo).toBeGreaterThanOrEqual(5);
    expect(t + s * hi).toBeLessThanOrEqual(43);
  }
});

it('uses only the theme\'s colours', () => {
  const hexes = readFileSync(iconPath, 'utf8').match(/#[0-9a-f]{3,8}\b/gi)!.map(h => h.toLowerCase());
  expect(new Set(hexes)).toEqual(new Set([token('page'), token('ink'), token('gold')]));
});

// app/apple-icon.png is icon.svg without the corner radius (iOS rounds it), rasterised with
// ImageMagick: `sed 's/ rx="9"//' app/icon.svg > apple.svg &&
// convert -background none -density 1200 apple.svg -resize 180x180 -strip PNG24:app/apple-icon.png`
// (Where ImageMagick has no SVG renderer: a headless Firefox screenshot of apple.svg in a 180 × 180 window, then
// `convert shot.png -alpha off -strip PNG24:app/apple-icon.png`; that is how the ink and gold were applied.)
it('has an opaque 180 × 180 PNG apple touch icon', () => {
  const png = readFileSync(join(__dirname, 'apple-icon.png'));
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(png.toString('latin1', 12, 16)).toBe('IHDR');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  expect(png[25]).toBe(2); // colour type 2: RGB, no alpha channel
});

/** The pixels of an 8-bit RGB, non-interlaced PNG, as '#rrggbb' strings row by row (node's zlib; no PNG library). */
function pngPixels(png: Buffer): { width: number; height: number; at: (x: number, y: number) => string } {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect([png[24], png[25], png[28]]).toEqual([8, 2, 0]); // 8 bits, RGB, not interlaced
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 3 ? out[y * stride + i - 3] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= 3 && y > 0 ? out[(y - 1) * stride + i - 3] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      out[y * stride + i] = (x + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff;
    }
  }
  const hexAt = (x: number, y: number) => `#${[0, 1, 2].map(k => out[y * stride + x * 3 + k].toString(16).padStart(2, '0')).join('')}`;
  return { width, height, at: hexAt };
}

it('the apple touch icon is drawn in the same colours: the page colour, the ink route and the gold next leg', () => {
  const { width, height, at } = pngPixels(readFileSync(join(__dirname, 'apple-icon.png')));
  const counts = new Map<string, number>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) counts.set(at(x, y), (counts.get(at(x, y)) ?? 0) + 1);
  // Edge pixels are blends; the solid colours are the three of the icon.
  expect(at(0, 0)).toBe(token('page'));
  expect(counts.get(token('ink')) ?? 0).toBeGreaterThan(500);
  expect(counts.get(token('gold')) ?? 0).toBeGreaterThan(200);
});
