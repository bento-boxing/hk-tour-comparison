// An address's query parameters as Next.js hands them to a page, and the one way the site reads them. No imports, so
// the browser code that reads an address (lib/saved-list.ts) takes nothing else with it.

/** An address's query parameters, as Next.js gives them to a page: a repeated name as a list. */
export type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a parameter, when it is a string at all: only the address's own names are read. */
export function first(raw: RawParams, name: string): string | undefined {
  const value = Object.hasOwn(raw, name) ? raw[name] : undefined;
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text : undefined;
}

/**
 * `first`, typed to take only the names in N: a file that imports this and not `first` cannot read any other name
 * (a call with another is a type error). lib/search-params.ts reads the search address this way.
 */
export function readerOf<N extends string>(): (raw: RawParams, name: N) => string | undefined {
  return first;
}
