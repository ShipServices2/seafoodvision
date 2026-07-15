import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateSubscriptionCheckout } from '@/lib/payments/CheckoutService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planCode, billingCycle } = body;

    if (!planCode || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required fields: planCode, billingCycle' },
        { status: 400 }
      );
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'billingCycle must be monthly or annual' },
        { status: 400 }
      );
    }

    const result = await initiateSubscriptionCheckout({
      userId: user.id,
      userEmail: user.email ?? '',
      planCode,
      billingCycle,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subscription checkout failed';
    console.error('[checkout/subscription] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
