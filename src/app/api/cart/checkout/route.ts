import { NextRequest, NextResponse } from 'next/server';
import { initiateCartCheckout } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

export async function POST(request: NextRequest) {
  try {
    const user = await requireCartUser();
    return NextResponse?.json(await initiateCartCheckout({ userId: user?.id, userEmail: user?.email ?? '', origin: request.nextUrl.origin }));
  } catch (error) {
    return cartRouteError(error);
  }
}
