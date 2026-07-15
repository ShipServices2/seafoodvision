import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SIGNED_URL_DURATION = parseInt(process.env.DOWNLOAD_SIGNED_URL_DURATION ?? '3600', 10);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entitlementId: string }> }
) {
  const { entitlementId } = await params;
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;
  const startTime = Date.now();

  // 2. Load entitlement
  const { data: entitlement, error: entErr } = await supabase
    .from('download_entitlements')
    .select('*, asset:assets(id, public_asset_id, title, commercial_status, review_status)')
    .eq('id', entitlementId)
    .single();

  if (entErr || !entitlement) {
    return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 });
  }

  // 3. Verify ownership
  if (entitlement.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Verify entitlement status
  if (entitlement.status !== 'active') {
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution: entitlement.allowed_resolution ?? entitlement.resolution_allowed,
      result: `rejected:status_${entitlement.status}`,
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json(
      { error: `Entitlement is ${entitlement.status}` },
      { status: 403 }
    );
  }

  // 5. Verify expiration
  if (entitlement.valid_until && new Date(entitlement.valid_until) < new Date()) {
    await supabase
      .from('download_entitlements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', entitlementId);
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution: entitlement.allowed_resolution ?? entitlement.resolution_allowed,
      result: 'rejected:expired',
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json({ error: 'Entitlement has expired' }, { status: 403 });
  }

  // 6. Verify quota
  const downloadsUsed = entitlement.downloads_used ?? entitlement.download_count ?? 0;
  const maxDownloads = entitlement.max_downloads ?? 1;
  if (downloadsUsed >= maxDownloads) {
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution: entitlement.allowed_resolution ?? entitlement.resolution_allowed,
      result: 'rejected:quota_exceeded',
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json({ error: 'Download quota exceeded' }, { status: 403 });
  }

  // 7. Verify purchased license if applicable
  if (entitlement.purchased_license_id) {
    const { data: license } = await supabase
      .from('purchased_licenses')
      .select('status')
      .eq('id', entitlement.purchased_license_id)
      .single();
    if (!license || license.status !== 'active') {
      return NextResponse.json({ error: 'License is not active' }, { status: 403 });
    }
  }

  // 8. Find original HD file in storage
  const resolution = entitlement.allowed_resolution ?? entitlement.resolution_allowed ?? 'hd';
  const { data: assetFile } = await supabase
    .from('asset_files')
    .select('storage_bucket, storage_path, file_level, mime_type')
    .eq('asset_id', entitlement.asset_id)
    .in('file_level', ['original', 'hd', 'full'])
    .order('file_level', { ascending: true })
    .limit(1)
    .single();

  if (!assetFile) {
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution,
      result: 'rejected:original_not_available',
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json(
      { error: 'Original not yet available', code: 'ORIGINAL_NOT_AVAILABLE' },
      { status: 404 }
    );
  }

  // 9. Generate signed URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from(assetFile.storage_bucket)
    .createSignedUrl(assetFile.storage_path, SIGNED_URL_DURATION);

  if (signedError || !signedData?.signedUrl) {
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution,
      result: 'error:signed_url_failed',
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }

  // 10. Increment download counter
  await supabase
    .from('download_entitlements')
    .update({
      downloads_used: downloadsUsed + 1,
      download_count: downloadsUsed + 1,
      last_downloaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entitlementId);

  // 11. Log successful download
  await logDownloadEvent(supabase, {
    userId: user.id,
    assetId: entitlement.asset_id,
    entitlementId,
    ip,
    userAgent,
    resolution,
    result: 'success',
    duration: SIGNED_URL_DURATION,
  });

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    expiresIn: SIGNED_URL_DURATION,
    fileName: assetFile.storage_path.split('/').pop(),
    mimeType: assetFile.mime_type,
    downloadsRemaining: maxDownloads - downloadsUsed - 1,
  });
}

async function logDownloadEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    userId: string;
    assetId: string;
    entitlementId: string;
    ip: string | null;
    userAgent: string | null;
    resolution: string | null | undefined;
    result: string;
    duration: number;
  }
) {
  try {
    await supabase.from('download_events').insert({
      user_id: params.userId,
      asset_id: params.assetId,
      entitlement_id: params.entitlementId,
      ip_address: params.ip,
      user_agent: params.userAgent,
      resolution_downloaded: params.resolution,
      result: params.result,
      signed_url_duration_seconds: params.duration,
    });
  } catch {
    // Non-blocking — log failure should not break download
  }
}
