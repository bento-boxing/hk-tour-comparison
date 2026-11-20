'use client';

import { useRouter } from 'next/navigation';
import { places, type IsoDate } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import type { TourRow } from '../lib/tour-row';
import { useT } from '../lib/i18n-client';
import { localeHref } from '../lib/locale-path';
import { chainStartHref } from '../lib/chain-href';
import { Results } from './Results';

// The server page cannot pass t or onAdd (functions) to client components, so this wrapper builds them here.

/** The search results, where picking a date on any card starts a chain with that tour (in the page's language). */
export function ResultsConnected({ tours, total, operators, today, now, clearPath }: {
  tours: TourRow[]; total: number; operators: OperatorInfo[]; today: IsoDate;
  /** The server's time of this render (ISO), for the rows' old-data warning. */
  now?: string;
  /** Where the empty state's clear-all link goes (see Results); the search page by default. */
  clearPath?: string;
}) {
  const t = useT();
  const router = useRouter();
  return (
    <Results
      tours={tours} total={total} operators={operators} places={places} today={today} now={now} t={t} clearPath={clearPath}
      onAdd={(tour, departure) => router.push(localeHref(t.locale, chainStartHref(tour.key, departure)))}
    />
  );
}
