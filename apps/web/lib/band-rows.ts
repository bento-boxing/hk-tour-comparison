import { places as allPlaces, type Destination, type IsoDate, type PlacesIndex } from '@hktours/core';
import type { DestinationCounts } from '@hktours/db/read';
import type { T } from './i18n';
import { countOf, destinationId, destinationName, isListed, SHORTCUT_COUNT, topDestinations } from './destinations';
import { placeName } from './place-names';
import { SEASON_NAME_KEYS, isSeasonState, seasonSearchHref, type SeasonId, type SeasonWindow } from './seasons';
import { searchHref, withFilters, type SearchState } from './search-params';
import type { MonthCount, SeasonCount } from './season-counts';
import { formatChipDate, monthName } from './format';
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
   * The phone band's chips (task 77): the destination's choices, in this order: the country, the region (a region
   * chosen: both). Each is chosen (✕): the country's goes to no destination, the region's to its country; every other
   * choice stays (the season too). The region's is its row's own chosen box. The season is not a chip: the phone's
   * date field shows it (task 78, bandDates).
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
  // chosen region by its own name, ✕ to its country (in the regions row, its own chosen box).
  const chips: BandBox[] = [];
  if (chosenPlace && country) {
    chips.push(box(country, true, choose(undefined)));
    if (chosenPlace.regionId !== null) {
      const region = places.region(chosenPlace.regionId);
      const inRow = where.regions ? where.boxes.find(b => b.chosen) : undefined;
      chips.push(inRow ?? box(chosenPlace, true, choose(country), { name: region ? placeName(region, t.locale) : chosenPlace.regionId }));
    }
  }

  return { where, when, chips, screen: screenData(siteCounts, scope, places) };
}

/** How many months the phone date sheet offers at most (task 78). */
export const SHEET_MONTHS = 8;

/** A festival in the phone date sheet: the band's season box, with its dates. */
export interface DateFestival {
  key: SeasonId; name: string;
  /** Its days, short: '12/19–27' (English '19–27 Dec'). */
  days: string;
  window: SeasonWindow;
  /** As the band's season box counts it: in the chosen destination, or in all; null to show none. */
  tours: number | null;
  /** No tours (and not the page's own): faded, not choosable, as the band's box was. */
  enabled: boolean;
}

/** A month in the phone date sheet: '12月' (English 'Dec'), and its days. */
export interface DateMonth { key: string; label: string; from: IsoDate; to: IsoDate }

/**
 * The phone band's date field and its sheet (task 78), from the page's state, its rows (the season boxes: their counts
 * and addresses) and the months' counts. Every address is one the site already makes: a festival leaving in its days
 * is its season's page (the season box's address), anything else the page's own address with from/to or tfrom/tto
 * (the client builds those, as the filter sheet does).
 */
export interface BandDates {
  /**
   * What the field shows, or null for its placeholder: a season ('聖誕 · 12/19 – 12/27'), else the departure window
   * ('12/19 – 12/27 出發'), else the travel window ('12/19 – 12/27 內來回'). With both windows set (from a wide
   * screen, an old link) it shows the departure window, and the filter sheet keeps a section for the other.
   */
  value: string | null;
  /** Where ✕ goes: the same page with no dates at all (neither window), every other choice kept; null with none set. */
  clearPath: string | null;
  festivals: DateFestival[];
  /** This month and the next ones with tours here (in the chosen destination, or in all), at most SHEET_MONTHS. */
  months: DateMonth[];
}

/** '12/19–27', '12/30–1/3' (English '19–27 Dec', '30 Dec – 3 Jan'): a festival's days, without the year. */
export function shortDays(from: IsoDate, to: IsoDate, t: T): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (t.locale === 'en') return fm === tm ? `${fd}–${td} ${monthName(fm, t)}` : `${fd} ${monthName(fm, t)} – ${td} ${monthName(tm, t)}`;
  return fm === tm ? `${fm}/${fd}–${td}` : `${fm}/${fd}–${tm}/${td}`;
}

/** '12/19 – 12/27', '12/19 –', '– 12/27' (a date outside today's year with its year), as the filter row's date pill. */
function rangeText(from: IsoDate | undefined, to: IsoDate | undefined, today: IsoDate, t: T): string {
  const date = (d: IsoDate) => formatChipDate(d, today, t);
  if (from && to) return `${date(from)} – ${date(to)}`;
  return from ? `${date(from)} –` : `– ${date(to!)}`;
}

/** The phone band's date field and sheet (BandDates) for a page with these rows. */
export function bandDates(
  t: T, state: SearchState, rows: BandRows, seasons: SeasonCount[], months: MonthCount[], today: IsoDate,
): BandDates {
  const f = state.filters;
  const windows = seasons.map(s => s.window);
  const chosenSeason = seasons.find(s => isSeasonState(s.window, state)) ?? null;
  let value: string | null = null;
  if (chosenSeason) {
    value = `${t(SEASON_NAME_KEYS[chosenSeason.window.season].name)} · ${rangeText(chosenSeason.window.from, chosenSeason.window.to, today, t)}`;
  } else if (f.dateFrom || f.dateTo) {
    value = t('dates.leaving', { dates: rangeText(f.dateFrom, f.dateTo, today, t) });
  } else if (f.travelFrom || f.travelTo) {
    value = t('dates.within', { dates: rangeText(f.travelFrom, f.travelTo, today, t) });
  }
  const set = Boolean(f.dateFrom || f.dateTo || f.travelFrom || f.travelTo);
  const clearPath = set
    ? bandHref(withFilters(state, { dateFrom: undefined, dateTo: undefined, travelFrom: undefined, travelTo: undefined }), windows)
    : null;

  const festivals = rows.when.flatMap(box => {
    const season = seasons.find(s => s.window.season === box.key);
    if (!season) return [];
    const w = season.window;
    return [{ key: w.season, name: box.name, days: shortDays(w.from, w.to, t), window: w, tours: box.tours, enabled: box.path !== null }];
  });

  const place = state.filters.destination ?? null;
  const toursIn = (m: MonthCount) => (place
    ? countOf(place, { all: { tours: m.count.tours, operators: m.count.operators }, destinations: m.count.destinations ?? [] }).tours
    : m.count.tours);
  const monthList = months.filter(m => toursIn(m) > 0).slice(0, SHEET_MONTHS).map(m => ({
    key: m.window.from.slice(0, 7), label: monthName(Number(m.window.from.slice(5, 7)), t), from: m.window.from, to: m.window.to,
  }));
  return { value, clearPath, festivals, months: monthList };
}
