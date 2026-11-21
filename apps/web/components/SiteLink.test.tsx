import { it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { SiteLink } from './SiteLink';

// next/link as a plain <a> that shows the prefetch setting it was given (data-prefetch), so the tests can check it.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | 'auto' | null; children: React.ReactNode }) =>
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} {...rest}>{children}</a>,
}));

it('is not pre-loaded unless told: next/link with prefetch={false}', () => {
  render(<SiteLink href="/tours">x</SiteLink>);
  expect(screen.getByRole('link', { name: 'x' })).toHaveAttribute('data-prefetch', 'false');
});

it('pre-loads when a link to a stored page asks for it (prefetch="auto", Next.js\'s own default)', () => {
  render(<SiteLink href="/about" prefetch="auto">x</SiteLink>);
  expect(screen.getByRole('link', { name: 'x' })).toHaveAttribute('data-prefetch', 'auto');
});

it('passes everything else on unchanged: address, classes, aria attributes, rel, the ref', () => {
  const ref = createRef<HTMLAnchorElement>();
  render(<SiteLink ref={ref} href="/tours/japan?page=2" className="a b" rel="next" aria-current="page" aria-label="page 2">2</SiteLink>);
  const link = screen.getByRole('link', { name: 'page 2' });
  expect(link).toHaveAttribute('href', '/tours/japan?page=2');
  expect(link).toHaveAttribute('class', 'a b');
  expect(link).toHaveAttribute('rel', 'next');
  expect(link).toHaveAttribute('aria-current', 'page');
  expect(link).toHaveTextContent('2');
  expect(ref.current).toBe(link);
});
