import { expect, it } from 'vitest';
import { urlOn } from './url';
import { ISO_DATE } from './patterns';

it('urlOn gives the URL only on exactly the origin', () => {
  expect(urlOn('https://x.test/tour/A?b=1', 'https://x.test')?.pathname).toBe('/tour/A');
  expect(urlOn('https://X.TEST:443/a', 'https://x.test')?.href).toBe('https://x.test/a');
  for (const url of ['http://x.test/a', 'https://x.test:8443/a', 'https://www.x.test/a', 'https://x.test.evil/a', '/a', 'not a url', '']) {
    expect(urlOn(url, 'https://x.test'), url).toBeNull();
  }
});

it('ISO_DATE captures a leading date, alone or before a time', () => {
  expect(ISO_DATE.exec('2026-12-18')?.[1]).toBe('2026-12-18');
  expect(ISO_DATE.exec('2026-12-18T00:00:00')?.[1]).toBe('2026-12-18');
  for (const text of ['2026-12-18 10:00', ' 2026-12-18', '18/12/2026', '2026-12-1']) expect(ISO_DATE.test(text), text).toBe(false);
});
