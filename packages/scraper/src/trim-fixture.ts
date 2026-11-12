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

export interface TrimOptions {
  /**
   * CSS selectors of elements whose text is a list of facts, not prose (day headings, stop
   * lines). Their text is cut only above KEEP_TEXT_LIMIT characters, and a string in page data
   * (JSON, flight data) that repeats such a text exactly is kept up to the same limit.
   */
  keepSelectors?: string[];
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
  if (script.attribs.src !== undefined) return null;
  const type = (script.attribs.type ?? '').trim().toLowerCase();
  if (JSON_SCRIPT_TYPES.includes(type)) return cutStringLiterals(content, keptTexts);
  if (JS_SCRIPT_TYPES.includes(type) && assignsOneValue(content)) return cutStringLiterals(content, keptTexts);
  return null;
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
