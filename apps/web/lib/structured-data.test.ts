import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { makeT } from './i18n';
import { breadcrumbJsonLd, jsonLdText, websiteJsonLd } from './structured-data';
import { JsonLd } from '../components/JsonLd';

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

it.each([
  ['zh-Hant', 'https://example.invalid', 'zh-Hant-HK', '香港旅行團比較'],
  ['zh-Hans', 'https://example.invalid/zh-hans', 'zh-Hans', '跟边团'],
  ['en', 'https://example.invalid/en', 'en', 'Gan Bin Tuen'],
] as const)('in %s the site is a WebSite: its name, an alternate name in the language, its home page there, the language', (locale, url, inLanguage, alternateName) => {
  expect(websiteJsonLd(makeT(locale))).toEqual({
    '@context': 'https://schema.org', '@type': 'WebSite', name: '跟邊團', alternateName, url, inLanguage,
  });
});

it('a breadcrumb trail starts at the home page in the language, numbers its steps from 1 and gives each its absolute address', () => {
  expect(breadcrumbJsonLd(makeT('en'), [{ name: 'Tour destinations', path: '/tours' }, { name: 'Group tours to Japan', path: '/tours/japan' }])).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '跟邊團', item: 'https://example.invalid/en' },
      { '@type': 'ListItem', position: 2, name: 'Tour destinations', item: 'https://example.invalid/en/tours' },
      { '@type': 'ListItem', position: 3, name: 'Group tours to Japan', item: 'https://example.invalid/en/tours/japan' },
    ],
  });
  expect(breadcrumbJsonLd(makeT('zh-Hant'), []).itemListElement).toEqual([{ '@type': 'ListItem', position: 1, name: '跟邊團', item: 'https://example.invalid' }]);
});

it('a hostile place name cannot close the script tag or open another: < > & and the line separators are \\u escapes, and the JSON reads back the same', () => {
  const hostile = `大阪</script><script>alert(1)</script><!--&amp;${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}"\\`;
  const data = breadcrumbJsonLd(makeT('zh-Hant'), [{ name: hostile, path: '/tours/japan' }]);
  const text = jsonLdText(data);
  expect(text).not.toMatch(/[<>&]/);
  expect(text).not.toContain(LINE_SEPARATOR);
  expect(text).not.toContain(PARAGRAPH_SEPARATOR);
  expect(text).toContain('\\u003c/script\\u003e');
  expect(JSON.parse(text)).toEqual(data);
  // As rendered: one script element, whose text is that JSON; nothing after it became markup.
  const html = renderToStaticMarkup(createElement('div', null, createElement(JsonLd, { data })));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = doc.querySelectorAll('script');
  expect(scripts).toHaveLength(1);
  expect(scripts[0].getAttribute('type')).toBe('application/ld+json');
  expect(JSON.parse(scripts[0].textContent!)).toEqual(data);
  expect(doc.body.firstElementChild!.childElementCount).toBe(1);
});

it('the structured data is built from data and dictionaries only: no page reads the request for it, and no type the site must not claim', () => {
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(join(web, 'lib/structured-data.ts'), 'utf8');
  expect(source).not.toMatch(/next\/headers|cookies\(|headers\(|searchParams/);
  // The types it may give: the site, and breadcrumb trails. (Its comment names the others it leaves out.)
  const types = [...source.matchAll(/'@type': '(\w+)'/g)].map(m => m[1]);
  expect(new Set(types)).toEqual(new Set(['WebSite', 'BreadcrumbList', 'ListItem']));
  // Every block on a page goes through components/JsonLd.tsx (the escaping): no other ld+json script anywhere.
  const files = (dir: string): string[] => readdirSync(join(web, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (['node_modules', '.next'].includes(e.name) ? [] : files(join(dir, e.name))) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
  const holders = [...files('app'), ...files('components'), ...files('lib')].filter(f => readFileSync(join(web, f), 'utf8').includes('application/ld+json'));
  expect(holders).toEqual(['components/JsonLd.tsx']);
});
