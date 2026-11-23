/** The address as a URL when it is one on exactly `origin` (scheme, host and port); null for any other text. */
export function urlOn(url: string, origin: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.origin === origin ? parsed : null;
}
