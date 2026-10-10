import { requestOrigin } from '@/lib/payments/dodo/config';
import { NextRequest, NextResponse } from 'next/server';
import { initiateCartCheckout } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

export async function POST(request: NextRequest) {
  try {
    const user = await requireCartUser();
    return NextResponse?.json(await initiateCartCheckout({ userId: user?.id, userEmail: user?.email ?? '', origin: requestOrigin(request) ?? undefined }));
  } catch (error) {
    return cartRouteError(error);
  }
}
