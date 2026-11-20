import type { TourCardData } from '@hktours/db/read';

/**
 * A tour as the pages hand it to the browser: everything a row uses, without the tour's own name. The row never shows
 * the name (the owner wants people on the operator's page), so it is not sent: the database read keeps it, the loaders
 * drop it (withoutTitle).
 */
export type TourRow = Omit<TourCardData, 'title'>;

/** The tour without its name. */
export function withoutTitle(tour: TourCardData | TourRow): TourRow {
  const { title: _title, ...row } = tour as TourCardData;
  return row;
}
