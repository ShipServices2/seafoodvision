import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Disable Next.js route cache — always process fresh uploads
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const consentForRetention = formData.get('consentForRetention') === 'true';
    const locale = (formData.get('locale') as string) || 'en';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WEBP, and HEIC are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 });
    }

    // Build storage path
    const userId = user?.id || 'anonymous';
    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const uploadPath = `${userId}/${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    console.log(`[upload/route] Uploading to storage | path=${uploadPath} | size=${file.size} | type=${file.type}`);

    const { error: uploadError } = await supabase.storage
      .from('identification-uploads')
      .upload(uploadPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload/route] Storage upload failed:', uploadError.message);
      return NextResponse.json(
        { error: `Image upload failed: ${uploadError.message}. Please try again.` },
        { status: 500 }
      );
    }

    console.log(`[upload/route] Storage upload success | path=${uploadPath}`);

    // Create identification request
    const retentionUntil = consentForRetention
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: req, error: reqError } = await supabase
      .from('identification_requests')
      .insert({
        user_id: user?.id || null,
        upload_path: uploadPath,
        original_filename: null, // Privacy: don't store original filename
        media_type: 'photo',
        file_size: file.size,
        status: 'uploaded',
        quality_status: 'pending',
        quality_flags: [],
        locale,
        consent_for_retention: consentForRetention,
        retention_until: retentionUntil,
      })
      .select('id')
      .single();

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }

    // Log event
    await supabase.from('identification_events').insert({
      request_id: req.id,
      event_type: 'request_created',
      previous_status: null,
      new_status: 'uploaded',
      created_by: user?.id || null,
    });

    return NextResponse.json({ requestId: req.id, uploadPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
