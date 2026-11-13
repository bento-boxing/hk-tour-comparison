'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { suggestRegions, ALL_REGIONS_LABEL, type Destination, type PlacesIndex, type Suggestion } from '@hktours/core';
import type { T } from '../lib/i18n';
import styles from './DestinationSearch.module.css';

export interface DestinationSearchProps {
  places: PlacesIndex; t: T;
  value: Destination | null;
  onSelect: (dest: Destination | null) => void;
}

/** '日本 → 關西', or '日本 → 全部地區' when regionId is null. Same wording as the suggestion labels. */
export function destinationLabel(dest: Destination, places: PlacesIndex): string {
  const country = places.country(dest.countryId)?.nameZh ?? dest.countryId;
  const region = dest.regionId === null ? ALL_REGIONS_LABEL : places.region(dest.regionId)?.nameZh ?? dest.regionId;
  return `${country} → ${region}`;
}

const HINT_CITY_COUNT = 4;

/** The first four cities of the suggested region, the matched city first. None for a whole country. */
function hintCities(s: Suggestion, places: PlacesIndex): string[] {
  if (s.destination.regionId === null) return [];
  const names = places.citiesOf(s.destination.regionId).map(c => c.nameZh);
  const ordered = s.via === null ? names : [s.via, ...names.filter(n => n !== s.via)];
  return ordered.slice(0, HINT_CITY_COUNT);
}

const keyOf = (dest: Destination | null) => (dest ? `${dest.countryId}:${dest.regionId ?? ''}` : '');

/**
 * The destination search bar (mockup `.search` / `.sugg`): a WAI-ARIA combobox whose listbox offers
 * `Country → Region` suggestions. Only choosing an option (or clearing) calls onSelect.
 */
export function DestinationSearch({ places, t, value, onSelect }: DestinationSearchProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(() => (value ? destinationLabel(value, places) : ''));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted option; -1 for none

  // A new value from outside (panels, filter bar, address) replaces the text.
  const [shownKey, setShownKey] = useState(keyOf(value));
  if (shownKey !== keyOf(value)) {
    setShownKey(keyOf(value));
    setText(value ? destinationLabel(value, places) : '');
    setOpen(false);
    setActive(-1);
  }

  const suggestions = useMemo(() => suggestRegions(text, places), [text, places]);
  const blank = text.trim() === '';
  const listOpen = open && suggestions.length > 0;
  const noMatch = open && !blank && suggestions.length === 0;
  const enterTarget = active >= 0 ? active : 0; // shown as the hit row, as in the mockup

  const close = () => { setOpen(false); setActive(-1); };

  const choose = (s: Suggestion) => {
    onSelect(s.destination);
    setText(s.label);
    close();
  };

  const clear = () => {
    onSelect(null);
    setText('');
    close();
    inputRef.current?.focus();
  };

  const move = (step: 1 | -1) => {
    const n = suggestions.length;
    if (n === 0) return;
    setOpen(true);
    setActive(a => (a < 0 ? (step === 1 ? 0 : n - 1) : (a + step + n) % n));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Keys pressed while an input method is composing (Cangjie, pinyin…) belong to the IME.
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Enter':
        if (!open) return;
        e.preventDefault();
        if (suggestions.length > 0) choose(suggestions[enterTarget]);
        break;
      case 'Escape':
        if (open) { e.preventDefault(); close(); }
        break;
    }
  };

  return (
    <div className={styles.search}>
      <div className={value ? `${styles.field} ${styles.withClear}` : styles.field}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-label={t('dest.placeholder')}
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listboxId : undefined}
          aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          placeholder={t('dest.placeholder')}
          value={text}
          onChange={e => { setText(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={onKeyDown}
          onBlur={close}
        />
        {value && (
          <button type="button" className={styles.clear} onClick={clear}>{t('dest.clear')}</button>
        )}
      </div>
      {listOpen && (
        <ul id={listboxId} role="listbox" aria-label={t('dest.placeholder')} className={styles.sugg}>
          {suggestions.map((s, i) => {
            const cities = hintCities(s, places);
            return (
              <li
                key={keyOf(s.destination)}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={i === enterTarget ? `${styles.option} ${styles.hit}` : styles.option}
                // Keep focus in the input so the click lands before blur closes the list.
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(s)}
              >
                <span className={styles.label}>{s.label}</span>
                {cities.length > 0 && (
                  <>{' '}<small className={styles.hint}>{t('dest.includes', { cities: cities.join('、') })}</small></>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* Always present so screen readers announce the message when it appears. */}
      <div role="status" className={noMatch ? styles.sugg : undefined}>
        {noMatch && <div className={styles.none}>{t('dest.none')}</div>}
      </div>
    </div>
  );
}
