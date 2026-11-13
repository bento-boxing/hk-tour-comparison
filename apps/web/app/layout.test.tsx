import { it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useT } from '../lib/i18n-client';
import RootLayout from './layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

afterEach(() => { vi.unstubAllEnvs(); });

/** A client component inside the layout: it sees the provider's locale. */
function ClientSiteName() {
  return <p data-testid="client">{useT()('site.name')}</p>;
}

it.each([
  [{ DEV_LOCALE: 'en' }, 'Tour Compare', "Not affiliated with any operator."],
  [{ DEV_LOCALE: 'en', VERCEL: '1', VERCEL_ENV: '' }, '旅行團比較', '本網站與各旅行社並無任何關連。'],
  [{ DEV_LOCALE: '' }, '旅行團比較', '本網站與各旅行社並無任何關連。'],
])('server text and client text use the same locale (%j)', (env, siteName, disclaimer) => {
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const html = renderToStaticMarkup(<RootLayout><ClientSiteName /></RootLayout>);
  expect(html).toContain(`<p data-testid="client">${siteName}</p>`);
  expect(html).toContain(disclaimer);
});
