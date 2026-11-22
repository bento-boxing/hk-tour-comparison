// Tests only (lib/test-utils-guard.test.ts): how long a title or description reads in a results line.

/** A text's width in full-width characters: a CJK character or full-width punctuation 1, anything else ½. */
export const fullWidth = (text: string): number => [...text].reduce((n, c) => n + (c.codePointAt(0)! >= 0x2e80 ? 1 : 0.5), 0);

/** The sentences of a text (ended by 。 or by a full stop before a space or the end), empty ones left out. */
export const sentences = (text: string): string[] => text.split(/[。.](?=\s|$)/).filter(s => s.trim() !== '');
