import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// GET /api/storage/signed-url?bucket=asset-thumbnails&path=pilot/SV-PILOT-0001/thumbnail.jpg&expiresIn=3600
// Returns a signed URL for a private Supabase Storage object.
// Watermarked previews are signed for 10 minutes at most, and requests are rate-limited per visitor (simple in-memory window).
// Uses service role key when available (bypasses RLS for trusted server-side generation).
// Falls back to anon client if service role key is not set.
const PREVIEW_MAX_EXPIRY_SECONDS = 600;
const RATE_WINDOW_MS = 60_000;
// Max signed URLs per visitor per minute: previews are the valuable files, thumbnails are requested in bulk by the grids.
const RATE_LIMITS: Record<string, number> = { 'asset-previews': 60, 'asset-thumbnails': 400 };
const hits = new Map<string, number[]>();

/** Sliding-window counter per visitor + bucket. Per server instance (best effort), enough to stop scripted harvesting. */
function rateLimited(visitor: string, bucket: string): boolean {
  const now = Date.now();
  const key = `${visitor}|${bucket}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > RATE_WINDOW_MS) hits.delete(k);
  return recent.length > (RATE_LIMITS[bucket] ?? 100);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');
    const requested = parseInt(searchParams.get('expiresIn') || '3600', 10);

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

    const expiresIn = bucket === 'asset-previews'
      ? Math.min(Number.isFinite(requested) && requested > 0 ? requested : PREVIEW_MAX_EXPIRY_SECONDS, PREVIEW_MAX_EXPIRY_SECONDS)
      : Number.isFinite(requested) && requested > 0 ? Math.min(requested, 3600) : 3600;

    const visitor = (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'local').trim();
    if (rateLimited(visitor, bucket)) {
      return NextResponse.json({ signedUrl: null, error: 'Too many requests, please slow down' }, { status: 429, headers: { 'Retry-After': '30' } });
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
