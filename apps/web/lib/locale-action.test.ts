import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLocale } from './locale-action';

const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: jar.set }) }));

beforeEach(() => { jar.set.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

const form = (locale: string | null) => {
  const data = new FormData();
  if (locale !== null) data.set('locale', locale);
  return data;
};

it.each(['zh-Hant', 'zh-Hans', 'en'])('remembers %s for a year, SameSite=Lax, for the whole site', async locale => {
  vi.stubEnv('NODE_ENV', 'development');
  await setLocale(form(locale));
  expect(jar.set).toHaveBeenCalledWith('locale', locale, {
    path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: true, secure: false,
  });
});

it('marks the cookie Secure in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await setLocale(form('en'));
  expect(jar.set.mock.calls[0][2]).toMatchObject({ secure: true });
});

it.each([null, '', 'fr', 'EN', 'en; Path=/admin', 'constructor'])('ignores %j: no cookie is set', async value => {
  await setLocale(form(value));
  expect(jar.set).not.toHaveBeenCalled();
});
