import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTheme } from './theme-action';
import { themeFromCookie } from './theme';

const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: jar.set }) }));

beforeEach(() => { jar.set.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

const form = (theme: string | null) => {
  const data = new FormData();
  if (theme !== null) data.set('theme', theme);
  return data;
};

it.each([
  ['light', 'light'], ['dark', 'dark'],
  [undefined, null], ['', null], ['Dark', null], ['system', null], ['dark ', null], ['constructor', null],
] as const)('themeFromCookie(%j) → %j (null: no choice, follow the system)', (value, theme) => {
  expect(themeFromCookie(value)).toBe(theme);
});

it.each(['light', 'dark'])('remembers %s for a year, SameSite=Lax, for the whole site', async theme => {
  vi.stubEnv('NODE_ENV', 'development');
  await setTheme(form(theme));
  expect(jar.set).toHaveBeenCalledWith('theme', theme, {
    path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: true, secure: false,
  });
});

it('marks the cookie Secure in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await setTheme(form('dark'));
  expect(jar.set.mock.calls[0][2]).toMatchObject({ secure: true });
});

it.each([null, '', 'system', 'DARK', 'dark; Path=/admin', 'constructor'])('ignores %j: no cookie is set', async value => {
  await setTheme(form(value));
  expect(jar.set).not.toHaveBeenCalled();
});
