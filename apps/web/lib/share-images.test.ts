import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, makeT } from './i18n';
import { SHARE_IMAGES, shareImage } from './share-images';
import { pageMetadata } from './site-metadata';

// The sharing images are committed files (public/share/), made by scripts/make-share-images.mjs. These tests check
// that the files, lib/share-images.json and the dictionaries agree, so a changed line or a hand-edited picture is
// caught before it ships.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

it.each(LOCALES)('in %s: the picture is a 1200×630 PNG under 300 KB, exactly the file the JSON names, showing the dictionary\'s line', locale => {
  const image = SHARE_IMAGES[locale];
  expect(image.file).toMatch(new RegExp(`^share/${locale}-[0-9a-f]{8}\\.png$`));
  const png = readFileSync(join(WEB, 'public', image.file));
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(png.subarray(12, 16).toString('latin1')).toBe('IHDR');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect([image.width, image.height]).toEqual([1200, 630]);
  expect(png.length).toBe(image.bytes);
  expect(png.length).toBeLessThan(300 * 1024);
  const sha256 = createHash('sha256').update(png).digest('hex');
  expect(sha256).toBe(image.sha256);
  expect(image.file).toContain(sha256.slice(0, 8));
  // Made from the line the dictionary has now: change share.line, then run the script again.
  expect(image.line).toBe(makeT(locale)('share.line'));
});

it('public/share/ holds the three pictures and nothing else', () => {
  expect(readdirSync(join(WEB, 'public/share')).sort()).toEqual(LOCALES.map(l => SHARE_IMAGES[l].file.slice('share/'.length)).sort());
});

it.each(LOCALES)('in %s every page\'s metadata carries its language\'s picture with its size, type and alt text, and the large card for X', locale => {
  const t = makeT(locale);
  for (const path of ['/', '/tours', '/tours/japan', '/operators', '/operators/egl', '/about', '/chain', '/saved'] as const) {
    const meta = pageMetadata(t, path, { title: 'x', noindex: path === '/saved' });
    expect(meta.openGraph?.images).toEqual([{ url: `/${SHARE_IMAGES[locale].file}`, width: 1200, height: 630, type: 'image/png', alt: t('share.imageAlt') }]);
    expect(meta.twitter).toEqual({ card: 'summary_large_image' });
  }
  // Its address has no query string: robots.txt keeps crawlers (Twitterbot among them) off any address with one.
  expect(shareImage(t).url).not.toContain('?');
});

it('every page\'s metadata goes through pageMetadata, so every page type has the picture', () => {
  const dir = join(WEB, 'app/_site');
  const pages = readdirSync(dir).filter(f => /-page\.tsx$/.test(f) && !f.startsWith('error') && !f.startsWith('not-found'));
  expect(pages.length).toBeGreaterThanOrEqual(8);
  for (const file of pages) {
    const source = readFileSync(join(dir, file), 'utf8');
    const metadataFunctions = [...source.matchAll(/export (?:async )?function (\w+Metadata)\(/g)].map(m => m[1]);
    expect(metadataFunctions.length, file).toBeGreaterThan(0);
    // Each one returns pageMetadata(…) and nothing built by hand.
    expect(source.match(/return \{\s*(title|openGraph|alternates)/), file).toBeNull();
    expect(source, file).toContain('pageMetadata(');
  }
});
