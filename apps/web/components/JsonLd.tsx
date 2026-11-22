import { jsonLdText, type JsonLdObject } from '../lib/structured-data';

/**
 * One block of structured data (lib/structured-data.ts): a <script type="application/ld+json">, which browsers do
 * not run. A server component: the text is in the HTML as rendered, and the browser's React leaves it as it is.
 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
