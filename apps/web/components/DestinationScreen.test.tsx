import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { places, type Destination } from '@hktours/core';
import { makeT, type Locale } from '../lib/i18n';
import type { ScreenData } from '../lib/search-screen';
import { DestinationScreen } from './DestinationScreen';

// Task 73 (the owner's drawing Mobile2Search): the phone search box and the full-screen search it opens.

let onSelect: ReturnType<typeof vi.fn<(dest: Destination | null) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onSelect = vi.fn();
  user = userEvent.setup();
  // jsdom has the element but not its modal methods: open and close it as the browser would (close fires 'close').
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.history.replaceState(null, '');
});
afterEach(() => { window.history.replaceState(null, ''); });

const data: ScreenData = {
  popular: ['china', 'japan', 'korea', 'taiwan', 'thailand', 'vietnam', 'malaysia', 'macau'],
  tours: { china: 1463, japan: 157, 'japan-kansai': 36, korea: 100, taiwan: 72, thailand: 60, vietnam: 52, malaysia: 56 },
};

function renderScreen(extra: Partial<Parameters<typeof DestinationScreen>[0]> = {}, locale: Locale = 'zh-Hant') {
  const t = makeT(locale);
  return render(
    <DestinationScreen
      places={places} t={t} value={null} onSelect={onSelect} screen={data} placeholder={t('band.placeholder')} fallbackHref="/tours"
      {...extra}
    />,
  );
}
const box = () => screen.getByRole('button', { name: '想去邊？輸入國家、地區或城市' });
const dialog = () => screen.getByRole('dialog', { name: '選擇目的地' });
/** Lets the screen's Back (history.back) arrive, and the choice after it. */
const settle = () => act(() => new Promise(r => setTimeout(r, 60)));

it('without JavaScript (the server\'s HTML) the box is a link to the destinations directory, and there is no screen', () => {
  const t = makeT('zh-Hant');
  const html = renderToString(
    <DestinationScreen places={places} t={t} value={null} onSelect={() => {}} screen={data} placeholder={t('band.placeholder')} fallbackHref="/tours" />,
  );
  expect(html).toMatch(/^<div[^>]*><a [^>]*href="\/tours"[^>]*>.*想去邊？輸入國家、地區或城市<\/span><\/a><\/div>$/);
  expect(html).not.toContain('<dialog');
});

it('pressing the box opens the screen: a modal dialog, the text field focused, a history entry for Back', async () => {
  renderScreen();
  expect(box()).toHaveAttribute('aria-haspopup', 'dialog');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(box());
  expect(dialog()).toBeInTheDocument();
  expect(within(dialog()).getByRole('combobox', { name: '輸入國家、地區或城市' })).toHaveFocus();
  expect(window.history.state).toMatchObject({ destinationScreen: true });
  expect(within(dialog()).getByRole('button', { name: '關閉' })).toHaveTextContent('←');
});

it('熱門目的地: the top eight with their counts (four columns); one with no tours here is faded and cannot be pressed', async () => {
  renderScreen();
  await user.click(box());
  const popular = within(dialog()).getByRole('region', { name: '熱門目的地' });
  const buttons = within(popular).getAllByRole('button');
  expect(buttons.map(b => b.textContent)).toEqual([
    '中國 1,463 團', '日本 157 團', '韓國 100 團', '台灣 72 團', '泰國 60 團', '越南 52 團', '馬來西亞 56 團', '澳門 0 團',
  ]);
  expect(buttons[7]).toBeDisabled();
  await user.click(buttons[1]);
  // Closed first (its history entry gone), then the choice.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ countryId: 'japan', regionId: null });
  expect(window.history.state?.destinationScreen).toBeUndefined();
});

it('按地區瀏覽: a part of the world opens its countries, a country its regions (全部地區 first, with counts); a one-region country is chosen at once', async () => {
  renderScreen();
  await user.click(box());
  const browse = within(dialog()).getByRole('region', { name: '按地區瀏覽' });
  const northeast = within(browse).getByRole('button', { name: '日本及韓國' });
  expect(northeast).toHaveAttribute('aria-expanded', 'false');
  await user.click(northeast);
  expect(northeast).toHaveAttribute('aria-expanded', 'true');
  const japan = within(browse).getByRole('button', { name: /^日本 157 團/ });
  await user.click(japan);
  const regions = within(browse).getAllByRole('button').filter(b => b.closest('ul[id$="-regions-japan"]'));
  expect(regions[0]).toHaveTextContent('全部地區 157 團');
  expect(regions[1]).toHaveTextContent('北海道 0 團');
  await user.click(within(browse).getByRole('button', { name: '關西 36 團' }));
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ countryId: 'japan', regionId: 'japan-kansai' });
  // Macau has one region: chosen as the whole country.
  onSelect.mockReset();
  await user.click(box());
  const browseAgain = () => within(dialog()).getByRole('region', { name: '按地區瀏覽' });
  await user.click(within(browseAgain()).getByRole('button', { name: '中國內地及港澳台' }));
  const macau = within(browseAgain()).getByRole('button', { name: /^澳門/ });
  expect(macau).not.toHaveAttribute('aria-expanded');
  await user.click(macau);
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ countryId: 'macau', regionId: null });
  // Hong Kong is never offered.
  await user.click(box());
  await user.click(within(dialog()).getByRole('button', { name: '中國內地及港澳台' }));
  expect(within(dialog()).queryByRole('button', { name: /^香港/ })).toBeNull();
});

it('typing replaces the choices with the suggestions, which stay when the field loses focus; Enter chooses the first', async () => {
  renderScreen();
  await user.click(box());
  await user.keyboard('大阪');
  expect(within(dialog()).queryByRole('region', { name: '熱門目的地' })).toBeNull();
  expect(within(dialog()).queryByRole('region', { name: '按地區瀏覽' })).toBeNull();
  const listbox = within(dialog()).getByRole('listbox');
  expect(within(listbox).getAllByRole('option')[0]).toHaveTextContent('日本 → 關西');
  await user.click(within(dialog()).getByRole('heading', { name: '選擇目的地', hidden: true }));
  expect(within(dialog()).getByRole('listbox')).toBeInTheDocument();
  await user.click(within(dialog()).getByRole('combobox'));
  await user.keyboard('{Enter}');
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ countryId: 'japan', regionId: 'japan-kansai' });
});

it('← and the browser\'s Back close it without a choice; it opens again empty; focus returns to the box', async () => {
  renderScreen();
  await user.click(box());
  await user.keyboard('大阪');
  await user.click(within(dialog()).getByRole('button', { name: '關閉' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(box()).toHaveFocus();
  await settle();
  expect(window.history.state?.destinationScreen).toBeUndefined();
  await user.click(box());
  expect(within(dialog()).getByRole('combobox')).toHaveValue('');
  await act(async () => {
    window.history.replaceState(null, ''); // as after the browser goes back to the page's own entry
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await settle();
  expect(onSelect).not.toHaveBeenCalled();
  // Forward opens it again.
  await act(async () => {
    window.history.replaceState({ destinationScreen: true }, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { destinationScreen: true } }));
  });
  expect(dialog()).toBeInTheDocument();
});

it('reloaded on the screen\'s history entry, the page opens it again', () => {
  window.history.replaceState({ destinationScreen: true }, '');
  renderScreen();
  expect(dialog()).toBeInTheDocument();
});

it('the chosen destination is marked in both lists', async () => {
  renderScreen({ value: { countryId: 'japan', regionId: 'japan-kansai' } });
  // On the band the box keeps its placeholder (the chosen box shows the destination and clears it).
  expect(box()).toBeInTheDocument();
  await user.click(box());
  const browse = within(dialog()).getByRole('region', { name: '按地區瀏覽' });
  await user.click(within(browse).getByRole('button', { name: '日本及韓國' }));
  const japan = within(browse).getByRole('button', { name: /^日本 157 團/ });
  expect(japan).toHaveAttribute('aria-current', 'true');
  // 熱門目的地 marks the country only when the whole country is chosen.
  expect(within(within(dialog()).getByRole('region', { name: '熱門目的地' })).getByRole('button', { name: '日本 157 團' })).not.toHaveAttribute('aria-current');
  await user.click(japan);
  expect(within(dialog()).getByRole('button', { name: '關西 36 團' })).toHaveAttribute('aria-current', 'true');
  expect(within(dialog()).getByRole('button', { name: '全部地區 157 團' })).not.toHaveAttribute('aria-current');
});

it('without counts (the trip\'s choosing screen): no 熱門目的地, no counts; the box shows the destination and clears it', async () => {
  renderScreen({ screen: undefined, showValue: true, fallbackHref: undefined, value: { countryId: 'japan', regionId: null }, placeholder: '輸入國家、地區或城市' });
  const opener = screen.getByRole('button', { name: '日本 → 全部地區' });
  await user.click(opener);
  expect(within(dialog()).queryByRole('region', { name: '熱門目的地' })).toBeNull();
  await user.click(within(dialog()).getByRole('button', { name: '日本及韓國' }));
  expect(within(dialog()).getByRole('button', { name: '日本' })).toBeInTheDocument();
  await user.click(within(dialog()).getByRole('button', { name: '關閉' }));
  await user.click(screen.getByRole('button', { name: '清除目的地：日本 → 全部地區' }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
});

it('without JavaScript on the trip\'s choosing screen (no fallback): plain text, no link', () => {
  const t = makeT('zh-Hant');
  const html = renderToString(<DestinationScreen places={places} t={t} value={null} onSelect={() => {}} placeholder="p" />);
  expect(html).not.toContain('<a ');
  expect(html).not.toContain('<button');
});

it('in English: the names and the screen\'s words', async () => {
  renderScreen({}, 'en');
  await user.click(screen.getByRole('button', { name: 'Where to? Enter a country, region or city' }));
  const d = screen.getByRole('dialog', { name: 'Choose a destination' });
  expect(within(within(d).getByRole('region', { name: 'Popular destinations' })).getAllByRole('button')[0]).toHaveTextContent('China 1,463 tours');
  expect(within(d).getByRole('region', { name: 'Browse by part of the world' })).toBeInTheDocument();
  expect(within(d).getByRole('button', { name: 'Close' })).toBeInTheDocument();
});

it('from 1024px it is not opened from the history, and a window grown to 1024px (a phone turned sideways) closes it', async () => {
  let listener: (() => void) | undefined;
  const query = { matches: false, addEventListener: (_: string, l: () => void) => { listener = l; }, removeEventListener: () => {} };
  window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia;
  try {
    renderScreen();
    await user.click(box());
    expect(dialog()).toBeInTheDocument();
    query.matches = true;
    act(() => listener!());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await settle();
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => {
      window.history.replaceState({ destinationScreen: true }, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { destinationScreen: true } }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    // jsdom has none of its own.
    delete (window as { matchMedia?: unknown }).matchMedia;
  }
});
