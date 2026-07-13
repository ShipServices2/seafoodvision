import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Allowed MIME types for import uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Max file size: 20 MB
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// POST /api/admin/import/upload
// FormData: file (binary), assetId (string), fileLevel ('thumbnail' | 'preview'), publicAssetId (string)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assetId = formData.get('assetId') as string | null;
    const fileLevel = formData.get('fileLevel') as 'thumbnail' | 'preview' | null;

    if (!file || !assetId || !fileLevel) {
      return NextResponse.json({ error: 'Missing required fields: file, assetId, fileLevel' }, { status: 400 });
    }

    // Security: NEVER allow original uploads
    if ((fileLevel as string) === 'original') {
      return NextResponse.json({ error: 'Original file uploads are strictly forbidden' }, { status: 403 });
    }

    // Only thumbnail and preview are allowed
    if (!['thumbnail', 'preview'].includes(fileLevel)) {
      return NextResponse.json({ error: `Invalid fileLevel: ${fileLevel}. Only 'thumbnail' or 'preview' allowed.` }, { status: 400 });
    }

    // ---- MIME TYPE VALIDATION ----
    // Check declared MIME type
    const declaredMime = file.type?.toLowerCase() || '';
    if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
      return NextResponse.json({
        error: `File type not allowed: ${declaredMime || 'unknown'}. Allowed: JPEG, PNG, WEBP, HEIC.`,
      }, { status: 415 });
    }

    // ---- FILE EXTENSION VALIDATION ----
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
    if (!allowedExtensions.has(ext)) {
      return NextResponse.json({
        error: `File extension not allowed: .${ext}. Allowed: .jpg, .jpeg, .png, .webp, .heic`,
      }, { status: 415 });
    }

    // ---- FILE SIZE VALIDATION ----
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed: 20 MB.`,
      }, { status: 413 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // ---- BUCKET SELECTION — never write to asset-originals ----
    const bucket = fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews';
    const storagePath = `${assetId}/${fileLevel}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: declaredMime || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Record in asset_files
    const { error: fileRecordError } = await supabase
      .from('asset_files')
      .insert({
        asset_id: assetId,
        file_level: fileLevel,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: declaredMime || 'image/jpeg',
        file_size_bytes: file.size,
      });

    if (fileRecordError) {
      return NextResponse.json(
        { error: `File record insert failed: ${fileRecordError.message}` },
        { status: 500 }
      );
    }

    // If preview, also record in asset_previews
    if (fileLevel === 'preview') {
      await supabase
        .from('asset_previews')
        .upsert({
          asset_id: assetId,
          storage_bucket: bucket,
          storage_path: storagePath,
          watermark_applied: true,
        }, { onConflict: 'asset_id' });
    }

    return NextResponse.json({
      success: true,
      bucket,
      storagePath,
      fileLevel,
      assetId,
      mimeType: declaredMime,
      fileSizeBytes: file.size,
    });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
