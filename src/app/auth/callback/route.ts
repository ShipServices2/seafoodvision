import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Preserve all params that may have been passed through OAuth flow
  const next = searchParams.get('next') ?? searchParams.get('return_to') ?? '/';
  const plan = searchParams.get('plan');
  const cycle = searchParams.get('cycle');
  const checkoutIntent = searchParams.get('checkout_intent');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Build the redirect URL preserving checkout intent params
      let redirectPath: string;
      if (checkoutIntent === '1' && plan) {
        const params = new URLSearchParams({ plan, cycle: cycle ?? 'monthly' });
        redirectPath = `/checkout/resume?${params.toString()}`;
      } else {
        redirectPath = next;
      }
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth-code-error`);
}
