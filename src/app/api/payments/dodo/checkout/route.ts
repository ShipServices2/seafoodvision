import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateAssetLicenseCheckout } from '@/lib/payments/CheckoutService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assetId, licenseTypeCode, unitProductCode } = body;

    if (!assetId || !licenseTypeCode || !unitProductCode) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, licenseTypeCode, unitProductCode' },
        { status: 400 }
      );
    }

    const result = await initiateAssetLicenseCheckout({
      userId: user.id,
      userEmail: user.email ?? '',
      assetId,
      licenseTypeCode,
      unitProductCode,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    console.error('[checkout/asset] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
