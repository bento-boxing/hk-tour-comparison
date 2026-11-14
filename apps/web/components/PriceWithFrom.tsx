import type { T } from '../lib/i18n';

/**
 * A price marked as the lowest ("from"), with the marker where the language puts it: 'HK$7,999 起',
 * 'from HK$7,999' (dictionary key card.priceFrom). The marker is small, in `fromClassName`; the price is
 * plain text for the caller's element to style.
 */
export function PriceWithFrom({ price, t, fromClassName }: { price: string; t: T; fromClassName?: string }) {
  const marker = '\u0000';
  const [before, after = ''] = t('card.priceFrom', { price: marker }).split(marker);
  return (
    <>
      {before.trim() && <><small className={fromClassName}>{before.trim()}</small>{' '}</>}
      {price}
      {after.trim() && <>{' '}<small className={fromClassName}>{after.trim()}</small></>}
    </>
  );
}
