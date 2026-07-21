// SeafoodVision — Auto-configure credit pack Product IDs from Dodo TEST
// Fetches real products, matches by price, writes to .env

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDodoRuntimeConfig } from '@/lib/payments/dodo/config';
import DodoPayments from 'dodopayments';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Credit pack definitions: price in cents → env key + credits
const CREDIT_PACK_DEFINITIONS = [
  { credits: 100,  priceEur: 900,  envKey: 'DODO_CREDIT_PACK_100_PRODUCT_ID',  label: '100 crédits — 9 EUR' },
  { credits: 250,  priceEur: 1900, envKey: 'DODO_CREDIT_PACK_250_PRODUCT_ID',  label: '250 crédits — 19 EUR' },
  { credits: 500,  priceEur: 3500, envKey: 'DODO_CREDIT_PACK_500_PRODUCT_ID',  label: '500 crédits — 35 EUR' },
  { credits: 1000, priceEur: 5900, envKey: 'DODO_CREDIT_PACK_1000_PRODUCT_ID', label: '1000 crédits — 59 EUR' },
];

// Placeholder patterns to detect unset values
const PLACEHOLDER_PATTERNS = [
  /^YOUR_DODO/i,
  /^pdt_xxx/i,
  /^placeholder/i,
  /^YOUR_/i,
  /^REPLACE/i,
];

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value || value.trim() === '') return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}

function createDodoClient(): DodoPayments {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
  const runtime = getDodoRuntimeConfig();
  return new DodoPayments({
    bearerToken: apiKey,
    environment: runtime.environment === 'production' ? 'live_mode' : 'test_mode',
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['administrator', 'super_admin'].includes(profile.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const runtime = getDodoRuntimeConfig();
    if (!runtime.isCheckoutReady) {
      return NextResponse.json({ error: 'Dodo Payments not configured (missing API key)' }, { status: 503 });
    }

    const client = createDodoClient();

    // Fetch all one-time products from Dodo
    const products: Array<{
      product_id: string;
      name: string | null;
      price: number | null;
      currency: string | null;
    }> = [];

    for await (const product of client.products.list({ page_size: 100, recurring: false })) {
      const p = product as unknown as {
        product_id: string;
        name?: string | null;
        price?: number | null;
        currency?: string | null;
      };
      products.push({
        product_id: p.product_id,
        name: p.name ?? null,
        price: p.price ?? null,
        currency: p.currency ?? null,
      });
    }

    // Match products to credit packs by price
    const matches: Array<{
      pack: typeof CREDIT_PACK_DEFINITIONS[0];
      matched_product: typeof products[0] | null;
      current_env_value: string | null;
      is_placeholder: boolean;
    }> = [];

    for (const pack of CREDIT_PACK_DEFINITIONS) {
      const currentValue = process.env[pack.envKey]?.trim() ?? null;
      const placeholder = isPlaceholder(currentValue);

      // Match by price (in cents) and EUR currency
      const matched = products.find(
        (p) =>
          p.price === pack.priceEur &&
          (p.currency?.toUpperCase() === 'EUR' || p.currency?.toUpperCase() === 'EURO')
      ) ?? null;

      matches.push({
        pack,
        matched_product: matched,
        current_env_value: placeholder ? null : currentValue,
        is_placeholder: placeholder,
      });
    }

    return NextResponse.json({
      environment: runtime.environment,
      total_dodo_products: products.length,
      all_products: products,
      credit_pack_matches: matches,
      ready_to_apply: matches.every((m) => m.matched_product !== null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-configure failed';
    console.error('[dodo/auto-configure-credits] GET Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['administrator', 'super_admin'].includes(profile.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Accept explicit mappings from the request body
    const body = await request.json();
    const mappings: Record<string, string> = body.mappings ?? {};

    // Validate all 4 keys are present and look like real Dodo product IDs
    const required = [
      'DODO_CREDIT_PACK_100_PRODUCT_ID',
      'DODO_CREDIT_PACK_250_PRODUCT_ID',
      'DODO_CREDIT_PACK_500_PRODUCT_ID',
      'DODO_CREDIT_PACK_1000_PRODUCT_ID',
    ];

    for (const key of required) {
      if (!mappings[key] || isPlaceholder(mappings[key])) {
        return NextResponse.json(
          { error: `Missing or invalid product ID for ${key}` },
          { status: 400 }
        );
      }
    }

    // Write to .env file
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      return NextResponse.json({ error: '.env file not found' }, { status: 500 });
    }

    let updated = envContent;
    const appliedKeys: string[] = [];

    for (const key of required) {
      const newValue = mappings[key].trim();
      // Replace existing line (with or without placeholder)
      const lineRegex = new RegExp(`^(${key}=.*)$`, 'm');
      if (lineRegex.test(updated)) {
        updated = updated.replace(lineRegex, `${key}=${newValue}`);
      } else {
        // Append if key doesn't exist
        updated += `\n${key}=${newValue}`;
      }
      appliedKeys.push(`${key}=${newValue}`);
    }

    fs.writeFileSync(envPath, updated, 'utf-8');

    return NextResponse.json({
      success: true,
      applied: appliedKeys,
      message: 'Product IDs written to .env. Restart the server to apply.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apply configuration failed';
    console.error('[dodo/auto-configure-credits] POST Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
