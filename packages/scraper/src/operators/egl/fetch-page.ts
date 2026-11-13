import type { Fetcher } from '../../types';
import { datesUrl } from './discover';
import { pageTourCode } from './parse';

/** What `parse` needs for one tour: the page, and the dates JSON (null when the page states no tour code). */
export interface FetchedPage { html: string; datesJson: string | null }

/** The page and its dates as the one text the pipeline hands to `parse`. */
export function joinPage(html: string, datesJson: string | null): string {
  return JSON.stringify({ html, datesJson });
}

/** The page and dates of a `joinPage` text; null for any other text. */
export function splitPage(text: string): FetchedPage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { html, datesJson } = value as Record<string, unknown>;
  if (typeof html !== 'string' || (datesJson !== null && typeof datesJson !== 'string')) return null;
  return { html, datesJson };
}

/**
 * One EGL tour: its page, then (for the tour code the page states) its dates JSON, both through the run's
 * fetcher, which spaces them like any other request. null, a page not fetched, when either request fails.
 * A page with no tour code gets no dates request; `parse` then rejects it as not a tour.
 */
export async function fetchPage(fetcher: Fetcher, url: string): Promise<string | null> {
  const html = await fetcher.fetchText(url);
  if (html === null) return null;
  const code = pageTourCode(html);
  if (code === null) return joinPage(html, null);
  const datesJson = await fetcher.fetchText(datesUrl(code));
  return datesJson === null ? null : joinPage(html, datesJson);
}
