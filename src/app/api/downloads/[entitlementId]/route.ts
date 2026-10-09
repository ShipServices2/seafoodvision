import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { deliveredFileLevel, downloadSignedUrlDuration } from '@/lib/downloads/fileSelection';

const SIGNED_URL_DURATION = downloadSignedUrlDuration();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entitlementId: string }> }
) {
  const { entitlementId } = await params;
  const authClient = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createServiceClient();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;
  const startTime = Date.now();

  // 2. Load entitlement
  const { data: entitlement, error: entErr } = await supabase
    .from('download_entitlements')
    .select('*')
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

  // 8. Find the file this entitlement is allowed to receive.
  // Photo Web -> the 1920 px 'web' file; HD -> the original. A web buyer never gets the original, even when the web file is missing.
  const resolution = entitlement.allowed_resolution ?? entitlement.resolution_allowed ?? 'web';
  const fileLevel = deliveredFileLevel(resolution);
  const { data: assetFile } = await supabase
    .from('asset_files')
    .select('storage_bucket, storage_path, file_level, mime_type')
    .eq('asset_id', entitlement.asset_id)
    .eq('file_level', fileLevel)
    .limit(1)
    .maybeSingle();

  if (!assetFile) {
    await logDownloadEvent(supabase, {
      userId: user.id,
      assetId: entitlement.asset_id,
      entitlementId,
      ip,
      userAgent,
      resolution,
      result: fileLevel === 'web' ? 'rejected:web_file_not_available' : 'rejected:original_not_available',
      duration: SIGNED_URL_DURATION,
    });
    return NextResponse.json(
      fileLevel === 'web'
        ? { error: 'Web file not yet available', code: 'WEB_FILE_NOT_AVAILABLE' }
        : { error: 'Original not yet available', code: 'ORIGINAL_NOT_AVAILABLE' },
      { status: 404 }
    );
  }

  // 9. Reserve one download atomically before returning a signed URL.
  const { data: reserved, error: reserveError } = await supabase
    .from('download_entitlements')
    .update({
      downloads_used: downloadsUsed + 1,
      download_count: downloadsUsed + 1,
      last_downloaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entitlementId)
    .eq('downloads_used', downloadsUsed)
    .select('id')
    .maybeSingle();
  if (reserveError || !reserved) {
    return NextResponse.json(
      { error: 'Download entitlement changed; retry the request' },
      { status: 409 }
    );
  }

  // 10. Generate a short-lived signed URL (default 300 s), served as an attachment named after the public photo id
  const { data: assetRow } = await supabase.from('assets').select('public_asset_id').eq('id', entitlement.asset_id).maybeSingle();
  const extension = assetFile.storage_path.split('.').pop() ?? 'jpg';
  const downloadName = `${assetRow?.public_asset_id ?? 'seafoodvision'}-${fileLevel === 'web' ? 'web' : 'hd'}.${extension}`;
  const { data: signedData, error: signedError } = await supabase.storage
    .from(assetFile.storage_bucket)
    .createSignedUrl(assetFile.storage_path, SIGNED_URL_DURATION, { download: downloadName });

  if (signedError || !signedData?.signedUrl) {
    // Release the reserved quota when URL generation fails.
    await supabase
      .from('download_entitlements')
      .update({
        downloads_used: downloadsUsed,
        download_count: downloadsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entitlementId)
      .eq('downloads_used', downloadsUsed + 1);
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
    fileName: downloadName,
    fileLevel,
    mimeType: assetFile.mime_type,
    downloadsRemaining: maxDownloads - downloadsUsed - 1,
  });
}

async function logDownloadEvent(
  supabase: ReturnType<typeof createServiceClient>,
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
