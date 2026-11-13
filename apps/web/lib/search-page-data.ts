import { places, type IsoDate } from '@hktours/core';
import { getOperators, searchTours, type Db, type OperatorInfo, type TourCardData } from '@hktours/db/read';
import { parseSearchParams, type SearchState } from './search-params';

export interface SearchPageData {
  state: SearchState;
  tours: TourCardData[];
  /** Every match before paging. */
  total: number;
  operators: OperatorInfo[];
}

/**
 * Everything the search page renders, from the raw address. Database errors are passed on to the caller.
 * The address is untrusted: only what parseSearchParams validated reaches the database.
 */
export async function loadSearchPage(
  db: Db, raw: Record<string, string | string[] | undefined>, today: IsoDate,
): Promise<SearchPageData> {
  const parsed = parseSearchParams(raw, places);
  // The search page has no control for exclusions (that is the chain page's), so an `ex` in the
  // address would filter invisibly, with no way to undo it. It is ignored here.
  const { excludeCountryIds: _ignored, ...filters } = parsed.filters;
  const state: SearchState = { ...parsed, filters };

  const [{ tours, total }, operators] = await Promise.all([
    searchTours(db, { filters, sort: state.sort, page: state.page, today }),
    getOperators(db),
  ]);
  return { state, tours, total, operators };
}
