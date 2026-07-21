'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Upload, AlertCircle, Fish, Sparkles, X, Loader2, Star, ExternalLink, Image as ImageIcon, Info } from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  rank: number;
  commonName: string;
  scientificName: string;
  family: string | null;
  confidenceScore: number | null;
  confidenceLevel: string;
  productForm: string | null;
  reasons: string[];
  sourceType: string;
}

interface IdentificationResult {
  requestId: string;
  candidates: Candidate[];
  fromCache: boolean;
  seafoodDetected: boolean;
  visualAI: { enabled: boolean; message: string; provider?: string; model?: string };
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 60) return 'text-emerald-600';
  if (score >= 35) return 'text-amber-600';
  return 'text-red-500';
}

function confidenceBg(score: number | null, rank: number): string {
  if (rank !== 1) return 'bg-card border-border';
  if (score === null) return 'bg-card border-border';
  if (score >= 60) return 'bg-emerald-50 border-emerald-200';
  if (score >= 35) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdentifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  // ── REAL identification flow ──────────────────────────────────────────────
  const handleIdentify = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      // ── STEP 1: Upload the actual image file ──────────────────────────────
      setStepLabel('Uploading image…');
      console.log(`[identify/page] Starting upload | filename=${file.name} | size=${file.size} | type=${file.type}`);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('consentForRetention', 'false');
      fd.append('locale', 'en');

      const uploadRes = await fetch('/api/identification/upload', {
        method: 'POST',
        body: fd,
        // No Content-Type header — browser sets it with boundary for FormData
        cache: 'no-store',
      });

      const uploadData = await uploadRes.json();
      console.log(`[identify/page] Upload response | status=${uploadRes.status} | requestId=${uploadData.requestId ?? 'none'} | uploadPath=${uploadData.uploadPath ?? 'none'}`);

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || `Upload failed (HTTP ${uploadRes.status})`);
      }

      const requestId: string = uploadData.requestId;
      if (!requestId) {
        throw new Error('Upload succeeded but no requestId returned — cannot proceed.');
      }

      // ── STEP 2: Analyze via OpenAI Vision ────────────────────────────────
      setStepLabel('Calling OpenAI Vision…');
      console.log(`[identify/page] Calling analyze | requestId=${requestId}`);

      const analyzeRes = await fetch('/api/identification/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          requestId,
          categoryHint: null,
          stateHint: null,
          contextHint: null,
          countryHint: null,
          notes: null,
        }),
        cache: 'no-store',
      });

      const analyzeData = await analyzeRes.json();
      console.log(`[identify/page] Analyze response | status=${analyzeRes.status} | fromCache=${analyzeData.fromCache} | candidateCount=${analyzeData.candidateCount} | seafoodDetected=${analyzeData.seafoodDetected} | visualAI.enabled=${analyzeData.visualAI?.enabled}`);

      if (!analyzeRes.ok) {
        // Surface credit errors clearly
        if (analyzeRes.status === 402) {
          throw new Error(analyzeData.error || 'Insufficient credits — 2 credits required for identification.');
        }
        throw new Error(analyzeData.error || `Analysis failed (HTTP ${analyzeRes.status})`);
      }

      // ── STEP 3: Fetch the saved candidates from DB ────────────────────────
      setStepLabel('Fetching results…');
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: candidateRows, error: candErr } = await supabase
        .from('identification_candidates')
        .select('*, species:species_id(id, slug, common_name, scientific_name, family, category, description)')
        .eq('request_id', requestId)
        .order('rank');

      if (candErr) {
        console.error('[identify/page] Failed to fetch candidates:', candErr.message);
        throw new Error(`Could not load results: ${candErr.message}`);
      }

      console.log(`[identify/page] Candidates fetched | count=${candidateRows?.length ?? 0}`);

      // Guard: never show results if OpenAI was not called or returned nothing
      if (!analyzeData.visualAI?.enabled && (!candidateRows || candidateRows.length === 0)) {
        throw new Error(
          analyzeData.visualAI?.message ||
          'OpenAI Vision was not called or returned no results. No image was transmitted to the AI.'
        );
      }

      // Map DB rows to display candidates
      const candidates: Candidate[] = (candidateRows || []).map((row: Record<string, unknown>) => {
        const sp = row.species as Record<string, unknown> | null;
        const reasons = ((row.match_reasons as { code: string; label: string }[]) || []).map((r) => r.label);
        return {
          rank: row.rank as number,
          commonName: sp?.common_name as string ?? (row.species_id ? String(row.species_id) : 'Unknown species'),
          scientificName: sp?.scientific_name as string ?? '',
          family: sp?.family as string | null ?? null,
          confidenceScore: row.confidence_score as number | null,
          confidenceLevel: row.confidence_level as string,
          productForm: null, // product_form comes from OpenAI vision result, not stored per-candidate
          reasons,
          sourceType: row.source_type as string,
        };
      });

      setResult({
        requestId,
        candidates,
        fromCache: analyzeData.fromCache ?? false,
        seafoodDetected: analyzeData.seafoodDetected ?? true,
        visualAI: analyzeData.visualAI ?? { enabled: false, message: 'Unknown' },
        status: analyzeData.status,
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('[identify/page] Identification error:', msg);
      setError(msg);
    } finally {
      setRunning(false);
      setStepLabel('');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-ocean-900 via-ocean-800 to-ocean-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles size={14} />
            Seafood Intelligence Engine — Phase 8
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Identify a Seafood Product
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-4">
            Upload a real seafood photo. The SIE returns Top 5 probable species with confidence scores and similar verified images.
          </p>
          <p className="text-sm text-white/60 mb-8 max-w-xl mx-auto">
            Results are AI suggestions — not confirmed identifications. Human validation recommended for professional use.
          </p>
        </div>
      </section>

      {/* Upload + Results */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Upload panel */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Upload a photo</h2>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-150 ${
                  preview ? 'border-secondary/40' : 'border-border hover:border-secondary/40'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="Uploaded seafood photo for identification"
                      className="w-full rounded-2xl object-cover max-h-72"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                        setResult(null);
                        setError(null);
                      }}
                      className="absolute top-3 right-3 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <ImageIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Drop a photo here or click to browse</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 20 MB</p>
                  </div>
                )}
              </div>

              {/* File info */}
              {file && !running && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {file.name} — {(file.size / 1024).toFixed(0)} KB — {file.type}
                </p>
              )}

              {file && (
                <button
                  onClick={handleIdentify}
                  disabled={running}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                >
                  {running ? (
                    <><Loader2 size={16} className="animate-spin" />{stepLabel || 'Analyse en cours…'}</>
                  ) : (
                    <><Sparkles size={16} />IDENTIFY WITH AI</>
                  )}
                </button>
              )}

              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Results are AI suggestions only — not confirmed identifications.
                  Human verification is recommended for professional use.{' '}
                  <Link href="/identify/disclaimer" className="underline hover:no-underline">Read disclaimer</Link>
                </p>
              </div>
            </div>

            {/* Results panel */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">
                {result ? `Top ${result.candidates.length} Probable Species` : 'Results will appear here'}
              </h2>

              {!result && !running && (
                <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center px-4">
                  <Fish size={36} className="text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Upload a photo and click Identify with AI</p>
                  <p className="text-xs text-muted-foreground mt-1">2 credits per identification · Requires account</p>
                </div>
              )}

              {running && (
                <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-10 h-10 border-2 border-border border-t-violet-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-medium text-foreground">Seafood Intelligence Engine</p>
                  <p className="text-xs text-muted-foreground mt-2">{stepLabel}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {['Uploading image…', 'OpenAI Vision analysis…', 'Taxonomic matching…', 'Building results…'].map((s, i) => (
                      <p key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.4}s` }}>{s}</p>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  {/* AI source badge */}
                  <div className={`flex items-start gap-2 rounded-xl p-3 text-xs border ${
                    result.visualAI.enabled
                      ? 'bg-violet-50 border-violet-200 text-violet-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      {result.fromCache ? '⚡ From cache (same image)' : result.visualAI.enabled ? '🤖 OpenAI Vision' : '⚠️ Fallback (no vision)'} —{' '}
                      {result.visualAI.message}
                      {result.requestId && (
                        <span className="ml-2 opacity-60">req:{result.requestId.slice(0, 8)}</span>
                      )}
                    </span>
                  </div>

                  {/* No seafood detected */}
                  {!result.seafoodDetected && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                      <Fish size={28} className="text-orange-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-orange-800">No seafood detected</p>
                      <p className="text-xs text-orange-600 mt-1">
                        The AI did not detect any seafood in this image. Try a clearer photo of a fish, shellfish, or seafood product.
                      </p>
                    </div>
                  )}

                  {/* Candidate cards */}
                  {result.candidates.length === 0 && result.seafoodDetected && (
                    <div className="bg-muted/40 border border-border rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">No species candidates returned by the AI.</p>
                    </div>
                  )}

                  {result.candidates.map((c) => (
                    <div
                      key={c.rank}
                      className={`border rounded-xl p-4 ${confidenceBg(c.confidenceScore, c.rank)}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            c.rank === 1 ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'
                          }`}>
                            {c.rank}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{c.commonName}</p>
                            {c.scientificName && (
                              <p className="text-xs text-muted-foreground italic">{c.scientificName}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {c.confidenceScore !== null ? (
                            <>
                              <p className={`text-sm font-bold font-mono-data ${confidenceColor(c.confidenceScore)}`}>
                                {c.confidenceScore}%
                              </p>
                              <p className="text-xs text-muted-foreground">confidence</p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">{c.confidenceLevel?.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {c.family && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                            {c.family}
                          </span>
                        )}
                        <span className="text-xs bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full capitalize">
                          {c.sourceType?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {c.reasons.length > 0 && (
                        <ul className="space-y-0.5">
                          {c.reasons.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                              <Star size={8} className="text-violet-400 shrink-0 mt-0.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.rank === 1 && c.commonName && (
                        <div className="mt-3 flex gap-2">
                          <Link
                            href={`/species?q=${encodeURIComponent(c.commonName)}`}
                            className="text-xs text-secondary underline hover:no-underline flex items-center gap-1"
                          >
                            <ExternalLink size={10} />Species page
                          </Link>
                          <Link
                            href={`/library?q=${encodeURIComponent(c.commonName)}`}
                            className="text-xs text-secondary underline hover:no-underline flex items-center gap-1"
                          >
                            <ExternalLink size={10} />Photos
                          </Link>
                          <Link
                            href={`/identify/${result.requestId}/results`}
                            className="text-xs text-secondary underline hover:no-underline flex items-center gap-1"
                          >
                            <ExternalLink size={10} />Full results
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      These results are AI suggestions — never confirmed identifications.
                      Human validation required for professional use.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
