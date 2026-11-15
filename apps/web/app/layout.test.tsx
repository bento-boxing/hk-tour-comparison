import { it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { useT } from '../lib/i18n-client';
import RootLayout, { generateMetadata } from './layout';
import styles from './layout.module.css';

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined, theme: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === 'locale' ? cookie.value : name === 'theme' ? cookie.theme : undefined;
      return value === undefined ? undefined : { name, value };
    },
  }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('../lib/theme-action', () => ({ setTheme: vi.fn() }));

beforeEach(() => { cookie.value = undefined; cookie.theme = undefined; });

/** A client component inside the layout: it sees the provider's locale. */
function ClientText() {
  return <p data-testid="client">{useT()('nav.search')}</p>;
}

async function renderLayout(): Promise<string> {
  return renderToStaticMarkup(await RootLayout({ children: <ClientText /> }));
}

it.each([
  [undefined, 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'],
  ['zh-Hant', 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'],
  ['zh-Hans', 'zh-Hans', '搜索旅行团', '本网站与各旅行社没有任何关联。'],
  ['en', 'en', 'Find tours', 'This site is not affiliated with any tour operator.'],
  ['fr', 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'], // an unknown value: the default
  ['', 'zh-Hant-HK', '搜尋旅行團', '本網站與各旅行社並無任何關連。'],
])('cookie %j: <html lang="%s">, and the server text and client text share the language', async (value, lang, clientText, disclaimer) => {
  cookie.value = value;
  const html = await renderLayout();
  expect(html).toMatch(new RegExp(`^<html lang="${lang}"`));
  expect(html).toContain(`<p data-testid="client">${clientText}</p>`); // client: the provider
  expect(html).toContain(disclaimer); // server: the footer
});

it('the page title is the site name in every language', async () => {
  for (const value of [undefined, 'zh-Hans', 'en']) {
    cookie.value = value;
    expect((await generateMetadata()).title).toBe('跟邊團');
  }
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
])('in %s the notice comes first on every page, before the nav bar, and focus scrolling stops below it', async (value, text) => {
  cookie.value = value;
  const html = await renderLayout();
  const note = html.indexOf('role="note"');
  expect(note).toBeGreaterThan(-1);
  expect(html).toContain(text);
  expect(note).toBeLessThan(html.indexOf('<nav'));
  expect(html.indexOf('data-notice-spacer')).toBeLessThan(html.indexOf('<nav'));
  expect(html).toMatch(new RegExp(`^<html lang="[^"]+" class="${styles.withNotice}"`));
  const css = readFileSync(join(__dirname, 'layout.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.withNotice \{ scroll-padding-top: 5rem; \}/);
});

it.each([
  ['dark', ' data-theme="dark"'],
  ['light', ' data-theme="light"'],
])('theme cookie %j: the server renders <html%s>, so the first paint is in the chosen theme', async (value, attr) => {
  cookie.theme = value;
  const html = await renderLayout();
  expect(html).toMatch(new RegExp(`^<html lang="zh-Hant-HK"${attr}>`));
});

it.each([undefined, '', 'system', 'Dark'])('theme cookie %j: no data-theme, so the visitor\'s system setting decides (CSS media query)', async value => {
  cookie.theme = value;
  const html = await renderLayout();
  expect(html).toMatch(/^<html lang="zh-Hant-HK">/);
  expect(html).not.toContain('data-theme');
});

it('the nav bar has the theme switch beside the language switch', async () => {
  const html = await renderLayout();
  expect(html).toContain('切換至深色模式');
  expect(html).toContain('切換至淺色模式');
});
