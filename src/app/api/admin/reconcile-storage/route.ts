'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface StorageFile {
  name: string;
  id: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

interface ReconcileMatch {
  storagePath: string;
  bucket: string;
  publicAssetId: string;
  assetId: string;
  assetTitle: string;
  fileLevel: 'thumbnail' | 'preview';
  mimeType: string | null;
  fileSizeBytes: number | null;
  existingFileId: string | null;
  strategy: string;
}

interface ReconcileResult {
  mode: 'dry_run' | 'execute';
  totalStorageFiles: number;
  matched: number;
  matchedByPublicAssetId: number;
  matchedByUuidAssetId: number;
  unmatched: number;
  alreadyLinked: number;
  toInsert: number;
  toUpdate: number;
  inserted: number;
  updated: number;
  errors: string[];
  unmatchedPaths: string[];
  matches: ReconcileMatch[];
  detectedFormats: string[];
}

// List all files recursively from a storage bucket
async function listBucketFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  prefix = ''
): Promise<{ path: string; metadata: StorageFile['metadata'] }[]> {
  const results: { path: string; metadata: StorageFile['metadata'] }[] = [];

  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, offset: 0 });

  if (error || !files) return results;

  for (const file of files) {
    const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
    if (file.id === null) {
      // It's a folder — recurse
      const nested = await listBucketFiles(supabase, bucket, fullPath);
      results.push(...nested);
    } else {
      results.push({ path: fullPath, metadata: file.metadata });
    }
  }

  return results;
}

// Image/video extensions we consider valid media files
const MEDIA_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif',
  'mp4', 'mov', 'avi', 'mkv', 'webm',
]);

function isMediaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_EXTENSIONS.has(ext);
}

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/**
 * Multi-strategy path parser.
 *
 * Strategy order (per spec):
 *   1. public_asset_id exact match (folder or filename segment)
 *   2. UUID matching assets.id directly
 *   3. filename IS the public_asset_id (flat file)
 *   4. filename with suffix stripped → public_asset_id
 *   5. any path segment matches public_asset_id
 *
 * file_level inferred from:
 *   1. filename keyword (thumbnail/preview/thumb/watermark/wm)
 *   2. folder keyword
 *   3. bucket name fallback
 */
function parsePath(
  storagePath: string,
  bucket: string,
  knownPublicIds: Set<string>,
  knownUuids: Set<string>
): { publicAssetId: string; assetUuid: string | null; fileLevel: 'thumbnail' | 'preview'; strategy: string } | null {
  const parts = storagePath.split('/');
  const rawFilename = parts[parts.length - 1];
  const filenameLower = rawFilename.toLowerCase();
  const filenameNoExt = rawFilename.replace(/\.[^.]+$/, '');
  const filenameNoExtLower = filenameNoExt.toLowerCase();

  if (!isMediaFile(rawFilename)) return null;

  const bucketLevel: 'thumbnail' | 'preview' =
    bucket === 'asset-thumbnails' ? 'thumbnail' : 'preview';

  function inferLevel(s: string): 'thumbnail' | 'preview' | null {
    const sl = s.toLowerCase();
    if (sl.includes('thumbnail') || sl.includes('thumb') || sl === 'thumbnails') return 'thumbnail';
    if (sl.includes('preview') || sl.includes('watermark') || sl.includes('_wm') || sl === 'previews') return 'preview';
    return null;
  }

  // ── Strategy 1: folder-based — folder is public_asset_id, filename has level hint ──
  if (parts.length >= 2) {
    const folderName = parts[parts.length - 2];
    const levelFromFilename = inferLevel(filenameLower);
    if (levelFromFilename && folderName && !isUuid(folderName)) {
      if (knownPublicIds.has(folderName.toLowerCase())) {
        return {
          publicAssetId: folderName,
          assetUuid: null,
          fileLevel: levelFromFilename,
          strategy: 'public-asset-id-folder',
        };
      }
    }
  }

  // ── Strategy 2: UUID folder matching assets.id ──
  // Handles: {uuid}/thumbnail.jpg, thumbnails/{uuid}/thumbnail.jpg, batch/{uuid}/thumbnail.jpg
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (isUuid(seg) && knownUuids.has(seg.toLowerCase())) {
      const levelFromFilename = inferLevel(filenameLower);
      const folderLevel = i > 0 ? inferLevel(parts[i - 1]) : null;
      const fileLevel = levelFromFilename ?? folderLevel ?? bucketLevel;
      return {
        publicAssetId: '', // will be resolved from uuid map
        assetUuid: seg,
        fileLevel,
        strategy: 'uuid-asset-id',
      };
    }
  }

  // ── Strategy 3: flat filename IS the public_asset_id ──
  if (knownPublicIds.has(filenameNoExtLower)) {
    const levelFromFilename = inferLevel(filenameNoExtLower);
    const folderLevel = parts.length >= 2 ? inferLevel(parts[parts.length - 2]) : null;
    const fileLevel = levelFromFilename ?? folderLevel ?? bucketLevel;
    return { publicAssetId: filenameNoExt, assetUuid: null, fileLevel, strategy: 'flat-filename' };
  }

  // ── Strategy 4: filename with suffix stripped → public_asset_id ──
  const suffixPatterns = [
    /_thumbnail$/i, /_preview$/i, /_thumb$/i, /_watermark$/i, /_wm$/i,
    /-thumbnail$/i, /-preview$/i, /-thumb$/i,
  ];
  for (const pattern of suffixPatterns) {
    const stripped = filenameNoExt.replace(pattern, '');
    if (stripped && knownPublicIds.has(stripped.toLowerCase())) {
      const levelFromFilename = inferLevel(filenameNoExtLower);
      const folderLevel = parts.length >= 2 ? inferLevel(parts[parts.length - 2]) : null;
      const fileLevel = levelFromFilename ?? folderLevel ?? bucketLevel;
      return { publicAssetId: stripped, assetUuid: null, fileLevel, strategy: 'filename-with-suffix-stripped' };
    }
  }

  // ── Strategy 5: any path segment matches public_asset_id ──
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (!isUuid(seg) && knownPublicIds.has(seg.toLowerCase())) {
      const levelFromFilename = inferLevel(filenameLower);
      const fileLevel = levelFromFilename ?? bucketLevel;
      return { publicAssetId: seg, assetUuid: null, fileLevel, strategy: 'path-segment' };
    }
  }

  return null;
}

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
    const mode: 'dry_run' | 'execute' = body.mode === 'execute' ? 'execute' : 'dry_run';

    // ── 1. List all files from both buckets ──────────────────────────────────
    const [thumbnailFiles, previewFiles] = await Promise.all([
      listBucketFiles(supabase, 'asset-thumbnails'),
      listBucketFiles(supabase, 'asset-previews'),
    ]);

    const allStorageFiles: { path: string; bucket: string; metadata: StorageFile['metadata'] }[] = [
      ...thumbnailFiles.map((f) => ({ ...f, bucket: 'asset-thumbnails' })),
      ...previewFiles.map((f) => ({ ...f, bucket: 'asset-previews' })),
    ];

    // ── 2. Load ALL assets into memory (both id UUID and public_asset_id) ────
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, public_asset_id, title');

    if (assetsError) {
      return NextResponse.json({ error: `Failed to fetch assets: ${assetsError.message}` }, { status: 500 });
    }

    // Map by public_asset_id (lowercase) → asset
    const assetByPublicId = new Map<string, { id: string; title: string; publicAssetId: string }>();
    // Map by assets.id UUID (lowercase) → asset
    const assetByUuid = new Map<string, { id: string; title: string; publicAssetId: string }>();
    // Sets for fast lookup in parsePath
    const knownPublicIds = new Set<string>();
    const knownUuids = new Set<string>();

    for (let asset of (assets || []) as { id: string; public_asset_id: string | null; title: string }[]) {
      const uuidKey = asset.id.toLowerCase();
      assetByUuid.set(uuidKey, {
        id: asset.id,
        title: asset.title,
        publicAssetId: asset.public_asset_id ?? '',
      });
      knownUuids.add(uuidKey);

      if (asset.public_asset_id) {
        const pubKey = asset.public_asset_id.toLowerCase().trim();
        assetByPublicId.set(pubKey, {
          id: asset.id,
          title: asset.title,
          publicAssetId: asset.public_asset_id,
        });
        knownPublicIds.add(pubKey);
      }
    }

    // ── 3. Load existing asset_files rows ────────────────────────────────────
    const { data: existingFiles, error: filesError } = await supabase
      .from('asset_files')
      .select('id, asset_id, file_level, storage_bucket, storage_path');

    if (filesError) {
      return NextResponse.json({ error: `Failed to fetch asset_files: ${filesError.message}` }, { status: 500 });
    }

    // Map: "bucket::path" -> existing file id
    const existingMap = new Map<string, string>();
    for (const f of (existingFiles || []) as { id: string; asset_id: string; file_level: string; storage_bucket: string; storage_path: string }[]) {
      existingMap.set(`${f.storage_bucket}::${f.storage_path}`, f.id);
    }

    // ── 4. Load existing asset_previews rows ─────────────────────────────────
    const { data: existingPreviews, error: previewsError } = await supabase
      .from('asset_previews')
      .select('id, asset_id, storage_bucket, storage_path');

    if (previewsError) {
      return NextResponse.json({ error: `Failed to fetch asset_previews: ${previewsError.message}` }, { status: 500 });
    }

    const existingPreviewMap = new Map<string, string>(); // "bucket::path" -> id
    for (const p of (existingPreviews || []) as { id: string; asset_id: string; storage_bucket: string; storage_path: string }[]) {
      existingPreviewMap.set(`${p.storage_bucket}::${p.storage_path}`, p.id);
    }

    // ── 5. Match storage files to assets ─────────────────────────────────────
    const matches: ReconcileMatch[] = [];
    const unmatchedPaths: string[] = [];
    let alreadyLinked = 0;
    let matchedByPublicAssetId = 0;
    let matchedByUuidAssetId = 0;
    const detectedFormats = new Set<string>();

    for (const sf of allStorageFiles) {
      const parsed = parsePath(sf.path, sf.bucket, knownPublicIds, knownUuids);
      if (!parsed) {
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (unrecognized path pattern)`);
        continue;
      }

      let asset: { id: string; title: string; publicAssetId: string } | undefined;

      if (parsed.strategy === 'uuid-asset-id' && parsed.assetUuid) {
        // Strategy 2: matched by assets.id UUID
        asset = assetByUuid.get(parsed.assetUuid.toLowerCase());
        if (asset) matchedByUuidAssetId++;
      } else {
        // Strategies 1, 3, 4, 5: matched by public_asset_id
        asset = assetByPublicId.get(parsed.publicAssetId.toLowerCase());
        if (asset) matchedByPublicAssetId++;
      }

      if (!asset) {
        const hint = parsed.assetUuid ? `uuid="${parsed.assetUuid}"` : `public_asset_id="${parsed.publicAssetId}"`;
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (no asset found for ${hint})`);
        continue;
      }

      detectedFormats.add(parsed.strategy);

      const key = `${sf.bucket}::${sf.path}`;
      const existingId = existingMap.get(key) ?? null;

      const mimeType = sf.metadata?.mimetype ?? null;
      const fileSizeBytes = sf.metadata?.size ?? null;

      matches.push({
        storagePath: sf.path,
        bucket: sf.bucket,
        publicAssetId: asset.publicAssetId,
        assetId: asset.id,
        assetTitle: asset.title,
        fileLevel: parsed.fileLevel,
        mimeType,
        fileSizeBytes,
        existingFileId: existingId,
        strategy: parsed.strategy,
      });

      if (existingId) alreadyLinked++;
    }

    const toInsert = matches.filter((m) => !m.existingFileId);
    const toUpdate = matches.filter((m) => !!m.existingFileId);

    const result: ReconcileResult = {
      mode,
      totalStorageFiles: allStorageFiles.length,
      matched: matches.length,
      matchedByPublicAssetId,
      matchedByUuidAssetId,
      unmatched: unmatchedPaths.length,
      alreadyLinked,
      toInsert: toInsert.length,
      toUpdate: toUpdate.length,
      inserted: 0,
      updated: 0,
      errors: [],
      unmatchedPaths,
      matches: mode === 'dry_run' ? matches.slice(0, 50) : [],
      detectedFormats: Array.from(detectedFormats),
    };

    if (mode === 'dry_run') {
      return NextResponse.json(result);
    }

    // ── 6. EXECUTE: upsert asset_files rows ──────────────────────────────────
    const BATCH_SIZE = 50;
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // INSERT new rows
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const rows = batch.map((m) => ({
        asset_id: m.assetId,
        file_level: m.fileLevel as 'thumbnail' | 'preview',
        storage_bucket: m.bucket,
        storage_path: m.storagePath,
        mime_type: m.mimeType,
        file_size_bytes: m.fileSizeBytes,
      }));

      const { error: insertError } = await supabase
        .from('asset_files')
        .insert(rows);

      if (insertError) {
        // Try upsert on conflict
        const { error: upsertError } = await supabase
          .from('asset_files')
          .upsert(rows, { onConflict: 'asset_id,file_level' });

        if (upsertError) {
          errors.push(`INSERT batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`);
        } else {
          inserted += batch.length;
        }
      } else {
        inserted += batch.length;
      }
    }

    // UPDATE existing rows (refresh mime_type and file_size_bytes)
    for (const m of toUpdate) {
      const { error: updateError } = await supabase
        .from('asset_files')
        .update({
          asset_id: m.assetId,
          mime_type: m.mimeType,
          file_size_bytes: m.fileSizeBytes,
        })
        .eq('id', m.existingFileId!);

      if (updateError) {
        errors.push(`UPDATE asset_files ${m.storagePath}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    // ── 7. EXECUTE: upsert asset_previews for preview-level files ────────────
    const previewMatches = matches.filter((m) => m.fileLevel === 'preview');

    for (let i = 0; i < previewMatches.length; i += BATCH_SIZE) {
      const batch = previewMatches.slice(i, i + BATCH_SIZE);
      const rows = batch.map((m) => ({
        asset_id: m.assetId,
        storage_bucket: m.bucket,
        storage_path: m.storagePath,
        preview_type: 'watermarked',
        watermark_applied: true,
      }));

      const { error: previewUpsertError } = await supabase
        .from('asset_previews')
        .upsert(rows, { onConflict: 'asset_id' });

      if (previewUpsertError) {
        errors.push(`UPSERT asset_previews batch ${Math.floor(i / BATCH_SIZE) + 1}: ${previewUpsertError.message}`);
      }
    }

    result.inserted = inserted;
    result.updated = updated;
    result.errors = errors;
    result.matches = []; // don't send full match list on execute

    return NextResponse.json(result);
  } catch (err) {
    console.error('Reconcile storage API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
