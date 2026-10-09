import React from 'react';
import { formatEur, promoDisplay, type UnitPrice } from '@/lib/unitPrices';

interface PriceTagProps {
  unit: Pick<UnitPrice, 'price' | 'listPrice' | 'promoEndsAt'> | null | undefined;
  /** Show "Launch price until <date>" under the price. */
  showEnd?: boolean;
  className?: string;
}

/** Price with the normal price struck through and the end date of the promotion, from the database values. */
export default function PriceTag({ unit, showEnd = false, className = '' }: PriceTagProps) {
  if (!unit) return <span className={className} aria-busy="true">…</span>;
  const promo = promoDisplay(unit);
  return (
    <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
      <span className="inline-flex items-baseline gap-1.5">
        {promo.strikePrice !== null && (
          <s className="text-xs font-normal text-muted-foreground" aria-label={`Normal price ${formatEur(promo.strikePrice)}`}>
            {formatEur(promo.strikePrice)}
          </s>
        )}
        <span>{formatEur(promo.price)}</span>
      </span>
      {showEnd && promo.endsOn && (
        <span className="text-[11px] font-normal text-muted-foreground">Launch price until {promo.endsOn}</span>
      )}
    </span>
  );
}
