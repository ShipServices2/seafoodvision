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
  existingFileId: string | null; // null = will INSERT, string = will UPDATE
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

// Parse public_asset_id and file_level from storage path
// Expected pattern: pilot/{publicAssetId}/thumbnail.{ext} or pilot/{publicAssetId}/preview.{ext}
// Also handles: {publicAssetId}/thumbnail.{ext} (without pilot/ prefix)
function parsePath(storagePath: string): { publicAssetId: string; fileLevel: 'thumbnail' | 'preview' } | null {
  const parts = storagePath.split('/');
  if (parts.length < 2) return null;

  const filename = parts[parts.length - 1].toLowerCase();
  const folderName = parts[parts.length - 2];

  let fileLevel: 'thumbnail' | 'preview' | null = null;
  if (filename.startsWith('thumbnail')) fileLevel = 'thumbnail';
  else if (filename.startsWith('preview')) fileLevel = 'preview';

  if (!fileLevel) return null;
  if (!folderName) return null;

  return { publicAssetId: folderName, fileLevel };
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

    const assetMap = new Map<string, { id: string; title: string }>();
    for (const asset of (assets || []) as { id: string; public_asset_id: string; title: string }[]) {
      if (asset.public_asset_id) {
        assetMap.set(asset.public_asset_id.toLowerCase().trim(), { id: asset.id, title: asset.title });
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

    for (const sf of allStorageFiles) {
      const parsed = parsePath(sf.path);
      if (!parsed) {
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (unrecognized path pattern)`);
        continue;
      }

      const asset = assetMap.get(parsed.publicAssetId.toLowerCase());
      if (!asset) {
        unmatchedPaths.push(`${sf.bucket}/${sf.path} (no asset with public_asset_id="${parsed.publicAssetId}")`);
        continue;
      }

      const key = `${sf.bucket}::${sf.path}`;
      const existingId = existingMap.get(key) ?? null;

      // Determine if this is already perfectly linked (same bucket+path already in asset_files for this asset)
      // We still include it in matches but mark it
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
      matches: mode === 'dry_run' ? matches.slice(0, 50) : [], // preview only in dry_run
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

    return NextResponse.json(result);
  } catch (err) {
    console.error('Reconcile storage API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
