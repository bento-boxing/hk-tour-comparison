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
 * Every value of a parameter that is a string, joined with commas, for a parameter that holds a comma-separated list:
 * '?op=egl&op=jetour' (what a form's ticked boxes send) reads as 'egl,jetour', as '?op=egl,jetour' does. Undefined
 * when there is none.
 */
export function joined(raw: RawParams, name: string): string | undefined {
  const value = Object.hasOwn(raw, name) ? raw[name] : undefined;
  const texts = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string');
  return texts.length > 0 ? texts.join(',') : undefined;
}

/** `joined`, typed to take only the names in N, as readerOf. */
export function listReaderOf<N extends string>(): (raw: RawParams, name: N) => string | undefined {
  return joined;
}

/**
 * `first`, typed to take only the names in N: a file that imports this and not `first` cannot read any other name
 * (a call with another is a type error). lib/search-params.ts reads the search address this way.
 */
export function readerOf<N extends string>(): (raw: RawParams, name: N) => string | undefined {
  return first;
}
