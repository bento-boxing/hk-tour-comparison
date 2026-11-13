import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/** Elements removed with everything inside them. */
const REMOVED_ELEMENTS = 'style, svg, img, picture, video, iframe, noscript, link';
const REMOVED_ATTRIBUTES = ['style', 'srcset', 'src', 'data-src'];
const JSON_SCRIPT_TYPES = ['application/json', 'application/ld+json'];
/** Script types that hold JavaScript (no type at all also means JavaScript). */
const JS_SCRIPT_TYPES = ['', 'text/javascript', 'application/javascript', 'module'];

const MAX_TEXT = 60;
const MAX_JSON_STRING = 120;
/** Text inside a kept element (see `TrimOptions.keepSelectors`) is cut only above this many characters. */
export const KEEP_TEXT_LIMIT = 300;
const KEPT = 20;
const ELLIPSIS = '…';

/**
 * `name =` (optionally `var`/`let`/`const`, optionally `window.`) at the start of a script,
 * followed by an object or array literal (page state).
 */
const ASSIGNMENT = /^\s*(?:(?:var|let|const)\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*=\s*(?=[{[])/;

/**
 * What a parser reads, for `TrimOptions.allow`. Everything else loses its text.
 */
export interface AllowList {
  /**
   * CSS selectors of the elements whose text the parser reads. Text inside them is cut only above
   * KEEP_TEXT_LIMIT characters, or above `maxChars` for a `{ selector, maxChars }` entry (for an
   * element the parser reads only the start of, such as day-1 prose holding the meeting point).
   */
  selectors: (string | { selector: string; maxChars: number })[];
  /**
   * JSON keys whose string values the parser reads, in JSON scripts, page state scripts, JSON held
   * in attributes and Next.js flight data. Every string nested under such a key is kept too.
   */
  jsonKeys?: string[];
}

export interface TrimOptions {
  /**
   * CSS selectors of elements whose text is a list of facts, not prose (day headings, stop
   * lines). Their text is cut only above KEEP_TEXT_LIMIT characters, and a string in page data
   * (JSON, flight data) that repeats such a text exactly is kept up to the same limit.
   */
  keepSelectors?: string[];
  /**
   * Allow-list mode, in place of `keepSelectors`: a text node is kept only inside an element the
   * parser reads, a JSON string only under a key it reads; all other text becomes empty. Elements,
   * structure, numbers and booleans stay, so the parser's selectors and paths still resolve.
   */
  allow?: AllowList;
}

/** Text kept by `TrimOptions.keepSelectors`: the elements, and every text they hold. */
interface Kept {
  elements: Set<AnyNode>;
  texts: Set<string>;
}

/** Strips everything not needed to parse facts, so no full copy of an operator page is committed. */
export function trimFixture(html: string, opts: TrimOptions = {}): string {
  const isDocument = /^\s*(?:<!doctype|<html[\s>])/i.test(html);
  const $ = load(html, null, isDocument);

  $(REMOVED_ELEMENTS).remove();
  if (opts.allow) {
    trimToAllowList($, opts.allow);
    return isDocument ? $.html() : $.root().html() ?? '';
  }
  const kept = keptText($, opts.keepSelectors ?? []);
  keepFlightData($, kept.texts);
  $('script').each((_, el) => {
    if (el.attribs[FLIGHT_MARK] !== undefined) {
      $(el).removeAttr(FLIGHT_MARK);
      return;
    }
    const content = keptScriptContent(el, $(el).text(), kept.texts);
    if (content === null) $(el).remove();
    else $(el).text(content);
  });
  $('*').each((_, el) => {
    if ('attribs' in el) trimAttributes(el, kept.texts);
  });
  trimNodes($, $.root().contents().toArray(), kept.elements);

  return isDocument ? $.html() : $.root().html() ?? '';
}

/** The elements matching the keep selectors, and the trimmed text of every text node inside them. */
function keptText($: CheerioAPI, selectors: string[]): Kept {
  const kept: Kept = { elements: new Set(), texts: new Set() };
  if (selectors.length === 0) return kept;
  for (const el of $(selectors.join(', ')).toArray()) {
    kept.elements.add(el);
    $(el).find('*').addBack().contents().each((_, node) => {
      if (node.type === 'text' && node.data.trim() !== '') kept.texts.add(node.data.trim());
    });
  }
  return kept;
}

/** Marks the one flight data script `keepFlightData` already trimmed, so it is left alone. */
const FLIGHT_MARK = 'data-trim-fixture-flight';
/** A Next.js flight data chunk: `self.__next_f.push([1,"<payload as a JSON string>"])`. */
const FLIGHT_CHUNK = /^\s*self\.__next_f\.push\(\[1,("(?:[^"\\]|\\[\s\S])*")\]\)\s*;?\s*$/;
/** A flight data text row header at the start of a row: `<id>:T<byte length in hex>,`. */
const FLIGHT_TEXT_ROW = /^([0-9a-f]+):T([0-9a-f]+),/;

/**
 * Next.js (app router) streams page data as flight data chunks. Their payload is joined,
 * trimmed by `trimFlightPayload` and written back as one chunk in place of the first;
 * the other chunks are removed.
 */
function keepFlightData($: CheerioAPI, keptTexts: Set<string>): void {
  const chunks = $('script').toArray()
    .map(el => ({ el, match: FLIGHT_CHUNK.exec($(el).text()) }))
    .filter(chunk => chunk.match !== null);
  if (chunks.length === 0) return;
  const payload = chunks.map(chunk => JSON.parse(chunk.match![1]) as string).join('');
  // Escaping `<` keeps a `</script>` in the data from ending the script, as Next.js itself does.
  const literal = JSON.stringify(trimFlightPayload(payload, keptTexts)).replace(/</g, '\\u003c');
  $(chunks[0].el).text(`self.__next_f.push([1,${literal}])`).attr(FLIGHT_MARK, '');
  for (const chunk of chunks.slice(1)) $(chunk.el).remove();
}

/**
 * Flight data is a list of rows. A text row (`<id>:T<hex byte length>,<text>`) has its text cut
 * like page text, with the length rewritten; in every other row, which is JSON after its
 * `<id>:` prefix, long strings are cut as in JSON scripts.
 */
function trimFlightPayload(payload: string, keptTexts: Set<string>): string {
  let out = '';
  let i = 0;
  while (i < payload.length) {
    const textRow = FLIGHT_TEXT_ROW.exec(payload.slice(i, i + 40));
    if (textRow) {
      const start = i + textRow[0].length;
      const byteLength = parseInt(textRow[2], 16);
      const text = Buffer.from(payload.slice(start, start + byteLength), 'utf8').subarray(0, byteLength).toString('utf8');
      const cut = cutText(text);
      out += `${textRow[1]}:T${Buffer.byteLength(cut, 'utf8').toString(16)},${cut}`;
      i = start + text.length;
      continue;
    }
    const newline = payload.indexOf('\n', i);
    const end = newline === -1 ? payload.length : newline + 1;
    out += cutStringLiterals(payload.slice(i, end), keptTexts);
    i = end;
  }
  return out;
}

/** Attributes whose value is prose shown to people; cut like page text. Links are left whole. */
const PROSE_ATTRIBUTES = ['content', 'alt', 'title', 'aria-label', 'placeholder'];

function trimAttributes(el: Element, keptTexts: Set<string>): void {
  for (const name of Object.keys(el.attribs)) {
    // `on…` attributes are inline event handlers: code, not data.
    if (REMOVED_ATTRIBUTES.includes(name) || /^on/i.test(name)) delete el.attribs[name];
  }
  for (const [name, value] of Object.entries(el.attribs)) {
    if (isJson(value)) el.attribs[name] = cutStringLiterals(value, keptTexts);
    else if (PROSE_ATTRIBUTES.includes(name)) el.attribs[name] = cutText(value);
  }
}

/** True for an attribute value that is a JSON object or array (data some pages keep in attributes). */
function isJson(value: string): boolean {
  if (!/^\s*[[{]/.test(value)) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/** The script's content with long strings cut, or null when the script is code and goes. */
function keptScriptContent(script: Element, content: string, keptTexts: Set<string>): string | null {
  return isDataScript(script, content) ? cutStringLiterals(content, keptTexts) : null;
}

/** True for a JSON script, or an inline script that only assigns one object or array literal (page state). */
function isDataScript(script: Element, content: string): boolean {
  if (script.attribs.src !== undefined) return false;
  const type = (script.attribs.type ?? '').trim().toLowerCase();
  return JSON_SCRIPT_TYPES.includes(type) || (JS_SCRIPT_TYPES.includes(type) && assignsOneValue(content));
}

/** True when the whole script is one assignment of an object or array literal (page state). */
function assignsOneValue(content: string): boolean {
  const match = ASSIGNMENT.exec(content);
  if (!match) return false;
  const end = matchingBracketEnd(content, match[0].length);
  if (end === null) return false;
  return /^\s*;?\s*$/.test(content.slice(end));
}

/**
 * Index just past the bracket matching the one at `start`, skipping string literals,
 * or null if it is never closed.
 */
function matchingBracketEnd(text: string, start: number): number | null {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = stringLiteralEnd(text, i) - 1;
    } else if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

/** Index just past the string literal opening at `start` (or the end of the text if unclosed). */
function stringLiteralEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === quote) return i + 1;
  }
  return text.length;
}

/**
 * Cuts every '…' and "…" string literal longer than MAX_JSON_STRING characters to its first
 * KEPT characters and an ellipsis; one whose value is a kept text is cut only above
 * KEEP_TEXT_LIMIT. Escape sequences count as one character and are never split, so valid
 * JSON (or JavaScript) stays valid.
 */
function cutStringLiterals(code: string, keptTexts: Set<string>): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch !== '"' && ch !== "'" && ch !== '`') {
      out += ch;
      i++;
      continue;
    }
    const end = stringLiteralEnd(code, i);
    const literal = code.slice(i, end);
    out += ch === '`' ? literal : cutLiteral(literal, keptTexts);
    i = end;
  }
  return out;
}

/** One quoted literal, cut if its content is longer than its limit (see `cutStringLiterals`). */
function cutLiteral(literal: string, keptTexts: Set<string>): string {
  const quote = literal[0];
  const closed = literal.length > 1 && literal.endsWith(quote) && !literal.endsWith(`\\${quote}`);
  const body = closed ? literal.slice(1, -1) : literal.slice(1);
  const units = literalUnits(body);
  if (units.length <= MAX_JSON_STRING) return literal;
  if (units.length <= KEEP_TEXT_LIMIT && closed && keptTexts.has(jsonStringValue(literal) ?? '')) return literal;
  return quote + units.slice(0, KEPT).join('') + ELLIPSIS + quote;
}

/** The value of a double-quoted JSON string literal, or null for any other literal. */
function jsonStringValue(literal: string): string | null {
  if (literal[0] !== '"') return null;
  try {
    return (JSON.parse(literal) as string).trim();
  } catch {
    return null;
  }
}

/** The characters of a literal's body, each escape sequence (`\n`, `\uXXXX`, `\x41`) as one unit. */
function literalUnits(body: string): string[] {
  const units: string[] = [];
  for (let i = 0; i < body.length;) {
    if (body[i] === '\\') {
      const escape = /^\\(?:u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/.exec(body.slice(i, i + 10));
      const unit = escape ? escape[0] : '\\';
      units.push(unit);
      i += unit.length;
    } else {
      const unit = String.fromCodePoint(body.codePointAt(i)!);
      units.push(unit);
      i += unit.length;
    }
  }
  return units;
}

/**
 * Removes comments, cuts long text and collapses indentation, everywhere except inside kept
 * scripts; inside `pre` and `textarea` the whitespace is left as it is, and inside kept
 * elements text is cut only above KEEP_TEXT_LIMIT.
 */
function trimNodes(
  $: CheerioAPI,
  nodes: AnyNode[],
  keptElements: Set<AnyNode>,
  keepWhitespace = false,
  maxText = MAX_TEXT,
): void {
  for (const node of nodes) {
    if (node.type === 'comment') {
      $(node).remove();
    } else if (node.type === 'text') {
      const cut = cutText(node.data, maxText);
      node.data = keepWhitespace ? cut : collapseIndentation(cut);
    } else if ('children' in node && node.type !== 'script') {
      const name = 'name' in node ? node.name : '';
      trimNodes(
        $,
        [...node.children],
        keptElements,
        keepWhitespace || WHITESPACE_KEPT_IN.includes(name),
        keptElements.has(node) ? KEEP_TEXT_LIMIT : maxText,
      );
    }
  }
}

/** Elements whose whitespace is shown as written, so their text is left exactly as it is. */
const WHITESPACE_KEPT_IN = ['pre', 'textarea'];

/** Every run of whitespace that holds a line break becomes one line break; a browser shows both alike. */
function collapseIndentation(text: string): string {
  return text.replace(/[ \t\r\f]*\n\s*/g, '\n');
}

/** A text run longer than `max` characters, cut to its first KEPT characters and an ellipsis. */
function cutText(text: string, max = MAX_TEXT): string {
  const trimmed = text.trim();
  const chars = Array.from(trimmed);
  if (chars.length <= max) return text;
  return chars.slice(0, KEPT).join('') + ELLIPSIS;
}

// ---- Allow-list mode -------------------------------------------------------------------------

/** Attributes that carry text shown to people; outside allowed elements they are removed. */
const TEXT_ATTRIBUTES = ['title', 'alt', 'aria-label', 'content', 'placeholder', 'value'];
const HAN = /\p{Script=Han}/u;

function trimToAllowList($: CheerioAPI, allow: AllowList): void {
  const limits = allowedElements($, allow.selectors);
  const keys = new Set(allow.jsonKeys ?? []);
  const isAllowed = (el: AnyNode): boolean => limitFor(el, limits) !== null;

  allowFlightData($, keys);
  $('script').each((_, el) => {
    if (el.attribs[FLIGHT_MARK] !== undefined) {
      $(el).removeAttr(FLIGHT_MARK);
      return;
    }
    const content = $(el).text();
    if (isDataScript(el, content)) $(el).text(allowedStrings(content, keys));
    else $(el).remove();
  });
  $('*').each((_, el) => {
    if ('attribs' in el) allowAttributes(el, keys, isAllowed(el));
  });
  allowNodes($, $.root().contents().toArray(), limits);
}

/** Each element matching an allow selector, with the most characters of text it may keep. */
function allowedElements($: CheerioAPI, selectors: AllowList['selectors']): Map<AnyNode, number> {
  const limits = new Map<AnyNode, number>();
  for (const entry of selectors) {
    const { selector, maxChars } = typeof entry === 'string' ? { selector: entry, maxChars: KEEP_TEXT_LIMIT } : entry;
    const limit = Math.min(maxChars, KEEP_TEXT_LIMIT);
    for (const el of $(selector).toArray()) limits.set(el, Math.min(limits.get(el) ?? KEEP_TEXT_LIMIT, limit));
  }
  return limits;
}

/** The limit of the nearest allowed element holding the node (or the node itself), or null outside them. */
function limitFor(node: AnyNode, limits: Map<AnyNode, number>): number | null {
  for (let at: AnyNode | null = node; at !== null; at = at.parent) {
    const limit = limits.get(at);
    if (limit !== undefined) return limit;
  }
  return null;
}

/**
 * Removes comments; inside allowed elements cuts text above its limit, elsewhere empties every text
 * node. Whitespace-only text between elements is kept, collapsed as in `trimNodes`.
 */
function allowNodes($: CheerioAPI, nodes: AnyNode[], limits: Map<AnyNode, number>, keepWhitespace = false): void {
  for (const node of nodes) {
    if (node.type === 'comment') {
      $(node).remove();
    } else if (node.type === 'text') {
      const limit = limitFor(node, limits);
      if (limit === null && node.data.trim() !== '') node.data = '';
      else if (limit !== null) node.data = cutText(node.data, limit);
      if (!keepWhitespace) node.data = collapseIndentation(node.data);
    } else if ('children' in node && node.type !== 'script') {
      const name = 'name' in node ? node.name : '';
      allowNodes($, [...node.children], limits, keepWhitespace || WHITESPACE_KEPT_IN.includes(name));
    }
  }
}

/**
 * Removes style, src and event handler attributes everywhere. JSON held in an attribute keeps only
 * allowed strings. Outside allowed elements, text attributes (TEXT_ATTRIBUTES) and any other
 * attribute holding Chinese text (see `holdsChinese`) are removed; inside them, text attributes are cut above KEEP_TEXT_LIMIT.
 */
function allowAttributes(el: Element, keys: Set<string>, allowed: boolean): void {
  for (const [name, value] of Object.entries(el.attribs)) {
    if (REMOVED_ATTRIBUTES.includes(name) || /^on/i.test(name)) delete el.attribs[name];
    else if (isJson(value)) el.attribs[name] = allowedStrings(value, keys);
    else if (allowed) el.attribs[name] = TEXT_ATTRIBUTES.includes(name) ? cutText(value, KEEP_TEXT_LIMIT) : value;
    else if (TEXT_ATTRIBUTES.includes(name) || holdsChinese(value)) delete el.attribs[name];
  }
}

/** True when the value holds a Chinese character, as written or percent-encoded (a link's `?text=…`). */
function holdsChinese(value: string): boolean {
  if (HAN.test(value)) return true;
  try {
    return HAN.test(decodeURIComponent(value));
  } catch {
    return false; // not valid percent-encoding: nothing hidden in it
  }
}

/** Flight data as in `keepFlightData`, with `allowedFlightPayload` in place of `trimFlightPayload`. */
function allowFlightData($: CheerioAPI, keys: Set<string>): void {
  const chunks = $('script').toArray()
    .map(el => ({ el, match: FLIGHT_CHUNK.exec($(el).text()) }))
    .filter(chunk => chunk.match !== null);
  if (chunks.length === 0) return;
  const payload = chunks.map(chunk => JSON.parse(chunk.match![1]) as string).join('');
  const literal = JSON.stringify(allowedFlightPayload(payload, keys)).replace(/</g, '\\u003c');
  $(chunks[0].el).text(`self.__next_f.push([1,${literal}])`).attr(FLIGHT_MARK, '');
  for (const chunk of chunks.slice(1)) $(chunk.el).remove();
}

/**
 * Text rows (`<id>:T<hex byte length>,<text>`) lose their text (`<id>:T0,`): no parser reads them.
 * Every other row keeps only allowed strings (see `allowedStrings`).
 */
function allowedFlightPayload(payload: string, keys: Set<string>): string {
  let out = '';
  let i = 0;
  while (i < payload.length) {
    const textRow = FLIGHT_TEXT_ROW.exec(payload.slice(i, i + 40));
    if (textRow) {
      const start = i + textRow[0].length;
      const byteLength = parseInt(textRow[2], 16);
      const text = Buffer.from(payload.slice(start, start + byteLength), 'utf8').subarray(0, byteLength).toString('utf8');
      out += `${textRow[1]}:T0,`;
      i = start + text.length;
      continue;
    }
    const newline = payload.indexOf('\n', i);
    const end = newline === -1 ? payload.length : newline + 1;
    out += allowedStrings(payload.slice(i, end), keys);
    i = end;
  }
  return out;
}

interface Frame { kind: '{' | '['; underAllowedKey: boolean; key: string | null }

const KEY_FOLLOWS = /\s*:/y;
const IDENTIFIER_KEY = /[A-Za-z_$][\w$]*(?=\s*:)/y;

/**
 * JSON (or a JavaScript object literal) with every string value emptied unless its key is allowed
 * or it sits anywhere under an allowed key; kept strings are cut above KEEP_TEXT_LIMIT. Keys,
 * numbers, booleans, null and the layout of the text are left exactly as they are, so the result
 * is valid wherever the input was.
 */
function allowedStrings(code: string, keys: Set<string>): string {
  const stack: Frame[] = [];
  const valueAllowed = (): boolean => {
    const frame = stack.at(-1);
    if (frame === undefined) return false;
    return frame.underAllowedKey || (frame.kind === '{' && frame.key !== null && keys.has(frame.key));
  };
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const frame = stack.at(-1);
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = stringLiteralEnd(code, i);
      const literal = code.slice(i, end);
      KEY_FOLLOWS.lastIndex = end;
      if (frame?.kind === '{' && ch !== '`' && KEY_FOLLOWS.test(code)) {
        frame.key = literalValue(literal);
        out += literal;
      } else {
        out += valueAllowed() ? cutLiteralAt(literal, KEEP_TEXT_LIMIT) : ch + ch;
      }
      i = end;
      continue;
    }
    if (frame?.kind === '{') {
      IDENTIFIER_KEY.lastIndex = i;
      const identifier = IDENTIFIER_KEY.exec(code);
      if (identifier && !/[\w$]/.test(code[i - 1] ?? '')) {
        frame.key = identifier[0];
        out += identifier[0];
        i += identifier[0].length;
        continue;
      }
    }
    if (ch === '{' || ch === '[') stack.push({ kind: ch, underAllowedKey: valueAllowed(), key: null });
    else if (ch === '}' || ch === ']') stack.pop();
    else if (ch === ',' && frame?.kind === '{') frame.key = null;
    out += ch;
    i++;
  }
  return out;
}

/** The text of a quoted literal used as a key. */
function literalValue(literal: string): string {
  if (literal[0] === '"') {
    try {
      return JSON.parse(literal) as string;
    } catch {
      // not valid JSON: fall through to the raw text
    }
  }
  return literal.slice(1, -1);
}

/** One quoted literal, cut to KEPT characters and an ellipsis if its content is longer than `max`. */
function cutLiteralAt(literal: string, max: number): string {
  const quote = literal[0];
  const closed = literal.length > 1 && literal.endsWith(quote) && !literal.endsWith(`\\${quote}`);
  const units = literalUnits(closed ? literal.slice(1, -1) : literal.slice(1));
  if (units.length <= max) return literal;
  return quote + units.slice(0, KEPT).join('') + ELLIPSIS + quote;
}
