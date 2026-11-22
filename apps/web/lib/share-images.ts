import type { Locale, T } from './i18n';
import made from './share-images.json';

// The sharing images (og:image, and twitter:image through it): one static picture per language, 1200×630, in
// public/share/, made by scripts/make-share-images.mjs, which also writes share-images.json (each file's name, size
// and the line it shows; lib/share-images.test.ts checks them against the files and the dictionaries). Static files:
// no function runs to serve them, and the stored pages stay stored. Each file's name carries the start of its
// SHA-256, so a changed picture gets a new address (services keep a picture by its address); the address has no query
// string, which robots.txt keeps crawlers (Twitterbot among them) away from.

export interface ShareImage {
  /** Its path under public/ (and so its address on the site, after a '/'). */
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  /** The line it shows under the site name: dictionary key share.line, as it was when the picture was made. */
  line: string;
}

export const SHARE_IMAGES: Record<Locale, ShareImage> = made;

/** The page's Open Graph image in its language: address (relative to the site address), size, type and alt text. */
export function shareImage(t: T) {
  const image = SHARE_IMAGES[t.locale];
  return { url: `/${image.file}`, width: image.width, height: image.height, type: 'image/png', alt: t('share.imageAlt') };
}
