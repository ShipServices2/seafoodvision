import { NextRequest, NextResponse } from 'next/server';
import { addCartItem, type CartItemRequest } from '@/lib/payments/CartService';
import { cartRouteError, requireCartUser } from '@/lib/payments/cartRoute';
import { isV1HiddenUnitProduct, isV1ScopeEnabled } from '@/lib/v1Scope';

export async function POST(request: NextRequest) {
  try {
    const user = await requireCartUser();
    const body = await request.json() as Partial<CartItemRequest> & Record<string, unknown>;
    // V1 scope: credit packs, Ultra HD, video and 360° are not sold.
    if (
      body.itemType === 'credit_pack' ||
      (typeof body.unitProductCode === 'string' && isV1HiddenUnitProduct(body.unitProductCode))
    ) {
      if (isV1ScopeEnabled()) {
        return NextResponse.json({ error: 'This product is not available.', code: 'out_of_v1_scope' }, { status: 400 });
      }
    }
    if (body.itemType === 'asset_license') {
      if (typeof body.assetId !== 'string' || typeof body.licenseTypeCode !== 'string' || typeof body.unitProductCode !== 'string') {
        return NextResponse.json({ error: 'assetId, licenseTypeCode and unitProductCode are required', code: 'invalid_request' }, { status: 400 });
      }
      return NextResponse.json(await addCartItem(user.id, {
        itemType: 'asset_license', assetId: body.assetId, licenseTypeCode: body.licenseTypeCode,
        unitProductCode: body.unitProductCode, quantity: typeof body.quantity === 'number' ? body.quantity : 1,
      }), { status: 201 });
    }
    if (body.itemType === 'credit_pack') {
      if (typeof body.packCode !== 'string') {
        return NextResponse.json({ error: 'packCode is required', code: 'invalid_request' }, { status: 400 });
      }
      return NextResponse.json(await addCartItem(user.id, {
        itemType: 'credit_pack', packCode: body.packCode,
        quantity: typeof body.quantity === 'number' ? body.quantity : 1,
      }), { status: 201 });
    }
    return NextResponse.json({ error: 'Unsupported itemType', code: 'invalid_item_type' }, { status: 400 });
  } catch (error) {
    return cartRouteError(error);
  }
}
