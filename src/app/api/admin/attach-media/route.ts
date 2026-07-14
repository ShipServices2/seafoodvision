import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ManifestRow {
  public_asset_id: string;
  thumbnail_filename: string;
  preview_filename: string;
  title?: string;
  species?: string;
}

interface AssetRecord {
  id: string;
  public_asset_id: string | null;
  title: string;
  slug: string;
}

// POST /api/admin/attach-media
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — administrator role required' }, { status: 403 });
    }

    const body = await request.json();
    const { mode } = body as { mode: string };

    // ---- CACHE INVALIDATION MODE ----
    if (mode === 'invalidate_cache') {
      const { assetIds } = body as { assetIds: string[] };
      if (!assetIds?.length) {
        return NextResponse.json({ success: true, invalidated: 0 });
      }

      // Touch updated_at on the assets to bust any server-side caches
      const { error } = await supabase
        .from('assets')
        .update({ updated_at: new Date().toISOString() })
        .in('id', assetIds);

      if (error) {
        console.warn('Cache invalidation warning:', error.message);
      }

      return NextResponse.json({ success: true, invalidated: assetIds.length });
    }

    // ---- DRY RUN MODE ----
    if (mode !== 'dry_run') {
      return NextResponse.json({ error: 'Invalid mode. Use dry_run or invalidate_cache.' }, { status: 400 });
    }

    const {
      manifestRows,
      thumbnailFilenames,
      previewFilenames,
    } = body as {
      manifestRows: ManifestRow[];
      thumbnailFilenames: string[];
      previewFilenames: string[];
    };

    if (!manifestRows?.length) {
      return NextResponse.json({ error: 'No manifest rows provided' }, { status: 400 });
    }

    // Fetch all existing assets with public_asset_id
    const { data: existingAssets, error: fetchError } = await supabase
      .from('assets')
      .select('id, public_asset_id, title, slug')
      .not('public_asset_id', 'is', null);

    if (fetchError) {
      return NextResponse.json({ error: `Failed to fetch assets: ${fetchError.message}` }, { status: 500 });
    }

    // Build lookup map: public_asset_id (lowercase) -> asset record
    const assetMap = new Map<string, AssetRecord>();
    for (const asset of (existingAssets || []) as AssetRecord[]) {
      if (asset.public_asset_id) {
        assetMap.set(asset.public_asset_id.toLowerCase().trim(), asset);
      }
    }

    // Build filename sets for quick lookup (lowercase)
    const thumbFilenameSet = new Set((thumbnailFilenames || []).map((f) => f.toLowerCase()));
    const previewFilenameSet = new Set((previewFilenames || []).map((f) => f.toLowerCase()));

    const unknownIds: string[] = [];
    const missingThumbnails: string[] = [];
    const missingPreviews: string[] = [];
    const thumbnailMatches: { publicAssetId: string; assetId: string; assetTitle: string; filename: string }[] = [];
    const previewMatches: { publicAssetId: string; assetId: string; assetTitle: string; filename: string }[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const row of manifestRows) {
      const pid = row.public_asset_id?.trim();
      if (!pid) {
        errors.push('Row with empty public_asset_id found — skipped');
        continue;
      }

      const asset = assetMap.get(pid.toLowerCase());
      if (!asset) {
        unknownIds.push(pid);
        errors.push(`Unknown public_asset_id: ${pid} — no matching asset found in database`);
        continue;
      }

      // Check thumbnail
      const thumbFilename = row.thumbnail_filename?.trim();
      if (thumbFilename) {
        if (thumbFilenameSet.has(thumbFilename.toLowerCase())) {
          thumbnailMatches.push({
            publicAssetId: pid,
            assetId: asset.id,
            assetTitle: asset.title,
            filename: thumbFilename,
          });
        } else {
          missingThumbnails.push(thumbFilename);
          warnings.push(`Thumbnail file not provided: ${thumbFilename} (for ${pid})`);
        }
      }

      // Check preview
      const previewFilename = row.preview_filename?.trim();
      if (previewFilename) {
        if (previewFilenameSet.has(previewFilename.toLowerCase())) {
          previewMatches.push({
            publicAssetId: pid,
            assetId: asset.id,
            assetTitle: asset.title,
            filename: previewFilename,
          });
        } else {
          missingPreviews.push(previewFilename);
          warnings.push(`Preview file not provided: ${previewFilename} (for ${pid})`);
        }
      }
    }

    // Security check: ensure no originals bucket references
    // (this is enforced at upload time, but we double-check here)
    const hasOriginalReference = [...(thumbnailFilenames || []), ...(previewFilenames || [])]
      .some((f) => /original/i.test(f));
    if (hasOriginalReference) {
      errors.push('Files with "original" in the name are not allowed');
    }

    return NextResponse.json({
      mode: 'dry_run',
      totalManifestRows: manifestRows.length,
      unknownIds,
      missingThumbnails,
      missingPreviews,
      thumbnailMatches,
      previewMatches,
      errors,
      warnings,
      canProceed: unknownIds.length === 0 && (thumbnailMatches.length > 0 || previewMatches.length > 0),
    });
  } catch (err) {
    console.error('Attach media API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
