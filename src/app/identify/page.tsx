'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Camera, Upload, CheckCircle, AlertCircle, Fish, Eye, Users, Sparkles, X, Loader2, Star, ExternalLink, Image as ImageIcon } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface IdentificationResult {
  candidates: {
    rank: number;
    commonName: string;
    scientificName: string;
    family: string;
    confidence: number;
    productForm?: string;
    reasons: string[];
  }[];
  similarImages: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    category: string | null;
  }[];
}

export default function IdentifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const handleIdentify = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    // Simulate SIE pipeline (mock — no provider connected)
    await new Promise((r) => setTimeout(r, 2200));
    setResult({
      candidates: [
        { rank: 1, commonName: 'Atlantic Salmon', scientificName: 'Salmo salar', family: 'Salmonidae', confidence: 72, productForm: 'Fillet', reasons: ['Coloration pattern matches', 'Body shape consistent with Salmonidae'] },
        { rank: 2, commonName: 'Rainbow Trout', scientificName: 'Oncorhynchus mykiss', family: 'Salmonidae', confidence: 54, productForm: 'Fillet', reasons: ['Similar family', 'Lateral line pattern visible'] },
        { rank: 3, commonName: 'Brown Trout', scientificName: 'Salmo trutta', family: 'Salmonidae', confidence: 38, productForm: 'Whole', reasons: ['Same genus as rank 1', 'Spot pattern partially matches'] },
        { rank: 4, commonName: 'Arctic Char', scientificName: 'Salvelinus alpinus', family: 'Salmonidae', confidence: 24, productForm: 'Fillet', reasons: ['Salmonidae family match', 'Color range overlaps'] },
        { rank: 5, commonName: 'Coho Salmon', scientificName: 'Oncorhynchus kisutch', family: 'Salmonidae', confidence: 14, productForm: 'Steak', reasons: ['Pacific salmon possibility', 'Low confidence — ambiguity detected'] },
      ],
      similarImages: [],
    });
    setRunning(false);
  };

  const confidenceColor = (score: number) =>
    score >= 60 ? 'text-emerald-600' : score >= 35 ? 'text-amber-600' : 'text-red-500';

  const confidenceBg = (score: number) =>
    score >= 60 ? 'bg-emerald-50 border-emerald-200' : score >= 35 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

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
                className={`relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-150 ${preview ? 'border-secondary/40' : 'border-border hover:border-secondary/40'}`}>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="Uploaded seafood photo for identification"
                      className="w-full rounded-2xl object-cover max-h-72" />
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null); }}
                      className="absolute top-3 right-3 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <ImageIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Drop a photo here or click to browse</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP — max 10 MB</p>
                  </div>
                )}
              </div>

              {file && (
                <button onClick={handleIdentify} disabled={running}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 shadow-sm">
                  {running ? (
                    <><Loader2 size={16} className="animate-spin" />Analyse en cours...</>
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
                {result ? 'Top 5 Probable Species' : 'Results will appear here'}
              </h2>

              {!result && !running && (
                <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center px-4">
                  <Fish size={36} className="text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Upload a photo and click Identify with AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Free · No account required</p>
                </div>
              )}

              {running && (
                <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-10 h-10 border-2 border-border border-t-violet-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-medium text-foreground">Seafood Intelligence Engine</p>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {['Analyse...', 'Vision...', 'Recherche taxonomique...', 'Construction des métadonnées...'].map((s, i) => (
                      <p key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>{s}</p>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  {result.candidates.map((c) => (
                    <div key={c.rank}
                      className={`border rounded-xl p-4 ${c.rank === 1 ? confidenceBg(c.confidence) : 'bg-card border-border'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.rank === 1 ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'}`}>
                            {c.rank}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{c.commonName}</p>
                            <p className="text-xs text-muted-foreground italic">{c.scientificName}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold font-mono-data ${confidenceColor(c.confidence)}`}>{c.confidence}%</p>
                          <p className="text-xs text-muted-foreground">confiance</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{c.family}</span>
                        {c.productForm && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">{c.productForm}</span>}
                      </div>
                      <ul className="space-y-0.5">
                        {c.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <Star size={8} className="text-violet-400 shrink-0 mt-0.5" />
                            {r}
                          </li>
                        ))}
                      </ul>
                      {c.rank === 1 && (
                        <div className="mt-3 flex gap-2">
                          <Link href={`/species?q=${encodeURIComponent(c.commonName)}`}
                            className="text-xs text-secondary underline hover:no-underline flex items-center gap-1">
                            <ExternalLink size={10} />Fiche espèce
                          </Link>
                          <Link href={`/library?q=${encodeURIComponent(c.commonName)}`}
                            className="text-xs text-secondary underline hover:no-underline flex items-center gap-1">
                            <ExternalLink size={10} />Photos disponibles
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      Ces résultats sont des suggestions IA — jamais des identifications certaines.
                      Validation humaine requise pour usage professionnel.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: 1, icon: Upload, title: 'Upload', desc: 'Select a photo or drag and drop a seafood product image.' },
              { step: 2, icon: Eye, title: 'Vision Analysis', desc: 'The SIE analyzes shape, texture, color, fins, and product form.' },
              { step: 3, icon: Fish, title: 'Top 5 Candidates', desc: 'Explore 5 probable species with confidence scores and reasons.' },
              { step: 4, icon: Users, title: 'Expert Validation', desc: 'Request human reviewer confirmation for professional use.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center mb-3 font-bold text-lg">
                  {step}
                </div>
                <Icon size={20} className="text-ocean-600 mb-2" />
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-8">What Seafood Identification provides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: CheckCircle, text: 'Top 5 species candidates with confidence levels' },
              { icon: CheckCircle, text: 'Scientific name, commercial name, and family' },
              { icon: CheckCircle, text: 'Similar verified images from Seafood Vision catalog' },
              { icon: CheckCircle, text: 'Links to species fact sheets and available photos' },
              { icon: CheckCircle, text: 'Product form detection (Whole, Fillet, IQF, Block...)' },
              { icon: CheckCircle, text: 'Free · No account required · Photo never auto-published' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                <Icon size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center border-t border-border">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to identify?</h2>
          <p className="text-muted-foreground mb-6">Upload a photo and explore possible matches from Seafood Vision verified data.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/identify/new"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-ocean-800 transition-all duration-150 active:scale-95">
              <Camera size={16} />New identification
            </Link>
            <Link href="/identify/history"
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-xl hover:bg-muted transition-all duration-150">
              My history
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
