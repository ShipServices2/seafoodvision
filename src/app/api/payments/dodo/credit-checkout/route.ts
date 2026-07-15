import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateCreditPackCheckout } from '@/lib/payments/CheckoutService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { packCode } = body;

    if (!packCode) {
      return NextResponse.json(
        { error: 'Missing required field: packCode' },
        { status: 400 }
      );
    }

    const result = await initiateCreditPackCheckout({
      userId: user.id,
      userEmail: user.email ?? '',
      packCode,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credit checkout failed';
    console.error('[checkout/credits] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
