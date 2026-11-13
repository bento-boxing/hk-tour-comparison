import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorInfo } from '@hktours/db/read';
import { I18nProvider } from '../lib/i18n-client';
import { FilterBarConnected } from './FilterBarConnected';

const push = vi.fn<(href: string, opts?: { scroll?: boolean }) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));

const operators: OperatorInfo[] = [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }];

beforeEach(() => { push.mockReset(); });

it('a change goes into the address with the page dropped, without scrolling to the top', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale="zh-Hant">
      <FilterBarConnected state={{ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'days', page: 3 }} operators={operators} />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: '日數：全部' }));
  await user.click(screen.getByRole('button', { name: '4–6日' }));
  expect(push).toHaveBeenCalledWith('/?dest=japan-kansai&dmin=4&dmax=6&sort=days', { scroll: false });
});

it('clearing the last filter goes back to the bare address', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale="zh-Hant">
      <FilterBarConnected state={{ filters: { operators: ['egl'] }, sort: 'price', page: 2 }} operators={operators} />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: '旅行社：東瀛遊' }));
  await user.click(screen.getByRole('checkbox', { name: '東瀛遊' }));
  expect(push).toHaveBeenCalledWith('/', { scroll: false });
});
