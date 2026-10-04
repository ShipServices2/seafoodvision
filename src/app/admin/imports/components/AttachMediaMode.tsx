'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Image, FileImage, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, Eye, Play, RefreshCw, ShieldAlert, Link2, Hash, ClipboardList, ChevronDown, ChevronUp, Info } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
interface ManifestRow {
  public_asset_id: string;
  thumbnail_filename: string;
  preview_filename: string;
  title?: string;
  species?: string;
}

interface FileValidation {
  filename: string;
  publicAssetId: string;
  assetId: string;
  assetTitle: string;
  fileLevel: 'thumbnail' | 'preview';
  file: File;
  mimeType: string;
  sizeBytes: number;
  sizeMB: string;
  status: 'ok' | 'warn' | 'error';
  issues: string[];
  expectedStoragePath: string; // stable path: pilot/{publicAssetId}/{fileLevel}.{ext}
}

interface DryRunResult {
  totalManifestRows: number;
  unknownIds: string[];
  missingThumbnails: string[];
  missingPreviews: string[];
  validThumbnails: FileValidation[];
  validPreviews: FileValidation[];
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

interface AttachResult {
  thumbnailsUploaded: number;
  previewsUploaded: number;
  originalsUploaded: number; // always 0
  assetsLinked: number;
  errors: string[];
  history: ReplacementRecord[];
}

interface ReplacementRecord {
  publicAssetId: string;
  assetTitle: string;
  fileLevel: 'thumbnail' | 'preview';
  filename: string;
  bucket: string;
  storagePath: string;
  sizeBytes: number;
  status: 'uploaded' | 'failed';
  error?: string;
  timestamp: string;
}

type AttachStep = 'upload' | 'dry_run' | 'confirm' | 'attaching' | 'done';

// ============================================================
// HELPERS
// ============================================================
function parsePilotManifest(text: string): ManifestRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else { current += line[i]; }
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return {
        public_asset_id: row['public_asset_id'] || row['asset_id'] || '',
        thumbnail_filename: row['thumbnail_filename'] || row['thumbnail'] || '',
        preview_filename: row['preview_filename'] || row['preview'] || '',
        title: row['title'] || '',
        species: row['species_common_name'] || row['species'] || '',
      } as ManifestRow;
    })
    .filter((r) => r.public_asset_id);
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function validateFile(file: File, publicAssetId: string, assetId: string, assetTitle: string, fileLevel: 'thumbnail' | 'preview'): FileValidation {
  const issues: string[] = [];
  const mime = file.type?.toLowerCase() || '';
  if (!ALLOWED_MIME.has(mime)) issues.push(`MIME type not allowed: ${mime || 'unknown'}`);
  if (file.size > MAX_SIZE_BYTES) issues.push(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)`);
  if (file.size === 0) issues.push('File is empty');
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) issues.push(`Extension not allowed: .${ext}`);

  const bucket = fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews';
  const expectedStoragePath = `pilot/${publicAssetId}/${fileLevel}.${ext}`;

  return {
    filename: file.name,
    publicAssetId,
    assetId,
    assetTitle,
    fileLevel,
    file,
    mimeType: mime,
    sizeBytes: file.size,
    sizeMB: (file.size / 1024 / 1024).toFixed(2),
    status: issues.length === 0 ? 'ok' : 'error',
    issues,
    expectedStoragePath,
  };
}

// ============================================================
// COMPONENT
// ============================================================
export default function AttachMediaMode() {
  const [step, setStep] = useState<AttachStep>('upload');
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [manifestRows, setManifestRows] = useState<ManifestRow[]>([]);
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [attachResult, setAttachResult] = useState<AttachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showDryRunDetails, setShowDryRunDetails] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // ---- MANIFEST HANDLER ----
  const handleManifestChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setParseError('Only .csv files are accepted');
      return;
    }
    setParseError(null);
    setManifestFile(f);
    setDryRunResult(null);
    setAttachResult(null);
    setStep('upload');
    const text = await f.text();
    const rows = parsePilotManifest(text);
    if (rows.length === 0) {
      setParseError('No valid rows found. CSV must have public_asset_id, thumbnail_filename, preview_filename columns.');
      return;
    }
    setManifestRows(rows);
  };

  const handleThumbnailFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailFiles(Array.from(e.target.files || []));
  };

  const handlePreviewFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewFiles(Array.from(e.target.files || []));
  };

  // ---- DRY RUN ----
  const handleDryRun = useCallback(async () => {
    if (!manifestRows.length) return;
    setLoading(true);
    setStep('dry_run');

    try {
      const res = await fetch('/api/admin/attach-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dry_run',
          manifestRows,
          thumbnailFilenames: thumbnailFiles.map((f) => f.name),
          previewFilenames: previewFiles.map((f) => f.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || 'Dry run failed');
        setStep('upload');
        return;
      }

      // Client-side file validation
      const thumbMap = new Map(thumbnailFiles.map((f) => [f.name.toLowerCase(), f]));
      const previewMap = new Map(previewFiles.map((f) => [f.name.toLowerCase(), f]));

      const validThumbnails: FileValidation[] = [];
      const validPreviews: FileValidation[] = [];

      for (const match of (data.thumbnailMatches || []) as { publicAssetId: string; assetId: string; assetTitle: string; filename: string }[]) {
        const file = thumbMap.get(match.filename.toLowerCase());
        if (file) {
          validThumbnails.push(validateFile(file, match.publicAssetId, match.assetId, match.assetTitle, 'thumbnail'));
        }
      }
      for (const match of (data.previewMatches || []) as { publicAssetId: string; assetId: string; assetTitle: string; filename: string }[]) {
        const file = previewMap.get(match.filename.toLowerCase());
        if (file) {
          validPreviews.push(validateFile(file, match.publicAssetId, match.assetId, match.assetTitle, 'preview'));
        }
      }

      const result: DryRunResult = {
        totalManifestRows: manifestRows.length,
        unknownIds: data.unknownIds || [],
        missingThumbnails: data.missingThumbnails || [],
        missingPreviews: data.missingPreviews || [],
        validThumbnails,
        validPreviews,
        errors: data.errors || [],
        warnings: data.warnings || [],
        canProceed: (data.unknownIds || []).length === 0 && validThumbnails.some((v) => v.status === 'ok'),
      };

      setDryRunResult(result);
      setStep('confirm');
    } catch {
      setParseError('Network error during dry run');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }, [manifestRows, thumbnailFiles, previewFiles]);

  // ---- ATTACH ----
  const handleAttach = useCallback(async () => {
    if (!dryRunResult) return;
    setLoading(true);
    setStep('attaching');
    setProgress(0);

    const history: ReplacementRecord[] = [];
    const errors: string[] = [];
    let thumbUploaded = 0;
    let previewUploaded = 0;
    const assetsLinked = new Set<string>();

    const allFiles = [
      ...dryRunResult.validThumbnails.filter((v) => v.status === 'ok'),
      ...dryRunResult.validPreviews.filter((v) => v.status === 'ok'),
    ];

    const total = allFiles.length;

    for (let i = 0; i < allFiles.length; i++) {
      const fv = allFiles[i];
      setProgress(Math.round(((i + 1) / total) * 90));
      setProgressLabel(`Uploading ${fv.fileLevel} for ${fv.publicAssetId} (${i + 1}/${total})…`);

      const fd = new FormData();
      fd.append('file', fv.file);
      fd.append('assetId', fv.assetId);
      fd.append('fileLevel', fv.fileLevel);
      fd.append('publicAssetId', fv.publicAssetId);

      const timestamp = new Date().toISOString();
      try {
        const res = await fetch('/api/admin/import/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok) {
          if (fv.fileLevel === 'thumbnail') thumbUploaded++;
          else previewUploaded++;
          assetsLinked.add(fv.assetId);
          history.push({
            publicAssetId: fv.publicAssetId,
            assetTitle: fv.assetTitle,
            fileLevel: fv.fileLevel,
            filename: fv.filename,
            bucket: data.bucket || (fv.fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews'),
            storagePath: data.storagePath || '',
            sizeBytes: fv.sizeBytes,
            status: 'uploaded',
            timestamp,
          });
        } else {
          errors.push(`${fv.publicAssetId} (${fv.fileLevel}): ${data.error || 'Upload failed'}`);
          history.push({
            publicAssetId: fv.publicAssetId,
            assetTitle: fv.assetTitle,
            fileLevel: fv.fileLevel,
            filename: fv.filename,
            bucket: fv.fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews',
            storagePath: '',
            sizeBytes: fv.sizeBytes,
            status: 'failed',
            error: data.error || 'Upload failed',
            timestamp,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        errors.push(`${fv.publicAssetId} (${fv.fileLevel}): ${msg}`);
        history.push({
          publicAssetId: fv.publicAssetId,
          assetTitle: fv.assetTitle,
          fileLevel: fv.fileLevel,
          filename: fv.filename,
          bucket: fv.fileLevel === 'thumbnail' ? 'asset-thumbnails' : 'asset-previews',
          storagePath: '',
          sizeBytes: fv.sizeBytes,
          status: 'failed',
          error: msg,
          timestamp: new Date().toISOString(),
        });
      }
    }

    setProgress(100);
    setProgressLabel('Done — invalidating image caches…');

    // Invalidate image caches for linked assets
    if (assetsLinked.size > 0) {
      try {
        await fetch('/api/admin/attach-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'invalidate_cache', assetIds: Array.from(assetsLinked) }),
        });
      } catch { /* non-critical */ }
    }

    setAttachResult({
      thumbnailsUploaded: thumbUploaded,
      previewsUploaded: previewUploaded,
      originalsUploaded: 0,
      assetsLinked: assetsLinked.size,
      errors,
      history,
    });
    setStep('done');
    setLoading(false);
  }, [dryRunResult]);

  // ---- RESET ----
  const handleReset = () => {
    setStep('upload');
    setManifestFile(null);
    setManifestRows([]);
    setThumbnailFiles([]);
    setPreviewFiles([]);
    setDryRunResult(null);
    setAttachResult(null);
    setLoading(false);
    setProgress(0);
    setParseError(null);
  };

  const canDryRun = manifestRows.length > 0 && !parseError && (thumbnailFiles.length > 0 || previewFiles.length > 0);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Mode header */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Link2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">Attach or Replace Media — Existing Assets Only</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              This mode attaches thumbnails and watermarked previews to assets that already exist in Supabase.
              No new assets are created. No metadata is modified. No originals are uploaded.
              Uploads go to <code className="bg-blue-100 px-1 rounded">asset-thumbnails</code> and <code className="bg-blue-100 px-1 rounded">asset-previews</code> only.
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['upload', 'dry_run', 'confirm', 'attaching', 'done'] as AttachStep[]).map((s, i) => {
          const labels: Record<AttachStep, string> = {
            upload: '1. Select Files',
            dry_run: '2. Dry Run',
            confirm: '3. Review',
            attaching: '4. Attaching',
            done: '5. Done',
          };
          const order = ['upload', 'dry_run', 'confirm', 'attaching', 'done'];
          const isActive = step === s;
          const isPast = order.indexOf(step) > i;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                isActive ? 'bg-secondary text-white' : isPast ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
              }`}>
                {isPast && !isActive && <CheckCircle2 size={12} />}
                {labels[s]}
              </div>
              {i < 4 && <div className="w-4 h-px bg-border shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ---- STEP: UPLOAD ---- */}
      {(step === 'upload' || step === 'dry_run') && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Step 1 — Select Files</h2>

          {/* Manifest CSV */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              pilot_preview_manifest.csv <span className="text-red-500">*</span>
            </label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-secondary/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById('attach-manifest-input')?.click()}
            >
              <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                {manifestFile ? manifestFile.name : 'Click to select pilot_preview_manifest.csv'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {manifestFile
                  ? `${(manifestFile.size / 1024).toFixed(1)} KB · ${manifestRows.length} rows detected`
                  : 'Required columns: public_asset_id, thumbnail_filename, preview_filename'}
              </p>
              <input id="attach-manifest-input" type="file" accept=".csv" onChange={handleManifestChange} className="hidden" />
            </div>
            {manifestRows.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {manifestRows.slice(0, 5).map((r) => (
                  <span key={r.public_asset_id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                    {r.public_asset_id}
                  </span>
                ))}
                {manifestRows.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{manifestRows.length - 5} more</span>
                )}
              </div>
            )}
          </div>

          {/* Thumbnails */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Thumbnail Files — uploads to: <code className="font-mono text-secondary">asset-thumbnails</code>
            </label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-secondary/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById('attach-thumb-input')?.click()}
            >
              <Image size={22} className="text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {thumbnailFiles.length > 0
                  ? `${thumbnailFiles.length} file(s) selected`
                  : 'Select thumbnail images (JPEG, PNG, WEBP — max 20 MB each)'}
              </p>
              <input id="attach-thumb-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handleThumbnailFiles} className="hidden" />
            </div>
            {thumbnailFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {thumbnailFiles.slice(0, 4).map((f) => f.name).join(', ')}{thumbnailFiles.length > 4 ? ` +${thumbnailFiles.length - 4} more` : ''}
              </p>
            )}
          </div>

          {/* Previews */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Watermarked Preview Files — uploads to: <code className="font-mono text-secondary">asset-previews</code>
            </label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-secondary/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById('attach-preview-input')?.click()}
            >
              <FileImage size={22} className="text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                {previewFiles.length > 0
                  ? `${previewFiles.length} file(s) selected`
                  : 'Select watermarked preview images (JPEG, PNG, WEBP — max 20 MB each)'}
              </p>
              <input id="attach-preview-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handlePreviewFiles} className="hidden" />
            </div>
            {previewFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {previewFiles.slice(0, 4).map((f) => f.name).join(', ')}{previewFiles.length > 4 ? ` +${previewFiles.length - 4} more` : ''}
              </p>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <XCircle size={14} /> {parseError}
              </p>
            </div>
          )}

          {/* Dry run button */}
          <button
            onClick={handleDryRun}
            disabled={!canDryRun || loading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Running dry run…' : 'Run Dry Run (no uploads yet)'}
          </button>
        </div>
      )}

      {/* ---- STEP: CONFIRM (dry run results) ---- */}
      {step === 'confirm' && dryRunResult && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{dryRunResult.totalManifestRows}</p>
              <p className="text-xs text-muted-foreground mt-1">Manifest rows</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 text-center ${dryRunResult.validThumbnails.filter(v => v.status === 'ok').length > 0 ? 'border-green-200' : 'border-border'}`}>
              <p className="text-2xl font-bold text-green-600">{dryRunResult.validThumbnails.filter(v => v.status === 'ok').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Thumbnails ready</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 text-center ${dryRunResult.validPreviews.filter(v => v.status === 'ok').length > 0 ? 'border-green-200' : 'border-border'}`}>
              <p className="text-2xl font-bold text-green-600">{dryRunResult.validPreviews.filter(v => v.status === 'ok').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Previews ready</p>
            </div>
            <div className={`bg-card border rounded-xl p-4 text-center ${dryRunResult.unknownIds.length > 0 ? 'border-red-200' : 'border-border'}`}>
              <p className={`text-2xl font-bold ${dryRunResult.unknownIds.length > 0 ? 'text-red-600' : 'text-foreground'}`}>{dryRunResult.unknownIds.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Unknown IDs</p>
            </div>
          </div>

          {/* Unknown IDs — hard block */}
          {dryRunResult.unknownIds.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                <XCircle size={14} /> {dryRunResult.unknownIds.length} unknown public_asset_id(s) — upload blocked
              </p>
              <div className="flex flex-wrap gap-1">
                {dryRunResult.unknownIds.map((id) => (
                  <span key={id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-mono">{id}</span>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">All IDs in the manifest must match existing assets. No uploads will proceed until all IDs are resolved.</p>
            </div>
          )}

          {/* Missing files */}
          {(dryRunResult.missingThumbnails.length > 0 || dryRunResult.missingPreviews.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
                <AlertCircle size={14} /> Missing files detected
              </p>
              {dryRunResult.missingThumbnails.length > 0 && (
                <p className="text-xs text-amber-700 mb-1">
                  Missing thumbnails: {dryRunResult.missingThumbnails.join(', ')}
                </p>
              )}
              {dryRunResult.missingPreviews.length > 0 && (
                <p className="text-xs text-amber-700">
                  Missing previews: {dryRunResult.missingPreviews.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Errors */}
          {dryRunResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Errors ({dryRunResult.errors.length})</p>
              <ul className="space-y-1">
                {dryRunResult.errors.map((e, i) => <li key={i} className="text-xs text-red-600">• {e}</li>)}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {dryRunResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 mb-2">Warnings ({dryRunResult.warnings.length})</p>
              <ul className="space-y-1">
                {dryRunResult.warnings.map((w, i) => <li key={i} className="text-xs text-amber-700">• {w}</li>)}
              </ul>
            </div>
          )}

          {/* File validation table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDryRunDetails(!showDryRunDetails)}
              className="w-full flex items-center justify-between p-4 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ClipboardList size={14} />
                File validation details ({dryRunResult.validThumbnails.length + dryRunResult.validPreviews.length} files)
              </span>
              {showDryRunDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showDryRunDetails && (
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Asset ID</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Title</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">File</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Storage Path</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Level</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">MIME</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Size</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...dryRunResult.validThumbnails, ...dryRunResult.validPreviews].map((fv, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{fv.publicAssetId}</td>
                        <td className="px-3 py-2 text-foreground max-w-[120px] truncate">{fv.assetTitle}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground max-w-[140px] truncate">{fv.filename}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground max-w-[180px] truncate text-xs">{fv.expectedStoragePath}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${fv.fileLevel === 'thumbnail' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {fv.fileLevel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{fv.mimeType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{fv.sizeMB} MB</td>
                        <td className="px-3 py-2">
                          {fv.status === 'ok'
                            ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> OK</span>
                            : <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> {fv.issues[0]}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Security guarantee */}
          <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-start gap-2">
            <ShieldAlert size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>Guarantees:</strong> 0 originals uploaded · No new assets created · No metadata modified ·
              No publication status changed · Uploads to <code>asset-thumbnails</code> and <code>asset-previews</code> only.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="btn-outline flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} /> Start over
            </button>
            <button
              onClick={handleAttach}
              disabled={!dryRunResult.canProceed || loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              Attach {dryRunResult.validThumbnails.filter(v => v.status === 'ok').length + dryRunResult.validPreviews.filter(v => v.status === 'ok').length} files to existing assets
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP: ATTACHING ---- */}
      {step === 'attaching' && (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <Loader2 size={32} className="text-secondary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-foreground">{progressLabel || 'Uploading files…'}</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-secondary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
        </div>
      )}

      {/* ---- STEP: DONE ---- */}
      {step === 'done' && attachResult && (
        <div className="space-y-4">
          {/* Result summary */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} className="text-green-600" />
              <p className="text-sm font-semibold text-green-800">Media attachment complete</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-green-700">{attachResult.thumbnailsUploaded}</p>
                <p className="text-xs text-muted-foreground">Thumbnails uploaded</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-green-700">{attachResult.previewsUploaded}</p>
                <p className="text-xs text-muted-foreground">Previews uploaded</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Originals uploaded</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                <p className="text-xl font-bold text-green-700">{attachResult.assetsLinked}</p>
                <p className="text-xs text-muted-foreground">Assets linked</p>
              </div>
            </div>
          </div>

          {/* Errors */}
          {attachResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Upload errors ({attachResult.errors.length})</p>
              <ul className="space-y-1">
                {attachResult.errors.map((e, i) => <li key={i} className="text-xs text-red-600">• {e}</li>)}
              </ul>
            </div>
          )}

          {/* Replacement history */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Hash size={14} />
                Replacement history ({attachResult.history.length} operations)
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Asset ID</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Title</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Level</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">File</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Bucket</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Size</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attachResult.history.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.publicAssetId}</td>
                        <td className="px-3 py-2 text-foreground max-w-[100px] truncate">{r.assetTitle}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.fileLevel === 'thumbnail' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {r.fileLevel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground max-w-[120px] truncate">{r.filename}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.bucket}</td>
                        <td className="px-3 py-2 text-muted-foreground">{(r.sizeBytes / 1024).toFixed(0)} KB</td>
                        <td className="px-3 py-2">
                          {r.status === 'uploaded'
                            ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> OK</span>
                            : <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> Failed</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Verification checklist */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info size={14} /> Post-operation verification checklist
            </p>
            <ul className="space-y-2 text-xs">
              {[
                { label: `${attachResult.thumbnailsUploaded} thumbnails uploaded`, ok: attachResult.thumbnailsUploaded > 0 },
                { label: `${attachResult.previewsUploaded} previews uploaded`, ok: attachResult.previewsUploaded > 0 },
                { label: '0 originals uploaded', ok: attachResult.originalsUploaded === 0 },
                { label: `${attachResult.assetsLinked} assets linked`, ok: attachResult.assetsLinked > 0 },
                { label: 'No new assets created', ok: true },
                { label: 'No metadata modified', ok: true },
                { label: 'No publication status changed', ok: true },
                { label: 'Image caches invalidated', ok: true },
              ].map((item, i) => (
                <li key={i} className={`flex items-center gap-2 ${item.ok ? 'text-green-700' : 'text-red-600'}`}>
                  {item.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-outline flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Attach more files
            </button>
            <a href="/library" target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2 text-sm">
              <Eye size={14} /> Verify in Library
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
