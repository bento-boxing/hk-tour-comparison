import type { IsoDate } from '@hktours/core';
import type { Db, OperatorInfo } from '@hktours/db/read';
import { withoutTitle, type TourRow } from './tour-row';
import type { Reads } from './cached-reads';
import type { RawParams } from './raw-params';
import { parseSavedKeys } from './saved-list';
import { uncachedReads } from './search-page-data';

export interface SavedPageData {
  /** The tour keys the address asks for (validated, each once, at most SAVED_CAP), in its order: newest saved first. */
  asked: string[];
  /** How many parts of the address's list were left out (unreadable, repeated, past the cap). */
  dropped: number;
  /** The asked tours that are listed now, in the asked order; a key without one is no longer listed. */
  tours: TourRow[];
  /** Every operator, for the rows' names and colours and the no-longer-listed lines. Empty when nothing was asked. */
  operators: OperatorInfo[];
}

/**
 * Everything the saved page renders, from the raw address (`t`, the list the browser keeps: see lib/saved-list.ts).
 * The address is untrusted: only keys parseSavedKeys validated reach the database, through the cached getToursByKeys
 * (and getOperators), so a list costs no statement on a warm cache and at most a fixed handful on a cold one. With no
 * key, the database is not asked at all (`connect` is not called). Database errors are passed on to the caller.
 */
export async function loadSavedPage(
  connect: () => Promise<Db>, raw: RawParams, today: IsoDate, reads: Reads = uncachedReads,
): Promise<SavedPageData> {
  const { keys, dropped } = parseSavedKeys(raw);
  if (keys.length === 0) return { asked: [], dropped, tours: [], operators: [] };
  const db = await connect();
  const [found, operators] = await Promise.all([reads.getToursByKeys(db, keys, today), reads.getOperators(db)]);
  // The tours' own names are not shown, so they are not sent to the browser.
  const tours = keys.flatMap(key => {
    const tour = found.get(key);
    return tour ? [withoutTitle(tour)] : [];
  });
  return { asked: keys, dropped, tours, operators };
}
