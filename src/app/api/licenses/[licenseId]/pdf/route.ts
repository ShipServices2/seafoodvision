import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateLicensePdf, LicenseDocumentError } from '@/lib/licensing/LicenseDocumentService';

export const dynamic = 'force-dynamic';

/** Licence certificate (PDF) of a purchased licence. Generated on the first request, then stored privately and reused. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  const { licenseId } = await params;
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(licenseId)) return NextResponse.json({ error: 'Licence not found' }, { status: 404 });

  try {
    const { bytes, licenseNumber } = await getOrCreateLicensePdf(user.id, licenseId);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SeafoodVision-licence-${licenseNumber}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof LicenseDocumentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[licenses/pdf]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to generate the licence' }, { status: 500 });
  }
}
