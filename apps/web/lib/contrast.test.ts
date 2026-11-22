import { describe, it, expect } from 'vitest';
import { operatorTagStyle } from './contrast';

// The operator's colour comes from the database: only a #rrggbb colour may reach an inline style, so a stored value
// can never add a declaration of its own (a background image, a position) to a tag, a dot or a leg.

describe('operatorTagStyle', () => {
  it.each(['#0b57d0', '#F5D000', '#aBcDeF', '#000000', '#ffffff'])('lets a #rrggbb colour through, in any case: %s', color => {
    expect(operatorTagStyle(color).style).toEqual({ '--c': color });
  });

  it.each([
    ['a declaration after a colour', 'red; background:url(https://example.test/x.png)'],
    ['a colour followed by a declaration', '#0b57d0; background:url(https://example.test/x.png)'],
    ['a named colour', 'red'],
    ['three digits', '#fff'],
    ['eight digits (with alpha)', '#12345678'],
    ['seven digits', '#1234567'],
    ['five digits', '#12345'],
    ['letters past f', '#GGGGGG'],
    ['no #', '0b57d0'],
    ['a trailing newline', '#0b57d0\n'],
    ['a leading newline', '\n#0b57d0'],
    ['a trailing space', '#0b57d0 '],
    ['a leading space', ' #0b57d0'],
    ['a colour function', 'rgb(1, 2, 3)'],
    ['a custom property', 'var(--op-egl)'],
    ['a closing brace and a new rule', '#0b57d0}body{display:none'],
    ['the empty text', ''],
    ['no colour at all', undefined],
  ])('turns %s into the fallback grey, with light text: %j', (_what, color) => {
    expect(operatorTagStyle(color)).toEqual({ style: { '--c': 'var(--op-fallback)' }, dark: false });
  });

  it('gives dark text where dark reads better (Jetour\'s orange, Big Line\'s green), light text elsewhere', () => {
    expect(operatorTagStyle('#ee7b06').dark).toBe(true);
    expect(operatorTagStyle('#EE7B06').dark).toBe(true);
    expect(operatorTagStyle('#2a9d4b').dark).toBe(true);
    expect(operatorTagStyle('#d62839').dark).toBe(false);
    expect(operatorTagStyle('#50514f').dark).toBe(false);
  });

  it('holds nothing but --c', () => {
    expect(Object.keys(operatorTagStyle('#0b57d0').style)).toEqual(['--c']);
    expect(Object.keys(operatorTagStyle('red; color: blue').style)).toEqual(['--c']);
  });
});
