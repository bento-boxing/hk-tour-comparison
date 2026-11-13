import { places, type IsoDate, type OperatorId } from '@hktours/core';
import { getOperators, searchTours, type Db, type OperatorInfo, type TourCardData } from '@hktours/db/read';
import { parseSearchParams, type SearchState } from './search-params';

export interface SearchPageData {
  state: SearchState;
  tours: TourCardData[];
  /** Every match before paging. */
  total: number;
  /** Every operator, for looking one up by id (a card's name and colour). */
  operators: OperatorInfo[];
  /** The operators the filter bar offers: see filterBarOperators. */
  filterOperators: OperatorInfo[];
}

/**
 * The operators the filter bar offers, in the canonical order: those that have had a good run (the others
 * have no tours), plus any the address selects without one (an old or hand-made link), so that selection
 * still shows by name and can be undone.
 */
export function filterBarOperators(
  all: OperatorInfo[], withGoodRun: OperatorInfo[], selected: OperatorId[] = [],
): OperatorInfo[] {
  const offered = new Set<OperatorId>([...withGoodRun.map(o => o.id), ...selected]);
  return all.filter(o => offered.has(o.id));
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

  const [{ tours, total }, operators, withGoodRun] = await Promise.all([
    searchTours(db, { filters, sort: state.sort, page: state.page, today }),
    getOperators(db),
    getOperators(db, { onlyWithGoodRun: true }),
  ]);
  const filterOperators = filterBarOperators(operators, withGoodRun, filters.operators);
  return { state, tours, total, operators, filterOperators };
}
