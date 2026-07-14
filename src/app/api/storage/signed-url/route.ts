import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// GET /api/storage/signed-url?bucket=asset-thumbnails&path=pilot/SV-PILOT-0001/thumbnail.jpg&expiresIn=3600
// Returns a signed URL for a private Supabase Storage object.
// Uses service role key when available (bypasses RLS for trusted server-side generation).
// Falls back to anon client if service role key is not set.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });
    }

    // Security: never allow originals bucket
    if (bucket === 'asset-originals') {
      return NextResponse.json({ error: 'Access to asset-originals is forbidden' }, { status: 403 });
    }

    // Only allow our known private buckets
    const allowedBuckets = ['asset-thumbnails', 'asset-previews'];
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: `Bucket not allowed: ${bucket}` }, { status: 403 });
    }

    // Use service role key if available (bypasses storage RLS for trusted server-side generation)
    // This allows unauthenticated visitors to receive signed URLs via this API route.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    let storageClient;
    if (serviceRoleKey && serviceRoleKey !== 'your-service-role-key-here') {
      // Service role client — bypasses RLS, trusted server-side only
      storageClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
    } else {
      // Fallback: use the session-aware server client (requires anon storage read policy)
      storageClient = await createServerClient();
    }

    const { data, error } = await storageClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      // Object may not exist yet — return null gracefully
      return NextResponse.json({ signedUrl: null, error: error?.message || 'Object not found' }, { status: 200 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn,
      bucket,
      path,
    });
  } catch (err) {
    console.error('Signed URL API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', signedUrl: null },
      { status: 500 }
    );
  }
}
