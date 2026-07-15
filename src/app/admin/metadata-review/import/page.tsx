'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import {
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeft, Play, Eye, Loader2, Info, Tag, Fish, GitMerge, Package,
  ShieldCheck, Database, Lock, BarChart2
} from 'lucide-react';

// Phase 7.16 — Metadata Enrichment Pack (608 assets)
const PHASE_716_FILES = [
  { name: 'metadata_assets_608.csv', desc: 'Main enrichment file — 608 assets matched by public_asset_id', required: true },
  { name: 'species.csv', desc: 'Species candidates (scientific name, family, genus)', required: false },
  { name: 'families.csv', desc: 'Taxonomic families', required: false },
  { name: 'synonyms.csv', desc: 'Common name synonyms by language', required: false },
  { name: 'keywords.csv', desc: 'Keyword terms and variants', required: false },
  { name: 'packaging.csv', desc: 'Packaging types and configurations', required: false },
  { name: 'search_aliases.csv', desc: 'Search alias mappings', required: false },
  { name: 'commercial_categories.csv', desc: 'Commercial category definitions', required: false },
  { name: 'rocket_import_manifest.csv', desc: 'Import manifest (Codex-generated)', required: false },
];

// Phase 7.15 — Standard Metadata Pack
const STANDARD_FILES = [
  { name: 'metadata_assets.csv', desc: 'Asset metadata (species, category, form, packaging, keywords…)', required: true },
  { name: 'species.csv', desc: 'Species definitions (scientific name, family, genus…)', required: false },
  { name: 'families.csv', desc: 'Taxonomic families', required: false },
  { name: 'synonyms.csv', desc: 'Common name synonyms by language', required: false },
  { name: 'keywords.csv', desc: 'Keyword terms and variants', required: false },
  { name: 'packaging.csv', desc: 'Packaging types and configurations', required: false },
  { name: 'search_aliases.csv', desc: 'Search alias mappings', required: false },
  { name: 'commercial_categories.csv', desc: 'Commercial category definitions', required: false },
];

type ImportMode = 'standard' | 'enrichment_716';

interface DryRunReport {
  mode: string;
  totalRows: number;
  assetsFound?: number;
  assetsMissing?: number;
  validRows?: number;
  rejectedRows?: number;
  conflictRows?: number;
  newKeywords: number;
  newSpecies: number;
  newFamilies: number;
  newSynonyms: number;
  newAliases?: number;
  newPackaging?: number;
  newCommercialCategories?: number;
  conflicts?: number;
  duplicates?: number;
  skippedApproved?: number;
  unknownPreserved?: number;
  noMediaModified?: boolean;
  files: string[];
  errors: { row: number; file: string; message: string }[];
  warnings: { row: number; file: string; message: string }[];
}

interface FinalReport {
  mode: string;
  batchId: string;
  batchName: string;
  importedRows: number;
  rejectedRows: number;
  conflicts: number;
  speciesCandidates: number;
  families: number;
  synonyms: number;
  keywords: number;
  assetsUnderReview: number;
  skippedApproved: number;
  noMediaModified: boolean;
  build: string;
  tests: string;
  confirmation: string;
}

export default function MetadataImportPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importMode, setImportMode] = useState<ImportMode>('enrichment_716');
  const [files, setFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('Codex Pack 608 — 2026-07-15');
  const [running, setRunning] = useState(false);
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'dry_run' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/import');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/admin/metadata-review');
    }
  }, [loading, user, profile, router]);

  const acceptedFiles = importMode === 'enrichment_716' ? PHASE_716_FILES : STANDARD_FILES;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter((f) => f.name.endsWith('.csv'));
    setFiles(selected);
    setDryRunReport(null);
    setFinalReport(null);
    setBatchId(null);
    setImportStatus('idle');
  };

  const runDryRun = async () => {
    if (!files.length || !batchName.trim()) return;
    setRunning(true);
    setImportStatus('dry_run');
    setErrorMsg('');

    try {
      if (importMode === 'enrichment_716') {
        // Use Phase 7.16 API
        const fd = new FormData();
        fd.append('batch_name', batchName);
        fd.append('dry_run', 'true');
        files.forEach((f, i) => fd.append(`file_${i}`, f));

        const res = await fetch('/api/admin/metadata-enrichment-import', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Dry run failed');

        setDryRunReport(data.report);
        setBatchId(data.batch_id);
        setImportStatus('ready');
      } else {
        // Standard mode — legacy client-side dry run
        await runStandardDryRun();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error during dry run');
      setImportStatus('error');
    } finally {
      setRunning(false);
    }
  };

  const runStandardDryRun = async () => {
    // Simplified client-side dry run for standard mode
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    let totalRows = 0;
    let validRows = 0;
    let rejectedRows = 0;
    const errors: DryRunReport['errors'] = [];
    const warnings: DryRunReport['warnings'] = [];
    let newSpecies = 0, newFamilies = 0, newSynonyms = 0, newKeywords = 0;

    for (const file of files) {
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0]?.split(',').map((h) => h.trim().replace(/"/g, '')) ?? [];
      const rows = lines.length - 1;
      totalRows += rows;

      if (file.name === 'metadata_assets.csv') {
        if (!headers.includes('asset_id')) {
          errors.push({ row: 0, file: file.name, message: 'Missing required column: asset_id' });
          rejectedRows += rows;
        } else { validRows += rows; }
      } else if (file.name === 'species.csv') {
        if (!headers.includes('scientific_name')) {
          errors.push({ row: 0, file: file.name, message: 'Missing required column: scientific_name' });
          rejectedRows += rows;
        } else { newSpecies += rows; validRows += rows; }
      } else if (file.name === 'families.csv') { newFamilies += rows; validRows += rows; }
      else if (file.name === 'synonyms.csv') { newSynonyms += rows; validRows += rows; }
      else if (file.name === 'keywords.csv') { newKeywords += rows; validRows += rows; }
      else { validRows += rows; }

      if (file.name === 'species.csv' && rows > 0) {
        const { count } = await supabase.from('species').select('*', { count: 'exact', head: true });
        if ((count ?? 0) > 0) {
          warnings.push({ row: 0, file: file.name, message: `${count} existing species found — check for duplicates` });
        }
      }
    }

    const report: DryRunReport = {
      mode: 'STANDARD',
      totalRows,
      validRows: validRows - rejectedRows,
      rejectedRows,
      conflictRows: 0,
      newKeywords,
      newSpecies,
      newFamilies,
      newSynonyms,
      files: files.map((f) => f.name),
      errors,
      warnings,
    };

    const { createClient: cc } = await import('@/lib/supabase/client');
    const sb = cc();
    const { data: batchRow } = await sb.from('metadata_import_batches').insert({
      batch_name: batchName,
      source: 'codex',
      status: 'dry_run',
      dry_run: true,
      import_mode: 'STANDARD',
      total_rows: totalRows,
      valid_rows: report.validRows ?? 0,
      rejected_rows: rejectedRows,
      new_keywords: newKeywords,
      new_species: newSpecies,
      new_families: newFamilies,
      new_synonyms: newSynonyms,
      files_included: files.map((f) => f.name),
      report: report as unknown as Record<string, unknown>,
      created_by: user?.id,
    }).select('id').single();

    setBatchId(batchRow?.id ?? null);
    setDryRunReport(report);
    setImportStatus('ready');
  };

  const confirmImport = async () => {
    if (!dryRunReport || importStatus !== 'ready') return;
    setImportStatus('importing');
    setRunning(true);

    try {
      if (importMode === 'enrichment_716' && batchId) {
        const fd = new FormData();
        fd.append('batch_name', batchName);
        fd.append('dry_run', 'false');
        fd.append('batch_id', batchId);
        files.forEach((f, i) => fd.append(`file_${i}`, f));

        const res = await fetch('/api/admin/metadata-enrichment-import', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Import failed');
        setFinalReport(data.report);
        setImportStatus('done');
      } else {
        // Standard mode — mark batch as validated
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        await supabase
          .from('metadata_import_batches')
          .update({ status: 'validated', dry_run: false })
          .eq('batch_name', batchName);
        setImportStatus('done');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <span>/</span>
            <Link href="/admin/metadata-review" className="hover:text-gray-700">Metadata Review</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Import Metadata Pack</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Import Metadata Pack</h1>
              <p className="text-sm text-gray-500">Upload Codex CSV files. Dry Run is mandatory before any import.</p>
            </div>
          </div>

          {/* Import Mode Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Import Mode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setImportMode('enrichment_716'); setFiles([]); setDryRunReport(null); setFinalReport(null); setImportStatus('idle'); setBatchName('Codex Pack 608 — 2026-07-15'); }}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${importMode === 'enrichment_716' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <Database className={`w-5 h-5 mt-0.5 flex-shrink-0 ${importMode === 'enrichment_716' ? 'text-violet-600' : 'text-gray-400'}`} />
                <div>
                  <div className={`text-sm font-semibold ${importMode === 'enrichment_716' ? 'text-violet-800' : 'text-gray-700'}`}>
                    Metadata Import — Phase 7.16
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-violet-600">UPDATE EXISTING ASSETS ONLY</span>
                    <br />Matches by <code className="bg-gray-100 px-1 rounded">public_asset_id</code> · 608 assets · No new assets
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setImportMode('standard'); setFiles([]); setDryRunReport(null); setFinalReport(null); setImportStatus('idle'); setBatchName(''); }}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${importMode === 'standard' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <Upload className={`w-5 h-5 mt-0.5 flex-shrink-0 ${importMode === 'standard' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <div className={`text-sm font-semibold ${importMode === 'standard' ? 'text-blue-800' : 'text-gray-700'}`}>
                    Standard Metadata Import
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Phase 7.15 standard import mode
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Phase 7.16 Safety Notice */}
          {importMode === 'enrichment_716' && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-violet-800 mb-1">Phase 7.16 — Enrichment Pack Safety Rules</p>
                  <ul className="text-xs text-violet-700 space-y-1">
                    <li>✓ <strong>UPDATE EXISTING ASSETS ONLY</strong> — no new assets will be created</li>
                    <li>✓ Matching by <code className="bg-violet-100 px-1 rounded">public_asset_id</code> — unmatched rows are rejected</li>
                    <li>✓ Human-approved values are <strong>never overwritten</strong></li>
                    <li>✓ All new data: <code className="bg-violet-100 px-1 rounded">under_review / suggested / private</code></li>
                    <li>✓ Every change logged with <code className="bg-violet-100 px-1 rounded">source=Codex</code></li>
                    <li>✓ <strong>No media files modified</strong> — Storage untouched</li>
                    <li>✓ Unknown assets remain unknown — no forced identification</li>
                    <li>✓ Species candidates remain <code className="bg-violet-100 px-1 rounded">candidate_unverified</code></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Accepted file types */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Accepted Files {importMode === 'enrichment_716' && <span className="text-xs text-violet-600 font-normal">(Phase 7.16 Pack)</span>}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {acceptedFiles.map((f) => (
                <div key={f.name} className={`flex items-start gap-2 p-2 rounded-lg ${f.required ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50'}`}>
                  <FileText className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${f.required ? 'text-violet-500' : 'text-gray-400'}`} />
                  <div>
                    <span className="text-xs font-mono font-medium text-gray-700">{f.name}</span>
                    {f.required && <span className="ml-1 text-xs text-violet-600 font-medium">*required</span>}
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {importMode === 'enrichment_716' && (
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Markdown reports are never imported. Only the CSV files listed above are accepted.
              </p>
            )}
          </div>

          {/* Upload Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Upload Files</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Batch Name *</label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Codex Pack 608 — 2026-07-15"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Click to select CSV files</p>
              <p className="text-xs text-gray-400 mt-1">Only .csv files accepted — no Markdown reports</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                {files.map((f) => {
                  const isAccepted = acceptedFiles.some((af) => af.name === f.name);
                  return (
                    <div key={f.name} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isAccepted ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {isAccepted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span className="font-mono">{f.name}</span>
                      <span className="text-gray-400 ml-auto">{(f.size / 1024).toFixed(1)} KB</span>
                      {!isAccepted && <span className="text-red-500 text-xs">Not accepted</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={runDryRun}
                disabled={!files.length || !batchName.trim() || running}
                className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {running && importStatus === 'dry_run' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Run Dry Run
              </button>

              {importStatus === 'ready' && (
                <button
                  onClick={confirmImport}
                  disabled={running}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Confirm Import
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {importStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Final Report (Phase 7.16) */}
          {importStatus === 'done' && finalReport && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="text-sm font-semibold text-green-800">Phase 7.16 Import Complete — Final Report</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Imported Rows', value: finalReport.importedRows, color: 'text-green-700' },
                  { label: 'Rejected Rows', value: finalReport.rejectedRows, color: 'text-red-600' },
                  { label: 'Conflicts', value: finalReport.conflicts, color: 'text-amber-600' },
                  { label: 'Species Candidates', value: finalReport.speciesCandidates, color: 'text-teal-600' },
                  { label: 'Families', value: finalReport.families, color: 'text-blue-600' },
                  { label: 'Synonyms', value: finalReport.synonyms, color: 'text-violet-600' },
                  { label: 'Keywords', value: finalReport.keywords, color: 'text-indigo-600' },
                  { label: 'Assets Under Review', value: finalReport.assetsUnderReview, color: 'text-amber-700' },
                  { label: 'Skipped (Approved)', value: finalReport.skippedApproved, color: 'text-gray-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-lg p-3 border border-green-100">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-green-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{finalReport.confirmation}</span>
                </div>
                <div className="flex items-center gap-2 text-green-700">
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Build: <strong>{finalReport.build}</strong> · Tests: <strong>{finalReport.tests}</strong></span>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/admin/metadata-review/assets"
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Review 608 Assets in Metadata Review Center
                </Link>
              </div>
            </div>
          )}

          {/* Done (standard mode) */}
          {importStatus === 'done' && !finalReport && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Import batch validated successfully.</p>
                <p className="text-xs text-green-700 mt-0.5">
                  All suggestions are now in <strong>under_review</strong> state. No data was auto-published.
                </p>
              </div>
            </div>
          )}

          {/* Dry Run Report */}
          {dryRunReport && importStatus !== 'done' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                Dry Run Report
                {importMode === 'enrichment_716' && (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                    UPDATE EXISTING ONLY
                  </span>
                )}
              </h2>

              {/* Phase 7.16 specific stats */}
              {importMode === 'enrichment_716' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Total Rows', value: dryRunReport.totalRows, color: 'text-gray-700', bg: 'bg-gray-50' },
                      { label: 'Assets Found', value: dryRunReport.assetsFound ?? 0, color: 'text-green-700', bg: 'bg-green-50' },
                      { label: 'Assets Missing', value: dryRunReport.assetsMissing ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
                      { label: 'Conflicts', value: dryRunReport.conflicts ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Duplicates', value: dryRunReport.duplicates ?? 0, color: 'text-orange-600', bg: 'bg-orange-50' },
                      { label: 'Skipped (Approved)', value: dryRunReport.skippedApproved ?? 0, color: 'text-gray-600', bg: 'bg-gray-50' },
                      { label: 'Unknown Preserved', value: dryRunReport.unknownPreserved ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'No Media Modified', value: dryRunReport.noMediaModified ? '✓' : '✗', color: dryRunReport.noMediaModified ? 'text-green-700' : 'text-red-600', bg: dryRunReport.noMediaModified ? 'bg-green-50' : 'bg-red-50' },
                    ].map((s) => (
                      <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Total Rows', value: dryRunReport.totalRows, color: 'text-gray-700', bg: 'bg-gray-50' },
                    { label: 'Valid Rows', value: dryRunReport.validRows ?? 0, color: 'text-green-700', bg: 'bg-green-50' },
                    { label: 'Rejected', value: dryRunReport.rejectedRows ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Conflicts', value: dryRunReport.conflictRows ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'New Keywords', value: dryRunReport.newKeywords, icon: Tag },
                  { label: 'New Species', value: dryRunReport.newSpecies, icon: Fish },
                  { label: 'New Families', value: dryRunReport.newFamilies, icon: Package },
                  { label: 'New Synonyms', value: dryRunReport.newSynonyms, icon: GitMerge },
                ].map((s) => (
                  <div key={s.label} className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                    <s.icon className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-bold text-blue-700">{s.value}</div>
                      <div className="text-xs text-blue-500">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Files included */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-2">Files Included</h3>
                <div className="flex flex-wrap gap-2">
                  {dryRunReport.files.map((f) => (
                    <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">{f}</span>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {dryRunReport.errors.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Errors ({dryRunReport.errors.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {dryRunReport.errors.map((e, i) => (
                      <div key={i} className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                        <span className="font-mono font-medium">{e.file}</span>
                        {e.row > 0 && <span className="text-red-400"> row {e.row}</span>}
                        : {e.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {dryRunReport.warnings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Warnings ({dryRunReport.warnings.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {dryRunReport.warnings.map((w, i) => (
                      <div key={i} className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                        <span className="font-mono font-medium">{w.file}</span>
                        {w.row > 0 && <span className="text-amber-400"> row {w.row}</span>}
                        : {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dryRunReport.errors.length === 0 && dryRunReport.warnings.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  No errors or warnings detected. Ready to import.
                </div>
              )}

              {importMode === 'enrichment_716' && importStatus === 'ready' && (
                <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                  <strong>Ready to confirm.</strong> The import will:
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    <li>Update only the {dryRunReport.assetsFound ?? 0} matched assets</li>
                    <li>Set all data to <code>under_review / suggested / private</code></li>
                    <li>Log every change with <code>source=Codex</code></li>
                    <li>Never modify any media file or Storage bucket</li>
                    <li>Never overwrite human-approved values</li>
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}
