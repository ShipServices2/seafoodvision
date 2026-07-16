import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase?.auth?.getUser();

    if (!user) {
      return NextResponse?.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase?.from('profiles')?.select('role')?.eq('id', user?.id)?.single();

    if (!profile || !['administrator', 'super_admin']?.includes(profile?.role ?? '')) {
      return NextResponse?.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiKeyConfigured = !!(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_API_KEY?.length > 0);
    const webhookSecretConfigured = !!(process.env.DODO_PAYMENTS_WEBHOOK_SECRET && process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.length > 0);
    const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
    const providerEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';

    const returnUrl =
      process.env.DODO_PAYMENTS_RETURN_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/success`;
    const cancelUrl =
      process.env.DODO_PAYMENTS_CANCEL_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/cancel`;

    return NextResponse?.json({
      apiKeyConfigured,
      webhookSecretConfigured,
      environment,
      returnUrl,
      cancelUrl,
      providerEnabled,
      checkoutRouteAvailable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error?.message : 'Diagnostic failed';
    return NextResponse?.json({ error: message }, { status: 500 });
  }
}
