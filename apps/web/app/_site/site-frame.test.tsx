import { it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { useT } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import { THEME_SCRIPT } from '../../lib/theme';
import { makeT } from '../../lib/i18n';
import { shareImage } from '../../lib/share-images';
import { SiteFrame, siteFrameMetadata } from './site-frame';
import styles from './site-frame.module.css';

// Nothing in the frame reads the request: a call to cookies() or headers() fails the test. (Before, an old language
// cookie and then the theme cookie were read here; both must be ignored now.)
vi.mock('next/headers', () => ({
  cookies: () => { throw new Error('the frame read the cookies'); },
  headers: () => { throw new Error('the frame read the headers'); },
}));
const address = vi.hoisted(() => ({ pathname: '/', search: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => address.pathname, useSearchParams: () => new URLSearchParams(address.search) }));

beforeEach(() => { address.pathname = '/'; address.search = ''; });

/** A client component inside the layout: it sees the provider's locale. */
function ClientText() {
  return <p data-testid="client">{useT()('nav.search')}</p>;
}

async function renderLayout(locale: Locale = 'zh-Hant'): Promise<string> {
  return renderToStaticMarkup(SiteFrame({ locale, children: <ClientText /> }));
}

it.each([
  ['zh-Hant', 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'],
  ['zh-Hans', 'zh-Hans', '搜索旅行团', '本网站与各旅行社没有任何关联。'],
  ['en', 'en', 'Find tours', 'This site is not affiliated with any tour operator.'],
] as const)('%s: <html lang="%s">, and the server text and client text share the language', async (locale, lang, clientText, disclaimer) => {
  const html = await renderLayout(locale);
  expect(html).toMatch(new RegExp(`^<html lang="${lang}"`));
  expect(html).toContain(`<p data-testid="client">${clientText}</p>`); // client: the provider
  expect(html).toContain(disclaimer); // server: the footer
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('%s: the address alone decides the language (no cookie is read)', async locale => {
  const html = await renderLayout(locale);
  expect(html).toMatch(new RegExp(`^<html lang="${{ 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en' }[locale]}"`));
});

/** The header's links in the served page, but the language switch's (which go to the other languages on purpose). */
const headerLinks = (html: string) => [...new DOMParser().parseFromString(html, 'text/html').querySelector('nav')!.querySelectorAll('a:not([hreflang])')];

it.each([
  ['zh-Hant', '/', ['/', '/', '/chain', '/saved']],
  ['zh-Hans', '/zh-hans', ['/zh-hans', '/zh-hans', '/zh-hans/chain', '/zh-hans/saved']],
  ['en', '/en/chain', ['/en', '/en', '/en/chain', '/en/saved']],
] as const)('%s at %s: the header\'s links (the name, then the two pages and the saved page) stay in the language', async (locale, pathname, hrefs) => {
  address.pathname = pathname;
  expect(headerLinks(await renderLayout(locale)).map(a => a.getAttribute('href'))).toEqual(hrefs);
});

it.each([
  ['/', 'zh-Hant', '搜尋旅行團'],
  ['/tours/japan', 'zh-Hant', '搜尋旅行團'], // a destination's page is the search page with the destination chosen
  ['/zh-hans/tours/japan-kansai', 'zh-Hans', '搜索旅行团'],
  ['/en/chain', 'en', 'Plan a trip'],
  ['/en/tours', 'en', null], // the destinations index has no link in the header
  ['/tours', 'zh-Hant', null],
  ['/en/saved', 'en', 'Saved'], // served without the number: the browser adds it
  ['/about', 'zh-Hant', null],
] as const)('at %s the header marks the page the address shows', async (pathname, locale, current) => {
  address.pathname = pathname;
  // The saved link's hidden copy (its kept room) is not what it says.
  const said = (a: Element) => { const c = a.cloneNode(true) as Element; c.querySelectorAll('[aria-hidden="true"]').forEach(h => h.remove()); return c.textContent; };
  const marked = headerLinks(await renderLayout(locale)).filter(a => a.getAttribute('aria-current') === 'page').map(said);
  expect(marked).toEqual(current === null ? [] : [current]);
});

it.each([
  ['zh-Hant', '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。'],
  ['zh-Hans', '汇集多家香港旅行社的旅行团，可按出发日期、天数、目的地和价格筛选。报名请前往旅行社自己的网站。'],
  ['en', "Group tours from several Hong Kong tour operators in one place. Filter by departure date, length, destination and price, then book on the operator's own website."],
] as const)('%s: the site address as the base of every address, the site name as the title and its pattern for pages, and the description in that language', (locale, description) => {
  expect(siteFrameMetadata(locale)).toEqual({
    metadataBase: new URL('https://example.invalid'),
    title: { default: '跟邊團', template: '%s | 跟邊團' },
    description,
    // For a page with no metadata of its own (a language's 404): the sharing image in that language.
    openGraph: { siteName: '跟邊團', locale: { 'zh-Hant': 'zh_HK', 'zh-Hans': 'zh_CN', en: 'en_GB' }[locale], type: 'website', images: [shareImage(makeT(locale))] },
    twitter: { card: 'summary_large_image' },
  });
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('%s: the frame gives no structured data: the WebSite block is the home page\'s alone (search-page.tsx)', async locale => {
  const doc = new DOMParser().parseFromString(await renderLayout(locale), 'text/html');
  expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
});

it('in zh-Hant there is no notice and no space kept for it', async () => {
  const html = await renderLayout();
  expect(html).not.toContain('role="note"');
  expect(html).not.toContain('data-notice-spacer');
  expect(html).not.toContain(styles.withNotice);
});

it.each([
  ['zh-Hans', '旅行团一般以粤语进行，详情请向旅行社查询。'],
  ['en', 'Tours are normally conducted in Cantonese. Check with the operator.'],
] as const)('in %s the notice comes first on every page, before the nav bar, and focus scrolling stops below it', async (locale, text) => {
  const html = await renderLayout(locale);
  const note = html.indexOf('role="note"');
  expect(note).toBeGreaterThan(-1);
  expect(html).toContain(text);
  expect(note).toBeLessThan(html.indexOf('<nav'));
  expect(html.indexOf('data-notice-spacer')).toBeLessThan(html.indexOf('<nav'));
  expect(html).toMatch(new RegExp(`^<html lang="[^"]+" class="${styles.withNotice}"`));
  const css = readFileSync(join(__dirname, 'site-frame.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.withNotice \{ scroll-padding-top: 5rem; \}/);
});

it.each(['zh-Hant', 'zh-Hans', 'en'] as const)('%s: no data-theme from the server; the script in <head> sets it in the browser, before <body>', async locale => {
  const html = await renderLayout(locale);
  expect(html).not.toContain('data-theme=');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...doc.querySelectorAll('script')];
  expect(scripts).toHaveLength(1);
  expect(scripts[0].parentElement?.tagName).toBe('HEAD');
  expect(scripts[0].textContent).toBe(THEME_SCRIPT);
  expect(html.indexOf('<script')).toBeGreaterThan(-1);
  expect(html.indexOf('<script')).toBeLessThan(html.indexOf('<body>'));
  // Its type (none on the server, text/plain in the browser): components/ThemeScript*.test.tsx.
});

it('<html> accepts the attribute the script sets (suppressHydrationWarning on <html>), as React and Next.js document', () => {
  const frame = SiteFrame({ locale: 'en', children: null });
  expect(frame.type).toBe('html');
  expect(frame.props.suppressHydrationWarning).toBe(true);
  const html = renderToStaticMarkup(frame);
  expect(html.match(/suppressHydrationWarning/gi)).toBeNull();
});

it('the nav bar has the theme switch beside the language switch', async () => {
  const html = await renderLayout();
  expect(html).toContain('切換至深色模式');
  expect(html).toContain('切換至淺色模式');
});
