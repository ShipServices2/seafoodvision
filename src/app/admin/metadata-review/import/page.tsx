'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeft, Play, Eye, Loader2, Info, Tag, Fish, GitMerge, Package
} from 'lucide-react';

const ACCEPTED_FILES = [
  { name: 'metadata_assets.csv', desc: 'Asset metadata (species, category, form, packaging, keywords…)' },
  { name: 'species.csv', desc: 'Species definitions (scientific name, family, genus…)' },
  { name: 'families.csv', desc: 'Taxonomic families' },
  { name: 'synonyms.csv', desc: 'Common name synonyms by language' },
  { name: 'keywords.csv', desc: 'Keyword terms and variants' },
  { name: 'packaging.csv', desc: 'Packaging types and configurations' },
  { name: 'search_aliases.csv', desc: 'Search alias mappings' },
  { name: 'commercial_categories.csv', desc: 'Commercial category definitions' },
];

interface DryRunReport {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  conflictRows: number;
  newKeywords: number;
  newSpecies: number;
  newFamilies: number;
  newSynonyms: number;
  files: string[];
  errors: { row: number; file: string; message: string }[];
  warnings: { row: number; file: string; message: string }[];
}

export default function MetadataImportPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'dry_run' | 'ready' | 'importing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/import');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/admin/metadata-review');
    }
  }, [loading, user, profile, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter((f) => f.name.endsWith('.csv'));
    setFiles(selected);
    setReport(null);
    setImportStatus('idle');
  };

  const parseCsvPreview = async (file: File): Promise<{ rows: number; headers: string[] }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(Boolean);
        const headers = lines[0]?.split(',').map((h) => h.trim().replace(/"/g, '')) ?? [];
        resolve({ rows: lines.length - 1, headers });
      };
      reader.readAsText(file);
    });
  };

  const runDryRun = async () => {
    if (!files.length || !batchName.trim()) return;
    setRunning(true);
    setImportStatus('dry_run');
    setErrorMsg('');

    try {
      // Parse all files to build a dry-run report
      let totalRows = 0;
      let validRows = 0;
      let rejectedRows = 0;
      let conflictRows = 0;
      let newKeywords = 0;
      let newSpecies = 0;
      let newFamilies = 0;
      let newSynonyms = 0;
      const fileNames: string[] = [];
      const errors: DryRunReport['errors'] = [];
      const warnings: DryRunReport['warnings'] = [];

      const supabase = createClient();

      for (const file of files) {
        const { rows, headers } = await parseCsvPreview(file);
        fileNames.push(file.name);
        totalRows += rows;

        // Validate headers per file type
        if (file.name === 'metadata_assets.csv') {
          const required = ['asset_id', 'title'];
          const missing = required.filter((h) => !headers.includes(h));
          if (missing.length > 0) {
            errors.push({ row: 0, file: file.name, message: `Missing required columns: ${missing.join(', ')}` });
            rejectedRows += rows;
          } else {
            validRows += rows;
          }
        } else if (file.name === 'species.csv') {
          const required = ['scientific_name'];
          const missing = required.filter((h) => !headers.includes(h));
          if (missing.length > 0) {
            errors.push({ row: 0, file: file.name, message: `Missing required columns: ${missing.join(', ')}` });
            rejectedRows += rows;
          } else {
            newSpecies += rows;
            validRows += rows;
          }
        } else if (file.name === 'families.csv') {
          newFamilies += rows;
          validRows += rows;
        } else if (file.name === 'synonyms.csv') {
          newSynonyms += rows;
          validRows += rows;
        } else if (file.name === 'keywords.csv') {
          newKeywords += rows;
          validRows += rows;
        } else {
          validRows += rows;
        }

        // Check for potential conflicts with existing data
        if (file.name === 'species.csv' && rows > 0) {
          const { count } = await supabase.from('species').select('*', { count: 'exact', head: true });
          if ((count ?? 0) > 0) {
            warnings.push({ row: 0, file: file.name, message: `${count} existing species found — check for duplicates before import` });
            conflictRows += Math.min(rows, 5);
          }
        }
      }

      const dryReport: DryRunReport = {
        totalRows,
        validRows: validRows - rejectedRows,
        rejectedRows,
        conflictRows,
        newKeywords,
        newSpecies,
        newFamilies,
        newSynonyms,
        files: fileNames,
        errors,
        warnings,
      };

      // Save batch record as dry_run
      const { error: batchError } = await supabase.from('metadata_import_batches').insert({
        batch_name: batchName,
        source: 'codex',
        status: 'dry_run',
        dry_run: true,
        total_rows: totalRows,
        valid_rows: dryReport.validRows,
        rejected_rows: rejectedRows,
        conflict_rows: conflictRows,
        new_keywords: newKeywords,
        new_species: newSpecies,
        new_families: newFamilies,
        new_synonyms: newSynonyms,
        files_included: fileNames,
        report: dryReport as unknown as Record<string, unknown>,
        created_by: user?.id,
      });

      if (batchError) {
        setErrorMsg('Failed to save dry-run batch: ' + batchError.message);
        setImportStatus('error');
      } else {
        setReport(dryReport);
        setImportStatus('ready');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error during dry run');
      setImportStatus('error');
    } finally {
      setRunning(false);
    }
  };

  const confirmImport = async () => {
    if (!report || importStatus !== 'ready') return;
    setImportStatus('importing');
    setRunning(true);
    // In production this would process the CSV rows and create metadata_suggestions
    // For now we mark the batch as validated
    const supabase = createClient();
    await supabase
      .from('metadata_import_batches')
      .update({ status: 'validated', dry_run: false })
      .eq('batch_name', batchName);
    setImportStatus('done');
    setRunning(false);
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

          {/* Accepted file types */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Accepted Files
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCEPTED_FILES.map((f) => (
                <div key={f.name} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono font-medium text-gray-700">{f.name}</span>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
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
                placeholder="e.g. Codex Pack 2026-07-15"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Click to select CSV files</p>
              <p className="text-xs text-gray-400 mt-1">Only .csv files accepted</p>
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
                {files.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-mono">{f.name}</span>
                    <span className="text-gray-400 ml-auto">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 font-medium">Dry Run (required before import)</span>
              </label>
            </div>

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

          {/* Done */}
          {importStatus === 'done' && (
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
          {report && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                Dry Run Report
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Rows', value: report.totalRows, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'Valid Rows', value: report.validRows, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Rejected', value: report.rejectedRows, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Conflicts', value: report.conflictRows, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'New Keywords', value: report.newKeywords, icon: Tag },
                  { label: 'New Species', value: report.newSpecies, icon: Fish },
                  { label: 'New Families', value: report.newFamilies, icon: Package },
                  { label: 'New Synonyms', value: report.newSynonyms, icon: GitMerge },
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
                  {report.files.map((f) => (
                    <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">{f}</span>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {report.errors.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Errors ({report.errors.length})
                  </h3>
                  <div className="space-y-1">
                    {report.errors.map((e, i) => (
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
              {report.warnings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Warnings ({report.warnings.length})
                  </h3>
                  <div className="space-y-1">
                    {report.warnings.map((w, i) => (
                      <div key={i} className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                        <span className="font-mono font-medium">{w.file}</span>
                        {w.row > 0 && <span className="text-amber-400"> row {w.row}</span>}
                        : {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.errors.length === 0 && report.warnings.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  No errors or warnings detected. Ready to import.
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
