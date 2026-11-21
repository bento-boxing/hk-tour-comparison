'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { OperatorId } from '@hktours/core';
import { stateHrefFor } from './operators';
import type { SearchState } from './search-params';

// Which search page the controls are on, for the client components that record a choice in the address (the filter
// row, and the gold band's destination search and country panels). On an operator's page (/operators/<id>) the
// operator is fixed by the path: every choice stays on that page (operatorSearchHref) and the filter row offers no
// operator filter. Everywhere else nothing is provided, and the controls build the search page's addresses
// (searchHref), as they always did. A provider, rather than a prop, because the band's controls are placed by the
// band itself; only the operator's id (a plain string) crosses from the server.

const FixedOperator = createContext<OperatorId | null>(null);

/** Puts the search controls inside it on `operator`'s page. */
export function FixedOperatorProvider({ operator, children }: { operator: OperatorId; children: ReactNode }) {
  return <FixedOperator.Provider value={operator}>{children}</FixedOperator.Provider>;
}

/** The operator the page is fixed to, or null on every other search page. */
export function useFixedOperator(): OperatorId | null {
  return useContext(FixedOperator);
}

/** The address (without a language) of a search state on the page the controls are on. */
export function useSearchHref(): (state: SearchState) => string {
  const operator = useFixedOperator();
  return useMemo(() => stateHrefFor(operator), [operator]);
}
