'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Circle as XCircle, FileText, Eye, Play, Loader as Loader2, ChevronDown, ChevronUp, Package, Fish, Tag, Hash, Image, FileImage, ClipboardList, RefreshCw, ShieldAlert, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { ImportBatch } from '@/lib/supabase/types';
import { ALLOWED_CSV_COLUMNS } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AttachMediaMode from './components/AttachMediaMode';
import { scanRowForSensitiveData } from '@/lib/importValidator';

// ============================================================
// SECURITY PATTERNS — now handled by shared importValidator
// (removed inline REJECT_PATTERNS — use scanRowForSensitiveData)
// ============================================================

// ============================================================
// TYPES
// ============================================================
interface DryRunReport {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  rejectionDetails: { row: number; reason: string }[];
  duplicatesDetected: number;
  duplicates: string[];
  sensitiveDataFound: string[];
  newSpecies: string[];
  newCategories: string[];
  newKeywords: string[];
  estimatedSizeMB: string;
  preview: Record<string, string>[];
}

interface ImportReport extends DryRunReport {
  importedCount: number;
  speciesCreated: number;
  categoriesCreated: number;
  keywordsCreated: number;
  importErrors: string[];
  finalStatus: 'completed' | 'partially_imported' | 'failed';
  thumbnailsUploaded?: number;
  previewsUploaded?: number;
}

type Step = 'upload' | 'dry_run' | 'confirm' | 'importing' | 'done';

// ============================================================
// CSV PARSER
// ============================================================
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
      values.push(current.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
    });
}

// ============================================================
// CLIENT-SIDE PRE-VALIDATION
// ============================================================
function clientValidate(rows: Record<string, string>[]): { errors: string[]; warnings: string[]; sensitiveCount: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sensitiveCount = 0;

  if (rows.length === 0) {
    errors.push('CSV file is empty or has no data rows');
    return { errors, warnings, sensitiveCount };
  }

  const headers = Object.keys(rows[0]);
  const unknownCols = headers.filter((h) => !ALLOWED_CSV_COLUMNS.includes(h as never));
  if (unknownCols.length > 0) {
    warnings.push(`Unknown columns (will be ignored): ${unknownCols.join(', ')}`);
  }
  if (!headers.includes('title')) {
    errors.push('Missing required column: title');
  }

  rows.forEach((row, idx) => {
    // Per-cell scanning: each column value is checked individually.
    // The phone-number regex is skipped for numeric columns (width, height,
    // confidence_score, technical_score, commercial_score) to prevent
    // false positives like "3840 2160" being flagged as a phone number.
    const match = scanRowForSensitiveData(row);
    if (match) {
      errors.push(
        `Row ${idx + 1} — column ${match.columnName} — ${match.rejectionType}`
      );
      sensitiveCount++;
    }
  });

  return { errors, warnings, sensitiveCount };
}

// ============================================================
// STATUS BADGE COLORS
// ============================================================
const batchStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  partially_imported: 'bg-amber-100 text-amber-700',
};

// ============================================================
// MAIN PAGE
// ============================================================
export default function AdminImportsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [importMode, setImportMode] = useState<'new_assets' | 'attach_media'>('new_assets');
  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [clientWarnings, setClientWarnings] = useState<string[]>([]);
  const [clientSensitiveCount, setClientSensitiveCount] = useState(0);
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('Codex Pilot 100');
  const [batchNotes, setBatchNotes] = useState('First real Seafood Vision MVP catalog import.');
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressLabel, setImportProgressLabel] = useState('');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showRejections, setShowRejections] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [showBatchHistory, setShowBatchHistory] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/imports');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/admin');
    }
  }, [user, profile, loading, router]);

  const loadBatches = useCallback(async () => {
    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) return;
    setBatchesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setBatches((data as ImportBatch[]) || []);
    setBatchesLoading(false);
  }, [profile]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // ---- CSV FILE HANDLER ----
  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setClientErrors(['Only .csv files are accepted']);
      return;
    }
    setCsvFile(f);
    setDryRunReport(null);
    setImportReport(null);
    setStep('upload');

    const text = await f.text();
    const rows = parseCsv(text);
    setCsvRows(rows);
    const { errors, warnings, sensitiveCount } = clientValidate(rows);
    setClientErrors(errors);
    setClientWarnings(warnings);
    setClientSensitiveCount(sensitiveCount);
  };

  const handleThumbnailFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailFiles(Array.from(e.target.files || []));
  };

  const handlePreviewFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewFiles(Array.from(e.target.files || []));
  };

  // ---- DRY RUN ----
  const handleDryRun = async () => {
    if (!csvRows.length || clientErrors.length > 0) return;
    setDryRunLoading(true);
    setStep('dry_run');

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'dry_run', rows: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClientErrors([data.error || 'Dry run failed']);
        setStep('upload');
      } else {
        setDryRunReport(data.report);
        setStep('confirm');
      }
    } catch {
      setClientErrors(['Network error during dry run']);
      setStep('upload');
    } finally {
      setDryRunLoading(false);
    }
  };

  // ---- IMPORT ----
  const handleImport = async () => {
    if (!dryRunReport || dryRunReport.validRows === 0) return;
    setImportLoading(true);
    setStep('importing');
    setImportProgress(10);
    setImportProgressLabel('Step 1 — Creating import batch…');

    try {
      setImportProgress(20);
      setImportProgressLabel('Steps 2–4 — Inserting categories, species, assets…');

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import', rows: csvRows, batchName, batchNotes }),
      });
      const data = await res.json();

      if (!res.ok) {
        setClientErrors([data.error || 'Import failed']);
        setStep('confirm');
        setImportLoading(false);
        return;
      }

      setImportProgress(50);
      setImportProgressLabel('Steps 5–7 — Linking species, keywords, relations…');

      // Brief pause to show progress
      await new Promise((r) => setTimeout(r, 300));

      setImportProgress(60);
      setImportProgressLabel('Step 8 — Uploading thumbnails to asset-thumbnails…');

      let thumbUploaded = 0;
      let previewUploaded = 0;

      if (thumbnailFiles.length > 0 && data.batchId) {
        const supabase = createClient();
        const { data: newAssets } = await supabase
          .from('assets')
          .select('id, public_asset_id, slug')
          .eq('is_demo', false)
          .order('created_at', { ascending: false })
          .limit(csvRows.length + 10);

        const assetMap = new Map<string, string>();
        (newAssets || []).forEach((a: { id: string; public_asset_id: string | null; slug: string }) => {
          if (a.public_asset_id) assetMap.set(a.public_asset_id.toLowerCase(), a.id);
          assetMap.set(a.slug, a.id);
        });

        for (const file of thumbnailFiles) {
          const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
          const assetId = assetMap.get(baseName)
            || assetMap.get(baseName.replace(/_thumb(nail)?$/, ''))
            || assetMap.get(baseName.replace(/_t$/, ''));
          if (!assetId) continue;

          const fd = new FormData();
          fd.append('file', file);
          fd.append('assetId', assetId);
          fd.append('fileLevel', 'thumbnail');

          const uploadRes = await fetch('/api/admin/import/upload', { method: 'POST', body: fd });
          if (uploadRes.ok) thumbUploaded++;
        }
      }

      setImportProgress(80);
      setImportProgressLabel('Step 9 — Uploading watermarked previews to asset-previews…');

      if (previewFiles.length > 0 && data.batchId) {
        const supabase = createClient();
        const { data: newAssets } = await supabase
          .from('assets')
          .select('id, public_asset_id, slug')
          .eq('is_demo', false)
          .order('created_at', { ascending: false })
          .limit(csvRows.length + 10);

        const assetMap = new Map<string, string>();
        (newAssets || []).forEach((a: { id: string; public_asset_id: string | null; slug: string }) => {
          if (a.public_asset_id) assetMap.set(a.public_asset_id.toLowerCase(), a.id);
          assetMap.set(a.slug, a.id);
        });

        for (const file of previewFiles) {
          const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
          const assetId = assetMap.get(baseName)
            || assetMap.get(baseName.replace(/_preview$/, ''))
            || assetMap.get(baseName.replace(/_watermark$/, ''))
            || assetMap.get(baseName.replace(/_wm$/, ''));
          if (!assetId) continue;

          const fd = new FormData();
          fd.append('file', file);
          fd.append('assetId', assetId);
          fd.append('fileLevel', 'preview');

          const uploadRes = await fetch('/api/admin/import/upload', { method: 'POST', body: fd });
          if (uploadRes.ok) previewUploaded++;
        }
      }

      setImportProgress(100);
      setImportProgressLabel('Step 10 — Finalizing batch report…');

      setImportReport({
        ...data.report,
        thumbnailsUploaded: thumbUploaded,
        previewsUploaded: previewUploaded,
      } as ImportReport);

      setStep('done');
      loadBatches();
    } catch {
      setClientErrors(['Network error during import']);
      setStep('confirm');
    } finally {
      setImportLoading(false);
    }
  };

  // ---- RESET ----
  const handleReset = () => {
    setCsvFile(null);
    setCsvRows([]);
    setClientErrors([]);
    setClientWarnings([]);
    setClientSensitiveCount(0);
    setThumbnailFiles([]);
    setPreviewFiles([]);
    setDryRunReport(null);
    setImportReport(null);
    setStep('upload');
    setImportProgress(0);
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = ['administrator', 'super_admin'].includes(profile.role);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Upload size={18} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Secure Import Pipeline</h1>
              <p className="text-sm text-muted-foreground">Codex Pilot Batch Import — 10-step transactional workflow</p>
            </div>
          </div>
          {importMode === 'new_assets' && step !== 'upload' && (
            <button onClick={handleReset} className="btn-outline text-xs flex items-center gap-1.5">
              <RefreshCw size={12} />
              New Import
            </button>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-xl mb-8 w-fit">
          <button
            onClick={() => setImportMode('new_assets')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === 'new_assets' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span className="flex items-center gap-2">
              <Database size={14} />
              Import new assets
            </span>
          </button>
          <button
            onClick={() => setImportMode('attach_media')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === 'attach_media' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span className="flex items-center gap-2">
              <Image size={14} />
              Attach or replace media
            </span>
          </button>
          <Link
            href="/admin/reconcile-storage"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Reconcile Storage
          </Link>
        </div>

        {/* Step indicator — only for new assets mode */}
        {importMode === 'new_assets' && (
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {(['upload', 'dry_run', 'confirm', 'importing', 'done'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              upload: '1. Upload Files',
              dry_run: '2. Dry Run',
              confirm: '3. Review & Confirm',
              importing: '4. Importing',
              done: '5. Complete',
            };
            const stepOrder = ['upload', 'dry_run', 'confirm', 'importing', 'done'];
            const isActive = step === s;
            const isPast = stepOrder.indexOf(step) > i;
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
        )}

        {/* ---- ATTACH MEDIA MODE ---- */}
        {importMode === 'attach_media' && (
          <div className="max-w-3xl">
            <AttachMediaMode />
          </div>
        )}

        {/* ---- NEW ASSETS IMPORT MODE ---- */}
        {importMode === 'new_assets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* Security notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">Security validation active — 14 rejection patterns</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Rejected: Windows paths, Dropbox, GPS/lat/lon, emails, phones, secrets/tokens, original file paths, SQLite/.db files.
                    All assets imported with <code className="bg-amber-100 px-1 rounded">is_demo=false</code>, <code className="bg-amber-100 px-1 rounded">review_status=under_review</code>, <code className="bg-amber-100 px-1 rounded">publication_status=preview_only</code>, <code className="bg-amber-100 px-1 rounded">commercial_use=false</code>.
                    No auto-approval. No originals uploaded. Never writes to <code className="bg-amber-100 px-1 rounded">asset-originals</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* STEP: UPLOAD */}
            {(step === 'upload' || step === 'dry_run') && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                <h2 className="text-sm font-semibold text-foreground">Step 1 — Select Files</h2>

                {/* CSV Upload */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                    Pilot Assets CSV <span className="text-red-500">*</span>
                  </label>
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-secondary/40 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('csv-input')?.click()}
                  >
                    <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      {csvFile ? csvFile.name : 'Click to select pilot_assets.csv'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB · ${csvRows.length} rows detected` : 'Only .csv files accepted'}
                    </p>
                    <input id="csv-input" type="file" accept=".csv" onChange={handleCsvChange} className="hidden" />
                  </div>
                </div>

                {/* Thumbnail Upload */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                    Thumbnails (optional) — uploads to: <code className="font-mono-data text-secondary">asset-thumbnails</code>
                  </label>
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-secondary/40 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('thumb-input')?.click()}
                  >
                    <Image size={22} className="text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {thumbnailFiles.length > 0 ? `${thumbnailFiles.length} files selected` : 'Select thumbnail images (JPEG, PNG, WEBP, HEIC — max 20 MB each)'}
                    </p>
                    <input id="thumb-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handleThumbnailFiles} className="hidden" />
                  </div>
                  {thumbnailFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {thumbnailFiles.slice(0, 3).map(f => f.name).join(', ')}{thumbnailFiles.length > 3 ? ` +${thumbnailFiles.length - 3} more` : ''}
                    </p>
                  )}
                </div>

                {/* Preview Upload */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                    Watermarked Previews (optional) — uploads to: <code className="font-mono-data text-secondary">asset-previews</code>
                  </label>
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-secondary/40 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('preview-input')?.click()}
                  >
                    <FileImage size={22} className="text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {previewFiles.length > 0 ? `${previewFiles.length} files selected` : 'Select watermarked preview images (JPEG, PNG, WEBP, HEIC — max 20 MB each)'}
                    </p>
                    <input id="preview-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={handlePreviewFiles} className="hidden" />
                  </div>
                  {previewFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {previewFiles.slice(0, 3).map(f => f.name).join(', ')}{previewFiles.length > 3 ? ` +${previewFiles.length - 3} more` : ''}
                    </p>
                  )}
                </div>

                {/* Batch config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Batch Name</label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      className="input-base w-full text-sm"
                      placeholder="Codex Pilot 100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
                    <input
                      type="text"
                      value={batchNotes}
                      onChange={(e) => setBatchNotes(e.target.value)}
                      className="input-base w-full text-sm"
                      placeholder="Import notes…"
                    />
                  </div>
                </div>

                {/* Sensitive data warning */}
                {clientSensitiveCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                      <ShieldAlert size={14} />
                      {clientSensitiveCount} row(s) contain sensitive data and will be rejected
                    </p>
                    <p className="text-xs text-red-600 mt-1">Remove GPS coordinates, emails, phone numbers, Windows/Dropbox paths, and secrets before importing.</p>
                  </div>
                )}

                {/* Client-side errors */}
                {clientErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <XCircle size={14} />
                      Validation errors ({clientErrors.length})
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {clientErrors.map((e, i) => (
                        <li key={i} className="text-xs text-red-600">• {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Client-side warnings */}
                {clientWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Warnings ({clientWarnings.length})
                    </p>
                    <ul className="space-y-1">
                      {clientWarnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dry run button */}
                {csvFile && csvRows.length > 0 && clientErrors.length === 0 && isAdmin && (
                  <button
                    onClick={handleDryRun}
                    disabled={dryRunLoading}
                    className="btn-primary w-full justify-center"
                  >
                    {dryRunLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Running dry run analysis…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Eye size={14} />
                        Run Dry Run Analysis ({csvRows.length} rows) — No data will be inserted
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* STEP: CONFIRM (dry run results) */}
            {(step === 'confirm' || step === 'done') && dryRunReport && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                <h2 className="text-sm font-semibold text-foreground">Step 2 — Dry Run Report (pre-insert validation)</h2>

                {/* Summary grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total rows', value: dryRunReport.totalRows, color: 'text-foreground' },
                    { label: 'Valid rows', value: dryRunReport.validRows, color: 'text-green-600' },
                    { label: 'Rejected', value: dryRunReport.rejectedRows, color: 'text-red-600' },
                    { label: 'Duplicates', value: dryRunReport.duplicatesDetected, color: 'text-amber-600' },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sensitive data alert */}
                {dryRunReport.sensitiveDataFound && dryRunReport.sensitiveDataFound.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <button
                      onClick={() => setShowSensitive(!showSensitive)}
                      className="flex items-center gap-2 text-sm font-semibold text-red-700 w-full"
                    >
                      <ShieldAlert size={14} />
                      Sensitive data detected ({dryRunReport.sensitiveDataFound.length} rows) — these rows were rejected
                      {showSensitive ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
                    </button>
                    {showSensitive && (
                      <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {dryRunReport.sensitiveDataFound.map((s, i) => (
                          <li key={i} className="text-xs text-red-600">• {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* New entities */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-3">
                    <Fish size={14} className="text-secondary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{dryRunReport.newSpecies.length} new species</p>
                      {dryRunReport.newSpecies.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{dryRunReport.newSpecies.slice(0, 2).join(', ')}{dryRunReport.newSpecies.length > 2 ? '…' : ''}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-3">
                    <Tag size={14} className="text-secondary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{dryRunReport.newCategories.length} categories</p>
                      {dryRunReport.newCategories.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{dryRunReport.newCategories.slice(0, 2).join(', ')}{dryRunReport.newCategories.length > 2 ? '…' : ''}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-3">
                    <Hash size={14} className="text-secondary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{dryRunReport.newKeywords.length} keywords</p>
                    </div>
                  </div>
                </div>

                {/* Estimated size */}
                {dryRunReport.estimatedSizeMB && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <Database size={14} className="text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-700">
                      Estimated storage: ~<strong>{dryRunReport.estimatedSizeMB} MB</strong> for thumbnails + previews (500 KB/asset estimate)
                    </p>
                  </div>
                )}

                {/* Rejection details */}
                {dryRunReport.rejectionDetails.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowRejections(!showRejections)}
                      className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2"
                    >
                      <XCircle size={14} />
                      Rejection details ({dryRunReport.rejectionDetails.length})
                      {showRejections ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {showRejections && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                        {dryRunReport.rejectionDetails.map((r, i) => (
                          <p key={i} className="text-xs text-red-700 py-0.5">• {r.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {dryRunReport.preview.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
                    >
                      <Eye size={14} />
                      Preview first {dryRunReport.preview.length} valid rows
                      {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {showPreview && (
                      <div className="overflow-x-auto border border-border rounded-xl">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              {Object.keys(dryRunReport.preview[0]).slice(0, 6).map((col) => (
                                <th key={col} className="text-left px-3 py-2 text-muted-foreground font-semibold whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dryRunReport.preview.map((row, i) => (
                              <tr key={i} className="border-b border-border">
                                {Object.values(row).slice(0, 6).map((val, j) => (
                                  <td key={j} className="px-3 py-2 text-foreground max-w-32 truncate">{val || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Enforced statuses notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Enforced statuses on all imported assets</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'is_demo = false',
                      'review_status = under_review',
                      'publication_status = preview_only',
                      'rights_info = review_required',
                      'commercial_use = false',
                      'is_verified = false',
                    ].map((s) => (
                      <span key={s} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono-data">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">No asset will be auto-approved or auto-published. Administrator review required.</p>
                </div>

                {/* 10-step workflow notice */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">10-step transactional import order</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      '1. Batch creation', '2. Categories', '3. Species (dedup by sci. name)',
                      '4. Assets', '5. Asset-species relations', '6. Keywords',
                      '7. Asset-keyword relations', '8. Thumbnails → asset-thumbnails',
                      '9. Previews → asset-previews', '10. Batch report',
                    ].map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                </div>

                {/* Confirm import button */}
                {step === 'confirm' && dryRunReport.validRows > 0 && isAdmin && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Ready to import <strong className="text-foreground">{dryRunReport.validRows} assets</strong>.
                      {thumbnailFiles.length > 0 && ` ${thumbnailFiles.length} thumbnails`}
                      {previewFiles.length > 0 && ` + ${previewFiles.length} previews`}
                      {' '}will be uploaded after metadata insertion.
                    </p>
                    <button
                      onClick={handleImport}
                      disabled={importLoading}
                      className="btn-primary w-full justify-center"
                    >
                      <Play size={14} />
                      Confirm Import — {dryRunReport.validRows} assets
                    </button>
                  </div>
                )}

                {step === 'confirm' && dryRunReport.validRows === 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                    No valid rows to import. Fix the errors above and re-run the dry run.
                  </div>
                )}
              </div>
            )}

            {/* STEP: IMPORTING */}
            {step === 'importing' && (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <Loader2 size={32} className="text-secondary animate-spin mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">Import in progress…</h2>
                <p className="text-sm text-muted-foreground mb-4">{importProgressLabel}</p>
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div
                    className="bg-secondary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{importProgress}%</p>
                <p className="text-xs text-muted-foreground mt-3">Do not close this tab during import.</p>
              </div>
            )}

            {/* STEP: DONE */}
            {step === 'done' && importReport && (
              <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                {/* Status banner */}
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                  importReport.finalStatus === 'completed' ? 'bg-green-50 border-green-200' :
                  importReport.finalStatus === 'partially_imported'? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                }`}>
                  {importReport.finalStatus === 'completed' ? (
                    <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
                  ) : importReport.finalStatus === 'partially_imported' ? (
                    <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold capitalize ${
                      importReport.finalStatus === 'completed' ? 'text-green-800' :
                      importReport.finalStatus === 'partially_imported' ? 'text-amber-800' : 'text-red-800'
                    }`}>
                      Batch status: {importReport.finalStatus.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {importReport.importedCount} assets imported · {importReport.rejectedRows} rejected
                      {importReport.thumbnailsUploaded !== undefined && ` · ${importReport.thumbnailsUploaded} thumbnails`}
                      {importReport.previewsUploaded !== undefined && ` · ${importReport.previewsUploaded} previews`}
                    </p>
                  </div>
                </div>

                {/* Import report grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Assets imported', value: importReport.importedCount, icon: FileImage },
                    { label: 'Species created', value: importReport.speciesCreated, icon: Fish },
                    { label: 'Keywords created', value: importReport.keywordsCreated, icon: Hash },
                    { label: 'Rejected rows', value: importReport.rejectedRows, icon: XCircle },
                  ].map((s) => {
                    const IconComp = s.icon;
                    return (
                      <div key={s.label} className="bg-muted/50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <IconComp size={12} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                        <p className="text-xl font-bold font-mono-data text-foreground">{s.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Storage uploads */}
                {(importReport.thumbnailsUploaded !== undefined || importReport.previewsUploaded !== undefined) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-xl p-3 flex items-center gap-2">
                      <Image size={14} className="text-secondary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Thumbnails uploaded</p>
                        <p className="text-sm font-bold text-foreground">{importReport.thumbnailsUploaded ?? 0}</p>
                        <p className="text-xs text-muted-foreground font-mono-data">→ asset-thumbnails</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 flex items-center gap-2">
                      <FileImage size={14} className="text-secondary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Previews uploaded</p>
                        <p className="text-sm font-bold text-foreground">{importReport.previewsUploaded ?? 0}</p>
                        <p className="text-xs text-muted-foreground font-mono-data">→ asset-previews</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Security confirmations */}
                <div className="space-y-1.5">
                  {[
                    'No original files imported or uploaded',
                    'No Dropbox access used',
                    'No Windows/macOS paths imported',
                    'No GPS coordinates imported',
                    'No SQLite or database files imported',
                    'All assets set to is_demo=false',
                    'All assets set to review_status=under_review',
                    'All assets set to publication_status=preview_only',
                    'All assets set to commercial_use=false',
                    'No asset auto-approved or auto-published',
                    'asset-originals bucket was never written to',
                  ].map((c) => (
                    <p key={c} className="text-xs text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="shrink-0" />
                      {c}
                    </p>
                  ))}
                </div>

                {/* Import errors */}
                {importReport.importErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 mb-2">Import errors ({importReport.importErrors.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importReport.importErrors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">• {e}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Link href="/admin/assets" className="btn-primary flex-1 justify-center text-sm">
                    View Imported Assets
                  </Link>
                  <button onClick={handleReset} className="btn-outline flex-1 justify-center text-sm">
                    New Import
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Allowed columns */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ClipboardList size={14} />
                Allowed CSV Columns
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {ALLOWED_CSV_COLUMNS.map((col) => (
                  <span key={col} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono-data">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Storage buckets */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Package size={14} />
                Storage Buckets
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'asset-thumbnails', desc: 'Thumbnail images', write: true },
                  { name: 'asset-previews', desc: 'Watermarked previews', write: true },
                  { name: 'asset-originals', desc: 'HD originals — NEVER written', write: false },
                ].map((b) => (
                  <div key={b.name} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${b.write ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div>
                      <p className="text-xs font-mono-data text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  Create <code className="font-mono-data">asset-thumbnails</code> and <code className="font-mono-data">asset-previews</code> buckets in Supabase Dashboard → Storage before uploading.
                </p>
              </div>
            </div>

            {/* Rejection patterns */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ShieldAlert size={14} />
                Rejection Patterns
              </h3>
              <div className="space-y-1">
                {[
                  'C:\\ Windows paths', '/Users/ macOS paths', 'Dropbox references',
                  'GPS decimal coordinates', 'lat/lon/gps fields', 'Email addresses',
                  'Phone numbers', 'Secrets/tokens/API keys', 'Original file paths',
                  'SQLite/.db files',
                ].map((p) => (
                  <p key={p} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <XCircle size={10} className="text-red-400 shrink-0" />
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {/* Batch history */}
            <div className="bg-card rounded-xl border border-border p-5">
              <button
                onClick={() => setShowBatchHistory(!showBatchHistory)}
                className="flex items-center justify-between w-full"
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClipboardList size={14} />
                  Import History
                </h3>
                {showBatchHistory ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              {showBatchHistory && (
                <div className="mt-3 space-y-2">
                  {batchesLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : batches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No import batches yet</p>
                  ) : (
                    batches.map((batch) => (
                      <div key={batch.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-foreground truncate">{batch.source_name || 'Unnamed batch'}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${batchStatusColors[batch.status] || 'bg-gray-100 text-gray-600'}`}>
                            {batch.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {batch.processed_rows}/{batch.total_rows} rows · {batch.rejected_rows} rejected
                        </p>
                        <p className="text-xs text-muted-foreground font-mono-data">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                  <button onClick={loadBatches} className="text-xs text-secondary hover:underline flex items-center gap-1">
                    <RefreshCw size={10} />
                    Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )} {/* end importMode === 'new_assets' */}
      </main>
      <Footer />
    </div>
  );
}
