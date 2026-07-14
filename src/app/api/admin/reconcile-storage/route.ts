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
}

interface ReconcileResult {
  mode: 'dry_run' | 'execute';
  totalStorageFiles: number;
  matched: number;
  unmatched: number;
  alreadyLinked: number;
  toInsert: number;
  toUpdate: number;
  inserted: number;
  updated: number;
  errors: string[];
  unmatchedPaths: string[];
  matches: ReconcileMatch[];
  // Diagnostic info
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

/**
 * Multi-strategy path parser.
 *
 * Handles all known and likely path formats:
 *
 * Strategy 1 — folder-based (original assumption):
 *   pilot/{publicAssetId}/thumbnail.{ext}
 *   pilot/{publicAssetId}/preview.{ext}
 *   {publicAssetId}/thumbnail.{ext}
 *   {publicAssetId}/preview.{ext}
 *
 * Strategy 2 — flat file named after publicAssetId:
 *   SV-B500-0500.jpg                       → thumbnail (asset-thumbnails bucket)
 *   SV-B500-0500.jpg                       → preview   (asset-previews bucket)
 *
 * Strategy 3 — subfolder with publicAssetId as filename:
 *   thumbnails/SV-B500-0500.jpg
 *   previews/SV-B500-0500.jpg
 *   batch-500/SV-B500-0500.jpg
 *   pilot/SV-B500-0500.jpg
 *   any-folder/SV-B500-0500.jpg
 *
 * Strategy 4 — publicAssetId contains "thumbnail" or "preview" hint in path:
 *   SV-B500-0500_thumbnail.jpg
 *   SV-B500-0500_preview.jpg
 *
 * The file_level is inferred from:
 *   1. filename keyword (thumbnail/preview/thumb/watermark/wm)
 *   2. folder keyword (thumbnails/previews/thumb/preview)
 *   3. bucket name (asset-thumbnails → thumbnail, asset-previews → preview)
 */
function parsePath(
  storagePath: string,
  bucket: string,
  knownIds: Set<string>
): { publicAssetId: string; fileLevel: 'thumbnail' | 'preview'; strategy: string } | null {
  const parts = storagePath.split('/');
  const rawFilename = parts[parts.length - 1];
  const filenameLower = rawFilename.toLowerCase();
  const filenameNoExt = rawFilename.replace(/\.[^.]+$/, '');
  const filenameNoExtLower = filenameNoExt.toLowerCase();

  // Must be a media file
  if (!isMediaFile(rawFilename)) return null;

  // Infer file_level from bucket as fallback
  const bucketLevel: 'thumbnail' | 'preview' =
    bucket === 'asset-thumbnails' ? 'thumbnail' : 'preview';

  // Helper: infer file_level from a string (filename or folder name)
  function inferLevel(s: string): 'thumbnail' | 'preview' | null {
    const sl = s.toLowerCase();
    if (sl.includes('thumbnail') || sl.includes('thumb') || sl === 'thumbnails') return 'thumbnail';
    if (sl.includes('preview') || sl.includes('watermark') || sl.includes('_wm') || sl === 'previews') return 'preview';
    return null;
  }

  // ── Strategy 1: folder-based (pilot/{id}/thumbnail.ext or {id}/thumbnail.ext) ──
  if (parts.length >= 2) {
    const folderName = parts[parts.length - 2];
    const levelFromFilename = inferLevel(filenameLower);
    if (levelFromFilename && folderName) {
      // The folder is the publicAssetId
      const candidate = folderName;
      if (knownIds.has(candidate.toLowerCase())) {
        return { publicAssetId: candidate, fileLevel: levelFromFilename, strategy: 'folder-based' };
      }
    }
  }

  // ── Strategy 2 & 3: filename IS the publicAssetId (with or without subfolder) ──
  // Try the bare filename (no extension) as publicAssetId
  // Also try stripping _thumbnail / _preview / _thumb / _wm suffixes
  const candidateNames = [
    filenameNoExt,
    filenameNoExt.replace(/_thumbnail$/i, ''),
    filenameNoExt.replace(/_preview$/i, ''),
    filenameNoExt.replace(/_thumb$/i, ''),
    filenameNoExt.replace(/_watermark$/i, ''),
    filenameNoExt.replace(/_wm$/i, ''),
    filenameNoExt.replace(/-thumbnail$/i, ''),
    filenameNoExt.replace(/-preview$/i, ''),
    filenameNoExt.replace(/-thumb$/i, ''),
  ];

  for (const candidate of candidateNames) {
    if (!candidate) continue;
    if (knownIds.has(candidate.toLowerCase())) {
      // Determine file_level: check filename suffix first, then folder, then bucket
      const levelFromFilename = inferLevel(filenameNoExtLower);
      const folderLevel = parts.length >= 2 ? inferLevel(parts[parts.length - 2]) : null;
      const fileLevel = levelFromFilename ?? folderLevel ?? bucketLevel;
      const strategy = candidate === filenameNoExt ? 'flat-filename' : 'filename-with-suffix-stripped';
      return { publicAssetId: candidate, fileLevel, strategy };
    }
  }

  // ── Strategy 4: path contains publicAssetId as a path segment (not the last folder) ──
  // e.g. pilot/SV-B500-0500/thumbnail.jpg — already covered by strategy 1
  // but also: some/deep/SV-B500-0500/file.jpg
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (knownIds.has(seg.toLowerCase())) {
      const levelFromFilename = inferLevel(filenameLower);
      const fileLevel = levelFromFilename ?? bucketLevel;
      return { publicAssetId: seg, fileLevel, strategy: 'path-segment' };
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

    // ── 2. Load all assets with public_asset_id ──────────────────────────────
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, public_asset_id, title')
      .not('public_asset_id', 'is', null);

    if (assetsError) {
      return NextResponse.json({ error: `Failed to fetch assets: ${assetsError.message}` }, { status: 500 });
    }

    const assetMap = new Map<string, { id: string; title: string; publicAssetId: string }>();
    // Build a set of all known public_asset_ids (lowercase) for fast lookup
    const knownIds = new Set<string>();

    for (const asset of (assets || []) as { id: string; public_asset_id: string; title: string }[]) {
      if (asset.public_asset_id) {
        const key = asset.public_asset_id.toLowerCase().trim();
        assetMap.set(key, { id: asset.id, title: asset.title, publicAssetId: asset.public_asset_id });
        knownIds.add(key);
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

    // ── 4. Match storage files to assets ─────────────────────────────────────
    const matches: ReconcileMatch[] = [];
    const unmatchedPaths: string[] = [];
    let alreadyLinked = 0;
    const detectedFormats = new Set<string>();

    for (const sf of allStorageFiles) {
      const parsed = parsePath(sf.path, sf.bucket, knownIds);
      if (!parsed) {
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (unrecognized path pattern)`);
        continue;
      }

      const asset = assetMap.get(parsed.publicAssetId.toLowerCase());
      if (!asset) {
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (no asset with public_asset_id="${parsed.publicAssetId}")`);
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
        publicAssetId: parsed.publicAssetId,
        assetId: asset.id,
        assetTitle: asset.title,
        fileLevel: parsed.fileLevel,
        mimeType,
        fileSizeBytes,
        existingFileId: existingId,
      });

      if (existingId) alreadyLinked++;
    }

    const toInsert = matches.filter((m) => !m.existingFileId);
    const toUpdate = matches.filter((m) => !!m.existingFileId);

    const result: ReconcileResult = {
      mode,
      totalStorageFiles: allStorageFiles.length,
      matched: matches.length,
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

    // ── 5. EXECUTE: upsert asset_files rows ──────────────────────────────────
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
        errors.push(`INSERT batch ${i / BATCH_SIZE + 1}: ${insertError.message}`);
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
        errors.push(`UPDATE ${m.storagePath}: ${updateError.message}`);
      } else {
        updated++;
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
