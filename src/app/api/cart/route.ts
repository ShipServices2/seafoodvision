import { NextResponse } from 'next/server';
import { clearCart, getCart } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireCartUser();
    return NextResponse.json(await getCart(user.id));
  } catch (error) {
    return cartRouteError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireCartUser();
    return NextResponse.json(await clearCart(user.id));
  } catch (error) {
    return cartRouteError(error);
  }
}
