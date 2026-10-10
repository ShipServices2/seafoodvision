import { NextRequest, NextResponse } from 'next/server';
import { changeCartItemLicense, removeCartItem, updateCartItem } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';

type Context = { params: Promise<{ itemId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireCartUser();
    const { itemId } = await context.params;
    const body = await request.json() as { quantity?: unknown; unitProductCode?: unknown; licenseTypeCode?: unknown };
    if (typeof body.unitProductCode === 'string' && typeof body.licenseTypeCode === 'string') {
      return NextResponse.json(await changeCartItemLicense(user.id, itemId, {
        unitProductCode: body.unitProductCode, licenseTypeCode: body.licenseTypeCode,
      }));
    }
    if (typeof body.quantity !== 'number') {
      return NextResponse.json({ error: 'Numeric quantity is required', code: 'invalid_request' }, { status: 400 });
    }
    return NextResponse.json(await updateCartItem(user.id, itemId, body.quantity));
  } catch (error) {
    return cartRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const user = await requireCartUser();
    const { itemId } = await context.params;
    return NextResponse.json(await removeCartItem(user.id, itemId));
  } catch (error) {
    return cartRouteError(error);
  }
}
