// Text helpers shared by the operators (task 62). The operators clean text in three different ways; each way has its
// own name here, and each operator keeps the one it used before.

const WHITESPACE_RUN = /\s+/g;
/** Zero-width space, non-joiner and joiner, and the byte order mark. */
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/** Text with runs of whitespace (line breaks and no-break spaces included) as one space, trimmed. */
export function collapseWhitespace(text: string): string {
  return text.replace(WHITESPACE_RUN, ' ').trim();
}

/** A JSON value's text: a string as collapseWhitespace gives it, '' for anything else. */
export function jsonText(value: unknown): string {
  return typeof value === 'string' ? collapseWhitespace(value) : '';
}

/** Text without zero-width characters, then as collapseWhitespace gives it. */
export function collapseWhitespaceWithoutZeroWidth(text: string): string {
  return collapseWhitespace(text.replace(ZERO_WIDTH, ''));
}

/**
 * Text in Unicode NFC (a CJK compatibility ideograph, U+F900 to U+FAFF, as its ordinary character), then as
 * collapseWhitespace gives it.
 */
export function collapseWhitespaceNfc(text: string): string {
  return collapseWhitespace(text.normalize('NFC'));
}

/** The URL without its query string and fragment (everything from the first `?` or `#`). */
export function withoutQueryOrFragment(url: string): string {
  return url.replace(/[?#].*$/, '');
}
