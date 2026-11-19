import { it, expect } from 'vitest';
import { CONTACT_EMAIL, SITE_URL } from './index';

it('the site address is the bare https domain, with no trailing slash', () => {
  expect(SITE_URL).toBe('https://ganbintuen.com');
});

it('the contact address is on the site domain', () => {
  expect(CONTACT_EMAIL).toBe('hello@ganbintuen.com');
  expect(`https://${CONTACT_EMAIL.split('@')[1]}`).toBe(SITE_URL);
});
