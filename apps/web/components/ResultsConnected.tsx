'use client';

import { useRouter } from 'next/navigation';
import { encodeChain, places, DEFAULT_GAP, type IsoDate } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { useT } from '../lib/i18n-client';
import { Results } from './Results';

/** `/chain?legs=…&gap=…` for a chain that starts with this tour on this date. */
export function chainStartHref(tour: TourCardData, departure: IsoDate): string {
  const chain = encodeChain({ legs: [{ tourKey: tour.key, departure }], gap: { ...DEFAULT_GAP } });
  const query = new URLSearchParams();
  if (chain.legs) query.set('legs', chain.legs);
  query.set('gap', chain.gap);
  return `/chain?${query}`;
}

// The server page cannot pass t or onAdd (functions) to client components, so this wrapper builds them here.

/** The search results, where picking a date on any card starts a chain with that tour. */
export function ResultsConnected({ tours, total, operators, today }: {
  tours: TourCardData[]; total: number; operators: OperatorInfo[]; today: IsoDate;
}) {
  const t = useT();
  const router = useRouter();
  return (
    <Results
      tours={tours} total={total} operators={operators} places={places} today={today} t={t}
      onAdd={(tour, departure) => router.push(chainStartHref(tour, departure))}
    />
  );
}
