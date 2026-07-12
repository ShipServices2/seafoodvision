import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const publicAssetId = formData.get('publicAssetId') as string | null;

    if (!file || !assetId || !fileLevel) {
      return NextResponse.json({ error: 'Missing required fields: file, assetId, fileLevel' }, { status: 400 });
    }

    // Security: never allow original uploads
    if (fileLevel === 'original' as string) {
      return NextResponse.json({ error: 'Original file uploads are not permitted' }, { status: 403 });
    }

    const bucket = fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews';
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const storagePath = `${assetId}/${fileLevel}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'image/jpeg',
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
        mime_type: file.type || 'image/jpeg',
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
    });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
