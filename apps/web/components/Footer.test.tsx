import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { makeT } from '../lib/i18n';
import { Footer } from './Footer';
import styles from './Footer.module.css';

// next/link as a plain <a> that shows the prefetch setting it was given (data-prefetch), so the tests can check it.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | 'auto' | null; children: React.ReactNode }) =>
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} {...rest}>{children}</a>,
}));

const css = () => readFileSync(join(__dirname, 'Footer.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '本網站與各旅行社並無任何關連。', '如有意見或查詢，或旅行社需要更正或移除旅行團資料，請電郵至 bot@example.invalid。'],
  ['zh-Hans', '本网站与各旅行社没有任何关联。', '如有意见或疑问，或旅行社需要更正或删除旅行团信息，请发邮件至 bot@example.invalid。'],
  ['en', 'This site is not affiliated with any tour operator.',
    'Questions or feedback, or a tour operator wanting a listing corrected or removed? Write to bot@example.invalid.'],
] as const)('in %s: the disclaimer, then a contact line whose address is a mailto link', (locale, disclaimer, contact) => {
  const { container } = render(<Footer t={makeT(locale)} />);
  const footer = container.querySelector('footer');
  expect(footer).toHaveTextContent(disclaimer);
  const line = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === contact);
  expect(line).toHaveClass(styles.text, styles.contact);
  const link = screen.getByRole('link', { name: 'bot@example.invalid' });
  expect(link).toHaveAttribute('href', 'mailto:bot@example.invalid');
  expect(link).toHaveClass(styles.link);
  expect(line).toContainElement(link);
  expect(screen.getAllByRole('link')).toHaveLength(4);
  // The disclaimer comes first; the contact line follows it.
  const paragraphs = [...container.querySelectorAll('footer > p')];
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs[1]).toBe(line);
});

it('its links are in the footer\'s text colour, so they are underlined to read as links, with a visible focus ring', () => {
  const text = css();
  expect(text).toMatch(/\.link \{ color: inherit; text-decoration: underline; \}/);
  expect(text).toMatch(/\.link:focus-visible \{ outline: 2px solid var\(--focus\); outline-offset: 2px; \}/);
});

it.each([
  ['zh-Hant', '網站資訊', [['所有目的地', '/tours'], ['所有旅行社', '/operators'], ['關於本網站', '/about']]],
  ['zh-Hans', '网站信息', [['所有目的地', '/zh-hans/tours'], ['所有旅行社', '/zh-hans/operators'], ['关于本网站', '/zh-hans/about']]],
  // English says "Destinations" and "Operators", so the three links keep to one line on a 320px phone.
  ['en', 'Site links', [['Destinations', '/en/tours'], ['Operators', '/en/operators'], ['About this site', '/en/about']]],
] as const)('in %s: after the contact line, links to the destinations index, the operators index and the about page in that language', (locale, label, links) => {
  const { container } = render(<Footer t={makeT(locale)} />);
  const nav = screen.getByRole('navigation', { name: label });
  expect([...nav.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')])).toEqual(links);
  expect(container.querySelector('footer')?.lastElementChild).toBe(nav);
});

it('only the about page, which is stored (made at build time), is pre-loaded; the indexes are made per request and are not', () => {
  render(<Footer t={makeT('en')} />);
  const nav = screen.getByRole('navigation', { name: 'Site links' });
  expect([...nav.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('data-prefetch')])).toEqual([
    ['/en/tours', 'false'], ['/en/operators', 'false'], ['/en/about', 'auto'],
  ]);
});
