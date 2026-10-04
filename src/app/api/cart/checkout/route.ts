import { NextResponse } from 'next/server';
import { initiateCartCheckout } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

export async function POST() {
  try {
    const user = await requireCartUser();
    return NextResponse?.json(await initiateCartCheckout({ userId: user?.id, userEmail: user?.email ?? '' }));
  } catch (error) {
    return cartRouteError(error);
  }
}
