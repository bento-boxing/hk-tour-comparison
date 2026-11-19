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
    '最多一天前', '以旅行社網站為準', 'hello@ganbintuen.com', '移除有關資料',
  ]) expect(text, phrase).toContain(phrase);
  const readme = readFileSync(join(__dirname, '..', '..', '..', '..', 'README.md'), 'utf8');
  // The intro is README's first paragraph of that section, word for word.
  expect(readme).toContain(makeT('zh-Hant')('about.intro').replace('「跟邊團」', '「跟邊團」（<https://ganbintuen.com>）'));
});

it('names the program as the scraper names itself, and its pace as the scraper keeps it', () => {
  const scraper = readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'scraper', 'src', 'polite-fetch.ts'), 'utf8');
  expect(scraper).toMatch(/export const USER_AGENT = `tour-comparison-bot\//);
  expect(scraper).toMatch(/export const REQUEST_DELAY_MS = 3000;/);
  for (const locale of LOCALES) expect(makeT(locale)('about.collect1'), locale).toContain('tour-comparison-bot');
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
