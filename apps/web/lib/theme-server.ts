import { cookies } from 'next/headers';
import { THEME_COOKIE, themeFromCookie, type Theme } from './theme';

/**
 * The theme the visitor chose with the switch, from its cookie; null when they have not chosen (the CSS then
 * follows their system setting). Server components only, like getLocale().
 */
export async function getTheme(): Promise<Theme | null> {
  return themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
}
