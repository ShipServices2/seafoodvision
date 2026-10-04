import { NextResponse } from 'next/server';
import { validateCart } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

export async function POST() {
  try {
    const user = await requireCartUser();
    return NextResponse?.json(await validateCart(user?.id));
  } catch (error) {
    return cartRouteError(error);
  }
}
