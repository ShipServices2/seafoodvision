'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Circle as XCircle, Loader as Loader2, Database, HardDrive, Link2, Eye, Play, Info, ChevronDown, ChevronUp, FileImage } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  strategy?: string;
}

interface ReconcileResult {
  mode: 'dry_run' | 'execute';
  totalStorageFiles: number;
  matched: number;
  matchedByPublicAssetId?: number;
  matchedByUuidAssetId?: number;
  unmatched: number;
  alreadyLinked: number;
  toInsert: number;
  toUpdate: number;
  inserted: number;
  updated: number;
  errors: string[];
  unmatchedPaths: string[];
  matches: ReconcileMatch[];
  detectedFormats?: string[];
}

type Step = 'idle' | 'scanning' | 'dry_run_done' | 'executing' | 'done';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReconcileStoragePage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // ── Dry Run ──────────────────────────────────────────────────────────────
  const handleDryRun = useCallback(async () => {
    setStep('scanning');
    setError(null);
    setResult(null);
    setShowUnmatched(false);
    setShowMatches(false);
    setShowErrors(false);

    try {
      const res = await fetch('/api/admin/reconcile-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'dry_run' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Dry run failed');
        setStep('idle');
        return;
      }
      setResult(data);
      setStep('dry_run_done');
    } catch {
      setError('Network error during scan');
      setStep('idle');
    }
  }, []);

  // ── Execute ──────────────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    setStep('executing');
    setError(null);

    try {
      const res = await fetch('/api/admin/reconcile-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'execute' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Execution failed');
        setStep('dry_run_done');
        return;
      }
      setResult(data);
      setStep('done');
    } catch {
      setError('Network error during execution');
      setStep('dry_run_done');
    }
  }, []);

  const isLoading = step === 'scanning' || step === 'executing';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
          <span>/</span>
          <Link href="/admin/imports" className="hover:text-white transition-colors">Imports</Link>
          <span>/</span>
          <span className="text-white">Reconcile Storage</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/admin/imports"
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-bold text-white">Storage Reconciliation</h1>
            </div>
            <p className="text-gray-400 text-sm ml-11">
              Find already-uploaded files in Storage and link them to existing assets — no reimports, no deletions, no metadata changes.
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 mb-8 flex gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200 space-y-1">
            <p className="font-medium">How this works</p>
            <ul className="text-blue-300 space-y-0.5 list-disc list-inside">
              <li>Scans <code className="bg-blue-900/40 px-1 rounded">asset-thumbnails</code> and <code className="bg-blue-900/40 px-1 rounded">asset-previews</code> buckets</li>
              <li>Matches files to assets using <code className="bg-blue-900/40 px-1 rounded">public_asset_id</code> <strong>or</strong> <code className="bg-blue-900/40 px-1 rounded">assets.id UUID</code> — detects all path formats automatically</li>
              <li>Supported formats: flat (<code className="bg-blue-900/40 px-1 rounded">SV-B500-0500.jpg</code>), subfolder (<code className="bg-blue-900/40 px-1 rounded">thumbnails/SV-B500-0500.jpg</code>), folder-based (<code className="bg-blue-900/40 px-1 rounded">pilot/SV-B500-0500/thumbnail.jpg</code>), UUID (<code className="bg-blue-900/40 px-1 rounded">{'{uuid}'}/thumbnail.jpg</code>)</li>
              <li>Creates or updates <code className="bg-blue-900/40 px-1 rounded">asset_files</code> and <code className="bg-blue-900/40 px-1 rounded">asset_previews</code> rows — no files are moved or deleted</li>
            </ul>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 mb-6 flex gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Step: Idle */}
        {step === 'idle' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <HardDrive className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Ready to Scan</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Click <strong>Scan Storage</strong> to perform a dry run. No changes will be made until you confirm.
            </p>
            <button
              onClick={handleDryRun}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              Scan Storage (Dry Run)
            </button>
          </div>
        )}

        {/* Step: Loading */}
        {isLoading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <Loader2 className="w-10 h-10 text-blue-400 mx-auto mb-4 animate-spin" />
            <p className="text-white font-medium">
              {step === 'scanning' ? 'Scanning storage buckets…' : 'Linking files to assets…'}
            </p>
            <p className="text-gray-400 text-sm mt-1">This may take a moment for large buckets.</p>
          </div>
        )}

        {/* Results */}
        {result && (step === 'dry_run_done' || step === 'done') && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={<HardDrive className="w-5 h-5 text-gray-400" />}
                label="Storage Files"
                value={result.totalStorageFiles}
                color="gray"
              />
              <StatCard
                icon={<Link2 className="w-5 h-5 text-green-400" />}
                label="Matched"
                value={result.matched}
                color="green"
              />
              <StatCard
                icon={<AlertCircle className="w-5 h-5 text-yellow-400" />}
                label="Unmatched"
                value={result.unmatched}
                color="yellow"
              />
              <StatCard
                icon={<Database className="w-5 h-5 text-blue-400" />}
                label="Already Linked"
                value={result.alreadyLinked}
                color="blue"
              />
            </div>

            {/* Action Plan */}
            {step === 'dry_run_done' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  Reconciliation Plan
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">{result.toInsert}</p>
                    <p className="text-green-300 text-sm mt-1">New <code>asset_files</code> rows to INSERT</p>
                  </div>
                  <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-400">{result.toUpdate}</p>
                    <p className="text-blue-300 text-sm mt-1">Existing rows to UPDATE (refresh metadata)</p>
                  </div>
                </div>

                {result.matched === 0 ? (
                  <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-lg p-4 text-center text-yellow-300 text-sm">
                    No matches found. The tool tried all path formats (flat, subfolder, folder-based). Check that <code>public_asset_id</code> values in the assets table match the filenames in Storage.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleExecute}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Execute Reconciliation ({result.toInsert} inserts + {result.toUpdate} updates)
                    </button>
                    <button
                      onClick={handleDryRun}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-scan
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Done Summary */}
            {step === 'done' && (
              <div className="bg-green-950/30 border border-green-700/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <h3 className="text-white font-semibold text-lg">Reconciliation Complete</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{result.inserted}</p>
                    <p className="text-green-300 text-sm">Rows inserted</p>
                  </div>
                  <div className="bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{result.updated}</p>
                    <p className="text-blue-300 text-sm">Rows updated</p>
                  </div>
                </div>
                {result.errors.length === 0 ? (
                  <p className="text-green-300 text-sm">✓ No errors — all {result.inserted + result.updated} operations succeeded.</p>
                ) : (
                  <p className="text-yellow-300 text-sm">⚠ {result.errors.length} error(s) occurred. See details below.</p>
                )}
                <button
                  onClick={handleDryRun}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Run again
                </button>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowErrors((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-red-400 font-medium">
                    <XCircle className="w-4 h-4" />
                    {result.errors.length} Error(s)
                  </span>
                  {showErrors ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showErrors && (
                  <div className="px-5 pb-4 space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-red-300 text-xs font-mono bg-red-950/20 px-3 py-1.5 rounded">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Match Strategy Breakdown */}
            {result.matched > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs font-medium mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  Match strategy breakdown
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-green-400">{result.matchedByPublicAssetId ?? 0}</p>
                    <p className="text-gray-400 text-xs mt-0.5">by public_asset_id</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-purple-400">{result.matchedByUuidAssetId ?? 0}</p>
                    <p className="text-gray-400 text-xs mt-0.5">by UUID assets.id</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-blue-400">{result.matches.filter(m => m.fileLevel === 'thumbnail').length}</p>
                    <p className="text-gray-400 text-xs mt-0.5">thumbnails (preview)</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-cyan-400">{result.matches.filter(m => m.fileLevel === 'preview').length}</p>
                    <p className="text-gray-400 text-xs mt-0.5">previews (preview)</p>
                  </div>
                </div>
                {result.detectedFormats && result.detectedFormats.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.detectedFormats.map((f) => (
                      <span key={f} className={`px-2 py-1 text-xs rounded font-mono ${f === 'uuid-asset-id' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40' : 'bg-gray-800 text-gray-300'}`}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Unmatched Paths */}
            {result.unmatchedPaths.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowUnmatched((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-yellow-400 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {result.unmatchedPaths.length} Unmatched Storage Path(s)
                  </span>
                  {showUnmatched ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showUnmatched && (
                  <div className="px-5 pb-4 space-y-1 max-h-64 overflow-y-auto">
                    {result.unmatchedPaths.map((p, i) => (
                      <p key={i} className="text-yellow-300 text-xs font-mono bg-yellow-950/20 px-3 py-1.5 rounded">{p}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Match Preview (dry run only) */}
            {step === 'dry_run_done' && result.matches.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowMatches((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-gray-300 font-medium">
                    <FileImage className="w-4 h-4 text-blue-400" />
                    Match Preview (first {result.matches.length} of {result.matched})
                  </span>
                  {showMatches ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showMatches && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-800/50">
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Public Asset ID</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Asset Title</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Level</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Strategy</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Bucket</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Path</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Size</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.matches.map((m, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-4 py-2 font-mono text-gray-300">{m.publicAssetId || <span className="text-gray-500 italic">via UUID</span>}</td>
                            <td className="px-4 py-2 text-gray-300 max-w-[180px] truncate" title={m.assetTitle}>{m.assetTitle}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                m.fileLevel === 'thumbnail' ?'bg-purple-900/40 text-purple-300' :'bg-blue-900/40 text-blue-300'
                              }`}>
                                {m.fileLevel}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${m.strategy === 'uuid-asset-id' ? 'bg-purple-900/40 text-purple-300' : 'bg-gray-800 text-gray-400'}`}>
                                {m.strategy ?? '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-400 font-mono">{m.bucket.replace('asset-', '')}</td>
                            <td className="px-4 py-2 font-mono text-gray-400 max-w-[200px] truncate" title={m.storagePath}>{m.storagePath}</td>
                            <td className="px-4 py-2 text-gray-400">{formatBytes(m.fileSizeBytes)}</td>
                            <td className="px-4 py-2">
                              {m.existingFileId ? (
                                <span className="text-blue-400 font-medium">UPDATE</span>
                              ) : (
                                <span className="text-green-400 font-medium">INSERT</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'gray' | 'green' | 'yellow' | 'blue';
}) {
  const colorMap = {
    gray: 'bg-gray-900 border-gray-800',
    green: 'bg-green-950/30 border-green-800/40',
    yellow: 'bg-yellow-950/30 border-yellow-800/40',
    blue: 'bg-blue-950/30 border-blue-800/40',
  };
  const textMap = {
    gray: 'text-white',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-gray-400 text-xs">{label}</span></div>
      <p className={`text-2xl font-bold ${textMap[color]}`}>{value.toLocaleString()}</p>
    </div>
  );
}
