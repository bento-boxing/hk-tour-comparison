import { CHUNK_SEPARATORS, extractStops, places as sharedPlaces, type PlacesIndex, type Stop } from '@hktours/core';

/**
 * Taste Travel's day lines name a choice with `/`: of the hub a flight connects through (`香港 → 杜拜/多哈/伊斯坦堡 →
 * 開羅`, on the first and last days and on the day after an overnight flight), or of the station a train passes
 * (`乘高鐵經深圳北/廣州南站 → 昆明`, `深圳北 / 廣州南站`; the transit word, when there is one, often inside brackets,
 * which the shared rules drop with it). The tour does not go to every alternative, and the shared rules (core
 * stops.ts) read each as a stop: Dubai and Istanbul on an Egypt tour, Shenzhen and Guangzhou on a Yunnan rail tour.
 * So, before the shared rules read the day lines (task 48, from the practice crawl of 2026-11-20, every such chunk of
 * its 311 tours read; narrowed in fix round 1):
 * - a chunk whose alternatives name two or more different places (HUBS_NOT_IN_DATA counting as places) is a choice
 *   of connection, and is taken out, unless the tour visits every place it names anyway (named in a chunk of its
 *   own elsewhere: `峴港/會安` on a tour of both stays);
 * - a lone alternative right next to such a choice is the same connection: the chunk just before it on the same line
 *   (`香港 → 杜拜 → 杜拜/赫爾辛基/伊斯坦堡`), or the first chunk of the next line when the choice ends its line (`杜拜 →
 *   羅馬` the morning after `香港 → 杜拜/赫爾辛基`). It is taken out unless the tour visits that place elsewhere. A
 *   hub named anywhere else (`蘇黎世 → 蘇黎世湖` on a tour that flew in by `杜拜/蘇黎世/法蘭克福`, an Istanbul
 *   stopover day) is a visit and stays;
 * - a chunk naming a place right after 經 (via: `途經深圳北站`, `乘高鐵經廣州南站`) is a place passed on the way, and is
 *   taken out (the shared transit words, 轉機 and the like, do not include it).
 * Hong Kong never counts: it is never a stop. A choice naming one place or none is left as it is: a station named
 * after where the tour goes (`懷化南/鳳凰古城站`), two stations of one city (`桂林北/桂林西站`), a choice of pastimes
 * (`自由活動/購物`).
 */

/** Bracketed notes, exactly as the shared rules drop them before reading (core stops.ts, BRACKETED). */
const BRACKETED = /\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]/;
/** The marks between alternatives, as the shared rules split them (core stops.ts, ALTERNATIVE_SEPARATORS). */
const ALTERNATIVE_SEPARATORS = /[/／]+/;
/** A `/` with spaces around it (`廣州南站 / 深圳北站`): the shared rules would split the alternatives apart at the spaces. */
const SPACED_SLASH = /[^\S\n]*([/／]+)[^\S\n]*/g;
/** A bracketed note or a run of the shared rules' chunk separators: what stands between two chunks. */
const BETWEEN_CHUNKS = new RegExp(`${BRACKETED.source}|${CHUNK_SEPARATORS.source}`, 'g');

type Piece = { text: string; chunk: boolean };

/**
 * The line in pieces: its chunks (the text the shared rules read as one, between bracketed notes and separators;
 * the shared rules replace a bracketed note by a space before splitting, so a chunk never spans one) and what stands
 * between them, a slash's surrounding spaces closed up first.
 */
function piecesOf(line: string): Piece[] {
  const text = line.replace(SPACED_SLASH, '$1');
  const pieces: Piece[] = [];
  let at = 0;
  for (const match of text.matchAll(BETWEEN_CHUNKS)) {
    pieces.push({ text: text.slice(at, match.index), chunk: true }, { text: match[0], chunk: false });
    at = match.index + match[0].length;
  }
  pieces.push({ text: text.slice(at), chunk: true });
  return pieces;
}

const alternativesOf = (chunk: string) => chunk.split(ALTERNATIVE_SEPARATORS).map(part => part.trim()).filter(part => part !== '');
const stopKey = (stop: Stop) => stop.cityId ?? `region:${stop.regionId}`;

/**
 * Flight hubs Taste offers as a connection that the places data does not hold (adding them there would give other
 * operators' tours a stop at a hub they only change planes in): `杜拜/多哈` is a choice of two places.
 */
export const HUBS_NOT_IN_DATA: readonly string[] = ['多哈'];
const HONG_KONG = 'hongkong-hongkong-hongkong';

/** The place a chunk or alternative names, as the shared rules read it (its first stop), or a listed hub. */
function placeOf(text: string, index: PlacesIndex): string | undefined {
  const trimmed = text.trim();
  if (HUBS_NOT_IN_DATA.includes(trimmed)) return `hub:${trimmed}`;
  const stop = extractStops([trimmed], index, []).stops[0];
  return stop === undefined ? undefined : stopKey(stop);
}

/** The places a chunk's alternatives name when they are two or more different ones; otherwise none (no choice). */
function choiceOf(chunk: string, index: PlacesIndex): { alternatives: string[]; places: Set<string> } | undefined {
  const alternatives = alternativesOf(chunk);
  if (alternatives.length < 2) return undefined;
  const places = new Set(alternatives.map(alternative => placeOf(alternative, index)).filter((p): p is string => p !== undefined));
  return places.size >= 2 ? { alternatives, places } : undefined;
}

/** 經 (via): `經深圳北站`, `途經深圳北站`, `乘高鐵經廣州南站`, `途經東京`. */
const VIA = '經';

/**
 * True when a place the shared rules read in the chunk is named right after 經 (via): a station or city the train or
 * flight passes. Not when 經 begins another word (`經典`: `重慶經典小吃`, `經典…廣州站`).
 */
function isPassage(chunk: string, index: PlacesIndex): boolean {
  for (let at = chunk.indexOf(VIA); at !== -1; at = chunk.indexOf(VIA, at + 1)) {
    const after = chunk.slice(at + VIA.length);
    const stop = extractStops([after], index, []).stops[0];
    const place = stop === undefined ? undefined : stop.cityId !== null ? index.city(stop.cityId) : index.region(stop.regionId);
    if (place !== undefined && index.matchNames(place).some(name => name !== '' && after.startsWith(name))) return true;
  }
  return false;
}

/**
 * The tour's day lines without the connections they offer as a choice and the places they pass (see above), each
 * taken out chunk replaced by a space; everything else, bracketed notes and separators included, as it was, except
 * the spaces around a `/`, closed up so that the shared rules read `廣州南站 / 深圳北站轉乘` as the one chunk it is
 * (and drop it whole for its transit word) instead of reading 廣州 from its first half.
 */
export function withoutConnections(lines: string[], index: PlacesIndex = sharedPlaces): string[] {
  const pieces = lines.map(piecesOf);
  type Ref = { line: number; at: number; text: string };
  const chunks: Ref[][] = pieces.map((line, l) => line.flatMap((piece, at) => (piece.chunk && piece.text.trim() !== '' ? [{ line: l, at, text: piece.text }] : [])));
  const key = (ref: Ref) => `${ref.line}:${ref.at}`;
  const choices = new Map<string, NonNullable<ReturnType<typeof choiceOf>>>();
  for (const ref of chunks.flat()) {
    const choice = choiceOf(ref.text, index);
    if (choice !== undefined) choices.set(key(ref), choice);
  }
  // Lone alternatives right next to a choice: the chunk before it on its line, and the next line's first chunk.
  const lone = new Map<string, string>(); // a lone alternative's chunk → its choice's chunk
  const isAlternativeOf = (ref: Ref | undefined, choice: { alternatives: string[] } | undefined) =>
    ref !== undefined && choice !== undefined && !choices.has(key(ref)) && choice.alternatives.includes(ref.text.trim());
  chunks.forEach((line, l) => line.forEach((ref, i) => {
    const choice = choices.get(key(ref));
    if (choice === undefined) return;
    if (isAlternativeOf(line[i - 1], choice)) lone.set(key(line[i - 1]), key(ref));
    if (i === line.length - 1 && isAlternativeOf(chunks[l + 1]?.[0], choice)) lone.set(key(chunks[l + 1][0]), key(ref));
  }));
  const passages = new Set(chunks.flat().filter(ref => isPassage(ref.text, index)).map(key));
  // The places the tour visits: those its other chunks name. A choice stays when the tour visits all it names (a lone
  // alternative beside it counting: `峴港/會安`, then `會安 → …`); a lone alternative beside a choice that goes stays
  // only when a chunk not beside a choice names its place too.
  const placesOf = (refs: Ref[]) => new Set(refs.map(ref => placeOf(ref.text, index)).filter((p): p is string => p !== undefined));
  const others = chunks.flat().filter(ref => !choices.has(key(ref)) && !passages.has(key(ref)));
  const named = placesOf(others);
  const namedApart = placesOf(others.filter(ref => !lone.has(key(ref))));
  const visits = (places: Set<string>) => (place: string | undefined) => place === undefined || place === HONG_KONG || places.has(place);
  const remove = new Set<string>(passages);
  for (const [at, choice] of choices) if (![...choice.places].every(visits(named))) remove.add(at);
  for (const ref of others) {
    const choiceAt = lone.get(key(ref));
    if (choiceAt !== undefined && remove.has(choiceAt) && !visits(namedApart)(placeOf(ref.text, index))) remove.add(key(ref));
  }
  return pieces.map((line, l) => line.map((piece, at) => (remove.has(`${l}:${at}`) ? ' ' : piece.text)).join(''));
}
