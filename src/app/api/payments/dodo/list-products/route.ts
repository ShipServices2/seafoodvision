// SeafoodVision — Admin endpoint: list real Dodo TEST products
// Used to identify the correct Product IDs for credit pack mappings.
// Admin-only. Never exposes API key or secrets.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDodoRuntimeConfig } from '@/lib/payments/dodo/config';
import DodoPayments from 'dodopayments';

export const dynamic = 'force-dynamic';

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: 'Dodo Payments is not configured (missing API key)' },
        { status: 503 }
      );
    }

    const client = createDodoClient();

    // Fetch one-time products (credit packs, unit products)
    const oneTimeProducts: Array<{
      product_id: string;
      name: string | null;
      price: number | null;
      currency: string | null;
      is_recurring: boolean;
    }> = [];

    for await (const product of client.products.list({ page_size: 100, recurring: false })) {
      const p = product as unknown as {
        product_id: string;
        name?: string | null;
        price?: number | null;
        currency?: string | null;
        is_recurring: boolean;
      };
      oneTimeProducts.push({
        product_id: p.product_id,
        name: p.name ?? null,
        price: p.price ?? null,
        currency: p.currency ?? null,
        is_recurring: p.is_recurring,
      });
    }

    // Fetch recurring products (subscriptions)
    const recurringProducts: Array<{
      product_id: string;
      name: string | null;
      price: number | null;
      currency: string | null;
      is_recurring: boolean;
    }> = [];

    for await (const product of client.products.list({ page_size: 100, recurring: true })) {
      const p = product as unknown as {
        product_id: string;
        name?: string | null;
        price?: number | null;
        currency?: string | null;
        is_recurring: boolean;
      };
      recurringProducts.push({
        product_id: p.product_id,
        name: p.name ?? null,
        price: p.price ?? null,
        currency: p.currency ?? null,
        is_recurring: p.is_recurring,
      });
    }

    // Also fetch current DB mappings for credit packs to compare
    const { data: dbMappings } = await supabase
      .from('payment_product_mappings')
      .select(`
        dodo_product_id,
        internal_product_type,
        environment,
        is_active,
        credit_packs!inner(pack_code, credits, price)
      `)
      .eq('internal_product_type', 'credit_pack')
      .eq('environment', runtime.environment)
      .eq('is_active', true);

    return NextResponse.json({
      environment: runtime.environment,
      dodo_mode: runtime.environment === 'production' ? 'live_mode' : 'test_mode',
      one_time_products: oneTimeProducts,
      recurring_products: recurringProducts,
      current_db_credit_mappings: dbMappings ?? [],
      total_one_time: oneTimeProducts.length,
      total_recurring: recurringProducts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list Dodo products';
    console.error('[dodo/list-products] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
