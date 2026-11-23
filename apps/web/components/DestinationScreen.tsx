'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Destination, PlacesIndex } from '@hktours/core';
import type { T } from '../lib/i18n';
import { formatCount } from '../lib/format';
import { WIDE_MEDIA } from '../lib/breakpoints';
import { choosesWholeCountry, offeredCountryGroups, regionChoices } from '../lib/destination-choices';
import { destinationFromId, destinationId } from '../lib/destinations';
import { placeName } from '../lib/place-names';
import type { ScreenData } from '../lib/search-screen';
import { DestinationSearch, destinationLabel } from './DestinationSearch';
import { SiteLink } from './SiteLink';
import styles from './DestinationScreen.module.css';

/** The ids' start: fixed (one screen per page), not useId, so the stored home page and its per-request copy match. */
const SCREEN_ID = 'destination-screen';

/** The mark on the history entry the open screen adds, so the browser's Back closes it. */
const HISTORY_KEY = 'destinationScreen';

const onScreenEntry = () => (window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY] === true;

export interface DestinationScreenProps {
  places: PlacesIndex; t: T;
  value: Destination | null;
  /** A destination chosen (or, with showValue, cleared: null). */
  onSelect: (dest: Destination | null) => void;
  /** 熱門目的地 and the counts (lib/search-screen.ts); none: neither (the trip's choosing screen). */
  screen?: ScreenData;
  /** The box's text while nothing is shown in it. */
  placeholder: string;
  /**
   * Where the box leads without JavaScript (the destinations directory, in the page's language); none: until the page
   * runs it is plain text (the trip's choosing screen, whose addresses need JavaScript as all its controls do).
   */
  fallbackHref?: string;
  /**
   * The box shows the chosen destination ('日本 → 全部地區') with a clear button: on the trip's choosing screen, which has
   * no chosen boxes. On the band the chosen box (white, ✕) shows and clears it, so the box keeps its placeholder.
   */
  showValue?: boolean;
}

/**
 * The phone destination search (task 73, the owner's drawing Mobile2Search): on a phone the page shows a search box
 * that opens a full-screen view: the text field at the top (focused, with ← to close), then 熱門目的地 (today's top
 * eight, with their counts where the page has them) and 按地區瀏覽 (the parts of the world, each opening its
 * countries, a country opening its regions: the 按國家選擇 panel's choices and rules, lib/destination-choices.ts).
 * Typing replaces them with the suggestions, as the wide search box gives them. Choosing goes where those controls go
 * (onSelect).
 *
 * The view is a modal dialog (the browser's own: focus moves in and stays in, the page behind is inert, Escape
 * closes it) over the whole window, and the page behind does not scroll. Opening it adds a history entry for the same
 * address, so the browser's Back (a phone's back gesture) closes it; closing it any other way goes back over that
 * entry, and only then does a choice navigate (one navigation, and the entry is never left behind). It is not in the
 * address: a shared link never opens it. The text field is focused in the press itself, so a phone shows its keyboard.
 * Focus returns to the box when it closes.
 *
 * Without JavaScript (and until the page runs) the box is a link to the destinations directory (fallbackHref), where
 * every destination is a link.
 */
export function DestinationScreen({ places, t, value, onSelect, screen, placeholder, fallbackHref, showValue = false }: DestinationScreenProps) {
  const id = SCREEN_ID;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ dest: Destination | null } | null>(null);
  const waitingForBack = useRef(false);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; });

  const [hydrated, setHydrated] = useState(false);
  // A fresh text field for each opening (counted at each closing, so the next one is already there to focus).
  const [round, setRound] = useState(0);
  const [text, setText] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const finish = () => {
      const next = pending.current;
      pending.current = null;
      if (next) selectRef.current(next.dest);
    };
    // From 1024px the box is not drawn, and the screen is not opened (nor left open, unseen, over a page it makes inert:
    // a phone turned sideways closes it).
    const wide = window.matchMedia?.(WIDE_MEDIA);
    const openFromHistory = () => { if (!dialog.open && !wide?.matches) dialog.showModal(); };
    // Reloaded on the screen's entry: open it again.
    if (onScreenEntry()) openFromHistory();
    const onPopState = () => {
      // After every other listener of this event: Next.js restores the page it went back to, and only then may the
      // choice's address be pushed (the filter sheet does the same).
      if (waitingForBack.current) { waitingForBack.current = false; setTimeout(finish, 0); return; }
      if (onScreenEntry()) openFromHistory(); else if (dialog.open) dialog.close();
    };
    window.addEventListener('popstate', onPopState);
    const onWide = () => { if (wide?.matches && dialog.open) dialog.close(); };
    wide?.addEventListener?.('change', onWide);
    return () => {
      window.removeEventListener('popstate', onPopState);
      wide?.removeEventListener?.('change', onWide);
    };
  }, [hydrated]);

  const openScreen = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (!onScreenEntry()) window.history.pushState({ ...(window.history.state as object | null), [HISTORY_KEY]: true }, '');
    dialog.showModal();
    const body = dialog.querySelector<HTMLElement>('[data-screen-body]');
    if (body) body.scrollTop = 0;
    // In the press itself, so a phone shows its keyboard.
    dialog.querySelector<HTMLInputElement>('input')?.focus();
  };

  const closeScreen = () => dialogRef.current?.close();

  const onClose = () => {
    setRound(r => r + 1);
    setText('');
    setPart(null);
    setCountry(null);
    boxRef.current?.focus({ preventScroll: true });
    if (onScreenEntry()) { waitingForBack.current = true; window.history.back(); } else {
      const next = pending.current;
      pending.current = null;
      if (next) selectRef.current(next.dest);
    }
  };

  const choose = (dest: Destination) => {
    pending.current = { dest };
    closeScreen();
  };

  const tours = screen?.tours ?? null;
  const countText = (destId: string) => (tours === null ? null : t('dest.tours', { n: formatCount(tours[destId] ?? 0) }));
  const isCurrent = (dest: Destination) =>
    value !== null && value.countryId === dest.countryId && value.regionId === dest.regionId ? 'true' : undefined;

  const shown = showValue && value ? destinationLabel(value, places, t) : null;
  const boxContent = (
    <>
      <span className={styles.icon} aria-hidden="true">⌕</span>
      <span className={shown ? styles.value : styles.placeholder}>{shown ?? placeholder}</span>
    </>
  );
  let box: ReactNode;
  if (hydrated) {
    box = <button ref={boxRef} type="button" className={styles.box} aria-haspopup="dialog" onClick={openScreen}>{boxContent}</button>;
  } else if (fallbackHref !== undefined) {
    box = <SiteLink className={styles.box} href={fallbackHref}>{boxContent}</SiteLink>;
  } else {
    box = <span className={styles.box}>{boxContent}</span>;
  }

  const titleId = `${id}-title`;
  const groups = offeredCountryGroups(places);
  const blank = text.trim() === '';

  return (
    <div className={shown && hydrated ? `${styles.searchBox} ${styles.withClear}` : styles.searchBox}>
      {box}
      {shown && hydrated && (
        <button
          type="button" className={styles.clear} aria-label={t('filter.clearDestination', { dest: shown })}
          onClick={() => onSelect(null)}
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
      {hydrated && (
        <dialog ref={dialogRef} className={styles.screen} aria-labelledby={titleId} onClose={onClose}>
          <h2 id={titleId} className={styles.title}>{t('screen.title')}</h2>
          <div className={styles.head}>
            <button type="button" className={styles.back} aria-label={t('screen.close')} onClick={closeScreen}>
              <span aria-hidden="true">←</span>
            </button>
            <div className={styles.field}>
              <DestinationSearch
                key={round} layout="inline" places={places} t={t} value={null} placeholder={t('dest.placeholder')}
                onSelect={dest => { if (dest) choose(dest); }} onTextChange={setText}
              />
            </div>
          </div>
          <div className={styles.body} data-screen-body="">
            {blank && screen && screen.popular.length > 0 && (
              <section className={styles.section} aria-labelledby={`${id}-popular`}>
                <h3 id={`${id}-popular`} className={styles.sectionTitle}>{t('band.popular')}</h3>
                <ul className={styles.popular}>
                  {screen.popular.flatMap(destId => {
                    const dest = destinationFromId(destId, places);
                    if (!dest) return [];
                    const count = countText(destId);
                    const none = tours !== null && (tours[destId] ?? 0) === 0;
                    const place = places.country(dest.countryId);
                    return [(
                      <li key={destId}>
                        <button
                          type="button" className={styles.pop} disabled={none} aria-current={isCurrent(dest)}
                          onClick={() => choose(dest)}
                        >
                          <span className={styles.popName}>{place ? placeName(place, t.locale) : destId}</span>
                          {count !== null && <>{' '}<span className={styles.popCount}>{count}</span></>}
                        </button>
                      </li>
                    )];
                  })}
                </ul>
              </section>
            )}
            {blank && (
              <section className={styles.section} aria-labelledby={`${id}-browse`}>
                <h3 id={`${id}-browse`} className={styles.sectionTitle}>{t('screen.browse')}</h3>
                <ul className={styles.parts}>
                  {groups.map(g => {
                    const open = part === g.id;
                    const listId = `${id}-part-${g.id}`;
                    return (
                      <li key={g.id}>
                        <button
                          type="button" className={styles.partRow} aria-expanded={open} aria-controls={open ? listId : undefined}
                          onClick={() => { setPart(open ? null : g.id); setCountry(null); }}
                        >
                          <span className={styles.rowName}>{t(`countryGroup.${g.id}`)}</span>
                          <span className={styles.mark} aria-hidden="true">{open ? '▴' : '▾'}</span>
                        </button>
                        {open && (
                          <ul id={listId} className={styles.countries}>
                            {g.countries.map(c => {
                              const whole = choosesWholeCountry(places, c.id);
                              const countryDest: Destination = { countryId: c.id, regionId: null };
                              const countryOpen = country === c.id;
                              const regionsId = `${id}-regions-${c.id}`;
                              const count = countText(c.id);
                              return (
                                <li key={c.id}>
                                  <button
                                    type="button" className={styles.countryRow}
                                    aria-expanded={whole ? undefined : countryOpen}
                                    aria-controls={!whole && countryOpen ? regionsId : undefined}
                                    aria-current={whole ? isCurrent(countryDest) : value?.countryId === c.id ? 'true' : undefined}
                                    onClick={() => (whole ? choose(countryDest) : setCountry(countryOpen ? null : c.id))}
                                  >
                                    <span className={styles.rowName}>{placeName(c, t.locale)}</span>
                                    {count !== null && <>{' '}<span className={styles.rowCount}>{count}</span></>}
                                    <span className={styles.mark} aria-hidden="true">{whole ? '›' : countryOpen ? '▴' : '▾'}</span>
                                  </button>
                                  {countryOpen && (
                                    <ul id={regionsId} className={styles.regions}>
                                      {regionChoices(places, c.id, t).map(choice => {
                                        const regionCount = countText(destinationId(choice.dest));
                                        return (
                                          <li key={choice.key}>
                                            <button
                                              type="button" className={styles.region} aria-current={isCurrent(choice.dest)}
                                              onClick={() => choose(choice.dest)}
                                            >
                                              <span>{choice.label}</span>
                                              {regionCount !== null && <>{' '}<span className={styles.regionCount}>{regionCount}</span></>}
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
