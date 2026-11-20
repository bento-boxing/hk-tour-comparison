import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { makeT, LOCALES } from '../../lib/i18n';
import { AboutPage, aboutPageMetadata } from './about-page';
import { NotFoundPage, notFoundMetadata } from './not-found-page';

it.each([
  ['zh-Hant', '關於本網站', ['網站顯示甚麼', '資料如何收集', '價錢及出發日期', '更正或移除資料']],
  ['zh-Hans', '关于本网站', ['网站显示什么', '数据如何收集', '价格及出发日期', '更正或删除数据']],
  ['en', 'About this site', ['What the site shows', 'How the data is collected', 'Prices and dates', 'Corrections and removal']],
] as const)('in %s: a heading, the short sections, and the contact address as a mailto link', (locale, heading, sections) => {
  const { container } = render(<AboutPage locale={locale} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(sections);
  const links = screen.getAllByRole('link');
  expect(links.map(a => a.getAttribute('href'))).toEqual(['mailto:hello@ganbintuen.com']);
  expect(links[0]).toHaveTextContent('hello@ganbintuen.com');
  // Every sentence is the dictionary's, so none is left untranslated or with a placeholder showing.
  expect(container.textContent).not.toMatch(/\{\w+\}|about\./);
});

it('says what the owner asked for, in Traditional Chinese as in README.md\'s 給旅行社的說明', () => {
  const { container } = render(<AboutPage locale="zh-Hant" />);
  const text = container.textContent ?? '';
  for (const phrase of [
    '由個人製作的非牟利網站', '不設廣告、不收佣金、不代售任何產品', '本網站與各旅行社並無任何關連',
    '只顯示事實資料', '連結到旅行社網站上的該團頁面', '不會儲存或顯示行程描述、圖片或宣傳文字', '不會使用旅行社的標誌',
    '每晚運行一次', 'tour-comparison-bot', 'robots.txt', '每次只發出一個請求', '最少相隔三秒', '不會登入', '不會繞過',
    '最後更新的日期', '以旅行社網站為準', 'hello@ganbintuen.com', '移除有關資料', '停止讀取該旅行社的網站',
  ]) expect(text, phrase).toContain(phrase);
  // Nothing it cannot keep: no promise of an age limit, no first-refusal stop, no switch to 貴公司 mid-sentence.
  expect(text).not.toMatch(/最多一天|如網站拒絕|貴公司|讀不到 robots\.txt 的網站不會讀取/);
});

/** README's 給旅行社的說明 section, with its code marks removed (`robots.txt` → robots.txt). */
function readmeSection(): string {
  const readme = readFileSync(join(__dirname, '..', '..', '..', '..', 'README.md'), 'utf8');
  const start = readme.indexOf('## 給旅行社的說明');
  const end = readme.indexOf('\n## ', start + 1);
  expect(start).toBeGreaterThan(-1);
  return readme.slice(start, end === -1 ? undefined : end).replace(/`/g, '');
}

it('README\'s 給旅行社的說明 says the same as the about page, sentence for sentence where both address the same reader', () => {
  const t = makeT('zh-Hant');
  const section = readmeSection();
  // The intro, word for word, with the address after the name.
  expect(section).toContain(t('about.intro').replace('「跟邊團」', '「跟邊團」（<https://ganbintuen.com>）'));
  // Every fact about what is shown, how it is read and how fresh it is.
  for (const key of ['about.show1', 'about.show2', 'about.show3', 'about.collect1', 'about.collect2', 'about.collect3', 'about.collect4', 'about.prices'] as const) {
    expect(section, key).toContain(t(key));
  }
  // The correction route: the same address, and only that (the about page names no other route). README speaks to
  // the operator (貴公司), the about page to anyone, so those two sentences are worded apart on purpose.
  expect(section).toContain('hello@ganbintuen.com');
  expect(section).not.toMatch(/Issues|額滿/);
});

it('names the program as the scraper names itself, its pace, its pushback rule and its robots.txt rule as the scraper keeps them', () => {
  const scraper = readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'scraper', 'src', 'polite-fetch.ts'), 'utf8');
  expect(scraper).toMatch(/export const BOT_PRODUCT = 'tour-comparison-bot\//);
  expect(scraper).toMatch(/export const REQUEST_DELAY_MS = 3000;/);
  // "Several refusals in a row" (多次拒絕), not the first.
  expect(scraper).toMatch(/export const MAX_CONSECUTIVE_PUSHBACK = 3;/);
  // A missing robots.txt (404, 410) allows everything; any other failure refuses the site.
  expect(scraper).toMatch(/const NO_ROBOTS_STATUSES = \[404, 410\];/);
  for (const locale of LOCALES) expect(makeT(locale)('about.collect1'), locale).toContain('tour-comparison-bot');
});

it('in English the site is "non-commercial", not "non-profit" (which can suggest a registered organisation)', () => {
  const en = makeT('en');
  for (const key of ['about.intro', 'about.description'] as const) {
    expect(en(key)).toContain('personal, non-commercial website');
    expect(en(key)).not.toMatch(/non-profit/);
  }
});

it.each([
  ['zh-Hant', '關於本網站', 'https://ganbintuen.com/about'],
  ['zh-Hans', '关于本网站', 'https://ganbintuen.com/zh-hans/about'],
  ['en', 'About this site', 'https://ganbintuen.com/en/about'],
] as const)('in %s: its own title, description and canonical, with the three languages and x-default', (locale, title, canonical) => {
  const meta = aboutPageMetadata(locale);
  expect(meta).toMatchObject({
    title, description: makeT(locale)('about.description'),
    alternates: {
      canonical,
      languages: { 'zh-Hant': 'https://ganbintuen.com/about', 'zh-Hans': 'https://ganbintuen.com/zh-hans/about', en: 'https://ganbintuen.com/en/about', 'x-default': 'https://ganbintuen.com/about' },
    },
  });
  expect(meta).not.toHaveProperty('robots');
  expect(meta.openGraph).not.toHaveProperty('url');
});

it.each([
  ['zh-Hant', '找不到這一頁', [['搜尋旅行團', '/'], ['所有目的地', '/tours']]],
  ['zh-Hans', '找不到这一页', [['搜索旅行团', '/zh-hans'], ['所有目的地', '/zh-hans/tours']]],
  ['en', 'Page not found', [['Find tours', '/en'], ['All destinations', '/en/tours']]],
] as const)('in %s the 404 inside the language\'s pages says so in that language and links to its search page and destinations', (locale, title, links) => {
  render(<NotFoundPage locale={locale} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
  expect(screen.getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')])).toEqual(links);
  expect(notFoundMetadata(locale)).toEqual({ title });
});
