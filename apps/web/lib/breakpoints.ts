// The site's two layouts (task 74): the phone layout below WIDE_FROM, the wide layout from it. Stylesheets cannot read
// these (a media query takes no custom property), so they write the same numbers, (max-width: 1023px) and
// (min-width: 1024px), and lib/breakpoints.test.ts fails on any stylesheet or script that writes another width for
// this purpose. Change them together: here, in every stylesheet, and in that test's list.

/** The first width of the wide layout, in CSS px. */
export const WIDE_FROM = 1024;
/** The phone layout's media query (CSS: `@media (max-width: 1023px)`). */
export const PHONE_MEDIA = `(max-width: ${WIDE_FROM - 1}px)`;
/** The wide layout's media query (CSS: `@media (min-width: 1024px)`). */
export const WIDE_MEDIA = `(min-width: ${WIDE_FROM}px)`;

/**
 * From this width up to WIDE_FROM - 1 (tablets upright, half-width desktop windows) the phone layout is drawn in a
 * centred column of PHONE_COLUMN_PX (CSS: `@media (min-width: 640px) and (max-width: 1023px)`, and site-frame's
 * `max-width: 720px`); the header, the band's colour and the bottom bar still span the window.
 */
export const PHONE_COLUMN_FROM = 640;
/** The phone column's width, its 16px sides included (site-frame.module.css .wrap under WIDE_FROM). */
export const PHONE_COLUMN_PX = 720;
