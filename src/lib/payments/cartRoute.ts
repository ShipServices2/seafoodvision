import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CartError } from './CartService';

export async function requireCartUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new CartError('unauthorized', 'Authentication is required', 401);
  return user;
}

export function cartRouteError(error: unknown) {
  const status = error instanceof CartError ? error.status : 500;
  const code = error instanceof CartError ? error.code : 'cart_error';
  const message = error instanceof Error ? error.message : 'Cart operation failed';
  if (status >= 500) console.error('[cart]', message);
  return NextResponse.json({ error: message, code }, { status });
}
