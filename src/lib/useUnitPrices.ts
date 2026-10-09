'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toUnitPrice, UNIT_PRICE_COLUMNS, type UnitPrice, type UnitPriceRow } from './unitPrices';

let cache: Record<string, UnitPrice> | null = null;
let inflight: Promise<Record<string, UnitPrice>> | null = null;

async function load(): Promise<Record<string, UnitPrice>> {
  const { data, error } = await createClient().from('unit_products').select(UNIT_PRICE_COLUMNS).eq('is_active', true);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as UnitPriceRow[]).map((row) => [row.product_code, toUnitPrice(row)]));
}

/** Prices of the active unit products by product_code (null while loading or if the read failed). Shared across components. */
export function useUnitPrices(): Record<string, UnitPrice> | null {
  const [prices, setPrices] = useState<Record<string, UnitPrice> | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    inflight ??= load();
    inflight
      .then((loaded) => { cache = loaded; if (alive) setPrices(loaded); })
      .catch(() => { inflight = null; });
    return () => { alive = false; };
  }, []);
  return prices;
}
