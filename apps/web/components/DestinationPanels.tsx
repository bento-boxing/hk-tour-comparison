'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Destination, PlacesIndex } from '@hktours/core';
import type { T } from '../lib/i18n';
import styles from './DestinationPanels.module.css';

export interface DestinationPanelsProps {
  places: PlacesIndex; t: T;
  value: Destination | null;
  onSelect: (dest: Destination) => void;
  /** Country ids never offered. Default ['hongkong']. */
  hiddenCountryIds?: string[];
}

const DEFAULT_HIDDEN = ['hongkong'];

/**
 * The `按國家選擇` button and its panel: step one lists countries, step two that country's regions
 * with `全部地區` first. A country with one region is selected straight from step one.
 */
export function DestinationPanels({ places, t, value, onSelect, hiddenCountryIds = DEFAULT_HIDDEN }: DestinationPanelsProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [countryId, setCountryId] = useState<string | null>(null); // set while step two shows
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The button to focus after the next step change, so keyboard focus never falls back to the page.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (focusNext.current === null) return;
    panelRef.current?.querySelector<HTMLButtonElement>(focusNext.current)?.focus();
    focusNext.current = null;
  }, [open, countryId]);

  const countries = places.data.countries.filter(c => !hiddenCountryIds.includes(c.id));
  const country = countryId === null ? undefined : places.country(countryId);
  // Step two: 全部地區 first, then the country's regions.
  const regionChoices: { key: string; label: string; dest: Destination }[] = country === undefined ? [] : [
    { key: '', label: t('dest.allRegions'), dest: { countryId: country.id, regionId: null } },
    ...places.regionsOf(country.id).map(r => ({ key: r.id, label: r.nameZh, dest: { countryId: country.id, regionId: r.id } })),
  ];

  const close = () => {
    setOpen(false);
    setCountryId(null);
    toggleRef.current?.focus();
  };

  const choose = (dest: Destination) => {
    onSelect(dest);
    close();
  };

  const chooseCountry = (id: string) => {
    const regions = places.regionsOf(id);
    if (regions.length === 1) return choose({ countryId: id, regionId: regions[0].id });
    focusNext.current = '[data-first]';
    setCountryId(id);
  };

  const back = () => {
    focusNext.current = `[data-country="${countryId}"]`;
    setCountryId(null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
  };

  const isCurrent = (match: boolean) => (match ? 'true' : undefined);
  const chip = (current: boolean) => (current ? `${styles.chip} ${styles.current}` : styles.chip);

  return (
    <div className={styles.panels} onKeyDown={onKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {t('dest.byCountry')}
      </button>
      {open && (
        <div id={panelId} ref={panelRef} className={styles.panel}>
          {country === undefined ? (
            <ul className={styles.list}>
              {countries.map(c => {
                const current = value?.countryId === c.id;
                return (
                  <li key={c.id}>
                    <button type="button" data-country={c.id} className={chip(current)} aria-current={isCurrent(current)} onClick={() => chooseCountry(c.id)}>
                      {c.nameZh}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <div className={styles.head}>
                <button type="button" className={styles.back} onClick={back}>{t('dest.back')}</button>
                <span className={styles.country}>{country.nameZh}</span>
              </div>
              <ul className={styles.list}>
                {regionChoices.map(({ key, label, dest }, i) => {
                  const current = value?.countryId === dest.countryId && value.regionId === dest.regionId;
                  return (
                    <li key={key}>
                      <button type="button" data-first={i === 0 ? '' : undefined} className={chip(current)} aria-current={isCurrent(current)} onClick={() => choose(dest)}>
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
