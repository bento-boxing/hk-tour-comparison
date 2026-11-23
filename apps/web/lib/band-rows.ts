import { places as allPlaces, type Destination, type PlacesIndex } from '@hktours/core';
import type { DestinationCounts } from '@hktours/db/read';
import type { T } from './i18n';
import { countOf, destinationId, destinationName, isListed, SHORTCUT_COUNT, topDestinations } from './destinations';
import { placeName } from './place-names';
import { SEASON_NAME_KEYS, isSeasonState, seasonSearchHref, type SeasonWindow } from './seasons';
import { searchHref, withFilters, type SearchState } from './search-params';
import type { SeasonCount } from './season-counts';
import { screenData, type ScreenData } from './search-screen';

// The gold band's two rows of boxes (drawing W3), on the home page, a destination's page and a season's page: row 1
// answers "where", row 2 "when". Pressing a box chooses it and keeps the other row's choice (and every other filter);
// a chosen box (white, with ✕) un-chooses it. A box counts what pressing it would list given the other row's choice
// only; a box with nothing to list is faded and is no link. Everything here is worked out on the server from the
// page's own state and the counts it already has (the site-wide counts and the seasons' cached read).

/** How many boxes row 1 shows on wide screens (phones show no destination boxes but a chosen one: task 73). */
export const WIDE_BOXES = SHORTCUT_COUNT;
/** A chosen country's regions: all of them on wide screens up to this many, else the first REGIONS_WIDE. */
export const REGIONS_ALL_UP_TO = 9;
export const REGIONS_WIDE = 8;
/**
 * … and on phones (task 73, drawing Mobile4Results) the regions not chosen, in a row of four columns: all of them up to
 * four, else the first REGIONS_PHONE and the disclosure in the fourth.
 */
export const REGIONS_PHONE = 3;

export interface BandBox {
  /** Stable within its row (a destination's or a season's id). */
  key: string;
  name: string;
  /** What pressing it lists, given the other row's choice. */
  tours: number;
  /** Where it leads (a path without a language); null for a faded box (no tours, not chosen): not a link. */
  path: string | null;
  /** Chosen: white with ✕, and its path un-chooses it (or, for a chosen region, goes back to its country). */
  chosen: boolean;
  /**
   * A region shown only when the row's 全部 {n} 個地區 disclosure is open: on phones (where a chosen region is in the
   * row of chosen boxes instead, so never this), on wide screens.
   */
  moreOnPhone: boolean;
  moreOnWide: boolean;
}

export interface WhereRow {
  /** The row's label (it names the row for screen readers; on phones it names the row of regions). */
  label: string;
  /** A chosen country (or one of its regions) with its regions: the country's box first, then the regions. */
  regions: boolean;
  boxes: BandBox[];
  /**
   * A chosen country with more regions than its boxes show: the disclosure that shows them all (in place), with how
   * many there are; on phones and/or on wide screens.
   */
  moreRegions: { n: number; onWide: boolean; onPhone: boolean } | null;
}

export interface BandRows {
  where: WhereRow;
  when: BandBox[];
  /**
   * The phone band's chips (task 77): every choice, in this order: the country, the region (a region chosen: both),
   * the season. Each is chosen (✕): the country's goes to no destination, the region's to its country, the season's
   * keeps the destination; every other choice stays. The region's and the season's are their row's own chosen boxes.
   */
  chips: BandBox[];
  /** The phone search screen's popular destinations and counts, in the same context as row 1 (task 73). */
  screen: ScreenData;
}

/**
 * The address of a search state: a season's page when its departure window is exactly a season's current days, else
 * the search page's (a destination's page, or '/'): the addresses the search box and the filter bar already produce.
 */
export function bandHref(state: SearchState, windows: SeasonWindow[]): string {
  const season = windows.find(w => isSeasonState(w, state));
  return season ? seasonSearchHref(season, state) : searchHref(state);
}

/** A season's counts as a counts list (its whole line and its destinations' lines). */
function windowCounts(season: SeasonCount): DestinationCounts {
  return { all: { tours: season.count.tours, operators: season.count.operators }, destinations: season.count.destinations ?? [] };
}

const byFrom = (a: SeasonCount, b: SeasonCount) => (a.window.from < b.window.from ? -1 : a.window.from > b.window.from ? 1 : 0);

/**
 * The band's two rows for a page whose search state is `state` (its destination and departure window: the path's
 * choices), from the site-wide counts and every season's counts.
 */
export function bandRows(t: T, state: SearchState, siteCounts: DestinationCounts, seasons: SeasonCount[], places: PlacesIndex = allPlaces): BandRows {
  const windows = seasons.map(s => s.window);
  const chosenSeason = seasons.find(s => isSeasonState(s.window, state)) ?? null;
  const chosenPlace = state.filters.destination ?? null;
  const addressOf = (next: SearchState) => bandHref(next, windows);

  // Row 1, where: counted in the chosen season's days, or site-wide.
  const scope = chosenSeason ? windowCounts(chosenSeason) : siteCounts;
  const toursIn = (d: Destination) => countOf(d, scope).tours;
  const choose = (d: Destination | undefined) => addressOf(withFilters(state, { destination: d }));
  const box = (d: Destination, chosen: boolean, path: string, hide: Partial<Pick<BandBox, 'name' | 'moreOnPhone' | 'moreOnWide'>> = {}): BandBox => {
    const tours = toursIn(d);
    return {
      key: destinationId(d), name: hide.name ?? destinationName(d, places, t), tours, path: chosen || tours > 0 ? path : null, chosen,
      moreOnPhone: false, moreOnWide: false, ...hide,
    };
  };
  const country: Destination | null = chosenPlace && { countryId: chosenPlace.countryId, regionId: null };
  const listedRegions = country
    ? places.regionsOf(country.countryId).map(r => ({ countryId: r.countryId, regionId: r.id })).filter(d => isListed(d, places, siteCounts))
    : [];
  const regionRow = chosenPlace !== null && listedRegions.length > 0
    && (chosenPlace.regionId === null || listedRegions.some(d => d.regionId === chosenPlace.regionId));

  let where: WhereRow;
  if (chosenPlace && country && regionRow) {
    // A country with regions of its own, or one of those regions: the country first, then its regions, most tours
    // first (in the chosen season, ties by the site-wide order).
    const siteOrder = [...listedRegions].sort((a, b) => countOf(b, siteCounts).tours - countOf(a, siteCounts).tours);
    const ordered = chosenSeason ? [...siteOrder].sort((a, b) => toursIn(b) - toursIn(a)) : siteOrder;
    const chosenRegion = chosenPlace.regionId;
    const at = ordered.findIndex(d => d.regionId === chosenRegion);
    // The chosen region first among them when the phones' boxes would leave it out.
    if (at >= REGIONS_PHONE) ordered.unshift(...ordered.splice(at, 1));
    const capWide = ordered.length > REGIONS_ALL_UP_TO;
    const countryChosen = chosenRegion === null;
    // Phones: the regions not chosen (in this order); past the first three behind the disclosure, unless four fit.
    const others = ordered.filter(d => d.regionId !== chosenRegion);
    const capPhone = others.length > REGIONS_PHONE + 1;
    const phoneAt = new Map(others.map((d, i) => [d.regionId, i]));
    where = {
      label: t('band.regionsOf', { place: placeName(places.country(country.countryId)!, t.locale) }),
      regions: true,
      boxes: [
        // The country: chosen on its own page (pressing it un-chooses it); on a region's page, a way to the country.
        box(country, countryChosen, choose(countryChosen ? undefined : country)),
        // A region by its own name (the country's box is just before it): 關西, not 日本關西.
        ...ordered.map((d, i) => box(d, d.regionId === chosenRegion, choose(d.regionId === chosenRegion ? country : d), {
          name: placeName(places.region(d.regionId!)!, t.locale),
          moreOnPhone: capPhone && (phoneAt.get(d.regionId) ?? 0) >= REGIONS_PHONE, moreOnWide: capWide && i >= REGIONS_WIDE,
        })),
      ],
      moreRegions: capWide || capPhone ? { n: ordered.length, onWide: capWide, onPhone: capPhone } : null,
    };
  } else {
    // Nothing chosen: today's top destinations (the same set as the home page, so the row never reshuffles). A
    // destination the rules above do not fit (a country without region pages, an area region…): its box first, chosen,
    // then the top destinations without it.
    const first = chosenPlace ? [chosenPlace] : [];
    const others = topDestinations(places, siteCounts, WIDE_BOXES + 1).map(x => x.destination)
      .filter(d => !first.some(f => f.countryId === d.countryId && f.regionId === d.regionId))
      .slice(0, WIDE_BOXES - first.length);
    where = {
      label: t('band.popular'),
      regions: false,
      boxes: [...first, ...others].map((d, i) => box(d, i < first.length, choose(i < first.length ? undefined : d))),
      moreRegions: null,
    };
  }

  // Row 2, when: the seasons with tours now (and a chosen one whatever its tours), soonest first; counted for the
  // chosen destination, or in all.
  const when = seasons.filter(s => s.count.tours > 0 || s === chosenSeason).sort(byFrom).map(s => {
    const chosen = s === chosenSeason;
    const tours = chosenPlace ? countOf(chosenPlace, windowCounts(s)).tours : s.count.tours;
    const path = chosen
      ? addressOf(withFilters(state, { dateFrom: undefined, dateTo: undefined }))
      : addressOf(withFilters(state, { dateFrom: s.window.from, dateTo: s.window.to }));
    return {
      key: s.window.season, name: t(SEASON_NAME_KEYS[s.window.season].name), tours,
      path: chosen || tours > 0 ? path : null, chosen, moreOnPhone: false, moreOnWide: false,
    };
  });

  // The chips: the country first, chosen, ✕ to no destination (on a country's page, the same as its chosen box); then a
  // chosen region by its own name, ✕ to its country (in the regions row, its own chosen box); then the season's.
  const chips: BandBox[] = [];
  if (chosenPlace && country) {
    chips.push(box(country, true, choose(undefined)));
    if (chosenPlace.regionId !== null) {
      const region = places.region(chosenPlace.regionId);
      const inRow = where.regions ? where.boxes.find(b => b.chosen) : undefined;
      chips.push(inRow ?? box(chosenPlace, true, choose(country), { name: region ? placeName(region, t.locale) : chosenPlace.regionId }));
    }
  }
  chips.push(...when.filter(b => b.chosen));

  return { where, when, chips, screen: screenData(siteCounts, scope, places) };
}
