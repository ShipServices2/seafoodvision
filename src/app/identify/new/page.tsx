'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, Camera, X, AlertCircle, CheckCircle, ArrowRight, ArrowLeft,
  Loader2, Image as ImageIcon, Info, ChevronDown
} from 'lucide-react';
import type { QualityFlag } from '@/lib/identification/types';

type Step = 1 | 2 | 3 | 4;

interface FormState {
  file: File | null;
  previewUrl: string | null;
  qualityFlags: QualityFlag[];
  qualityStatus: 'pending' | 'passed' | 'warning' | 'failed';
  categoryHint: string;
  stateHint: string;
  contextHint: string;
  countryHint: string;
  notes: string;
  consentForRetention: boolean;
  privacyAcknowledged: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_MB = 20;

function checkImageQuality(file: File): QualityFlag[] {
  const flags: QualityFlag[] = [];
  if (file.size < 50 * 1024) {
    flags.push({ code: 'too_small', severity: 'warning', message: 'Image may be too small for reliable identification.' });
  }
  if (file.size > 15 * 1024 * 1024) {
    flags.push({ code: 'large_file', severity: 'warning', message: 'Large file — upload may take longer.' });
  }
  return flags;
}

export default function IdentifyNewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    file: null,
    previewUrl: null,
    qualityFlags: [],
    qualityStatus: 'pending',
    categoryHint: '',
    stateHint: '',
    contextHint: '',
    countryHint: '',
    notes: '',
    consentForRetention: false,
    privacyAcknowledged: false,
  });

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WEBP, and HEIC are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }
    const flags = checkImageQuality(file);
    const url = URL.createObjectURL(file);
    setForm(prev => ({
      ...prev,
      file,
      previewUrl: url,
      qualityFlags: flags,
      qualityStatus: flags.some(f => f.severity === 'error') ? 'failed' : flags.length > 0 ? 'warning' : 'passed',
    }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const removeFile = () => {
    if (form.previewUrl) URL.revokeObjectURL(form.previewUrl);
    setForm(prev => ({ ...prev, file: null, previewUrl: null, qualityFlags: [], qualityStatus: 'pending' }));
  };

  const handleUploadAndAnalyze = async () => {
    if (!form.file || !form.privacyAcknowledged) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Upload
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('consentForRetention', String(form.consentForRetention));
      fd.append('locale', 'en');

      const uploadRes = await fetch('/api/identification/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const reqId = uploadData.requestId;
      setRequestId(reqId);
      setStep(4);

      // Step 2: Analyze
      const analyzeRes = await fetch('/api/identification/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: reqId,
          categoryHint: form.categoryHint || null,
          stateHint: form.stateHint || null,
          contextHint: form.contextHint || null,
          countryHint: form.countryHint || null,
          notes: form.notes || null,
        }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Analysis failed');

      router.push(`/identify/${reqId}/results`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setLoading(false);
      setStep(3);
    }
  };

  const stepLabels = ['Upload', 'Add details', 'Review & submit', 'Analyzing'];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/identify" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft size={14} />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-foreground">New Identification</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload a seafood photo and explore possible species candidates.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const s = (i + 1) as Step;
            const active = step === s;
            const done = step > s;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? 'bg-emerald-500 border-emerald-500 text-white' : active ?'bg-primary border-primary text-primary-foreground': 'bg-background border-border text-muted-foreground'
                  }`}>
                    {done ? <CheckCircle size={14} /> : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${step > s ? 'bg-emerald-400' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Privacy notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-medium mb-2 flex items-center gap-2"><Info size={14} />Before you upload</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Your image will be used to attempt an identification only.</li>
                <li>• It will not be automatically published or added to the catalogue.</li>
                <li>• It will not be sold or used commercially without your consent.</li>
                <li>• You can delete your request at any time.</li>
              </ul>
            </div>

            {/* Drop zone */}
            {!form.file ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-all duration-150"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon size={24} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drop your photo here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, WEBP, HEIC — max {MAX_SIZE_MB}MB</p>
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <img src={form.previewUrl!} alt="Selected seafood photo for identification" className="w-full max-h-64 object-contain bg-muted" />
                <button
                  onClick={removeFile}
                  className="absolute top-3 right-3 w-8 h-8 bg-foreground/80 text-background rounded-full flex items-center justify-center hover:bg-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Camera capture for mobile */}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Upload size={16} />
                Browse files
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
                <Camera size={16} />
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quality flags */}
            {form.qualityFlags.length > 0 && (
              <div className="space-y-2">
                {form.qualityFlags.map((flag) => (
                  <div key={flag.code} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    flag.severity === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    {flag.message}
                  </div>
                ))}
                <div className="flex gap-2 text-sm">
                  <button onClick={removeFile} className="text-muted-foreground hover:text-foreground underline">Retake photo</button>
                  <span className="text-muted-foreground">or</span>
                  <button onClick={() => setStep(2)} className="text-primary hover:underline">Continue anyway</button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!form.file}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-ocean-800 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 2 — Hints */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground mb-1"><Info size={14} />Optional details</p>
              These hints help narrow down candidates. None are required. The country field is where the photo was taken — not the product origin.
            </div>

            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product category</label>
                <div className="relative">
                  <select
                    value={form.categoryHint}
                    onChange={(e) => setForm(prev => ({ ...prev, categoryHint: e.target.value }))}
                    className="w-full appearance-none border border-border rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                  >
                    <option value="">Unknown / not sure</option>
                    <option value="fish">Fish</option>
                    <option value="crustacean">Crustacean</option>
                    <option value="cephalopod">Cephalopod</option>
                    <option value="mollusk">Mollusk</option>
                    <option value="other">Other seafood</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product state</label>
                <div className="relative">
                  <select
                    value={form.stateHint}
                    onChange={(e) => setForm(prev => ({ ...prev, stateHint: e.target.value }))}
                    className="w-full appearance-none border border-border rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                  >
                    <option value="">Unknown / not sure</option>
                    <option value="fresh">Fresh</option>
                    <option value="frozen">Frozen</option>
                    <option value="processed">Processed</option>
                    <option value="dried">Dried / salted</option>
                    <option value="live">Live</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Photo context</label>
                <div className="relative">
                  <select
                    value={form.contextHint}
                    onChange={(e) => setForm(prev => ({ ...prev, contextHint: e.target.value }))}
                    className="w-full appearance-none border border-border rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                  >
                    <option value="">Not specified</option>
                    <option value="market">Fish market</option>
                    <option value="factory">Processing factory</option>
                    <option value="boat">Fishing boat</option>
                    <option value="carton">Carton / packaging</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="retail">Retail / supermarket</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Country where photo was taken
                  <span className="ml-2 text-xs text-muted-foreground font-normal">(not the product origin)</span>
                </label>
                <input
                  type="text"
                  value={form.countryHint}
                  onChange={(e) => setForm(prev => ({ ...prev, countryHint: e.target.value }))}
                  placeholder="e.g. Morocco, Japan, Norway..."
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Additional notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Describe what you see: size, colour, texture, any visible labels..."
                  rows={3}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-muted transition-all duration-150 text-sm"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 active:scale-95 text-sm"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Review & Submit */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Preview */}
            {form.previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-border">
                <img src={form.previewUrl} alt="Photo to be submitted for identification" className="w-full max-h-48 object-contain bg-muted" />
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2 text-sm">
              <h3 className="font-medium text-foreground">Submission summary</h3>
              {form.categoryHint && <p className="text-muted-foreground">Category: <span className="text-foreground">{form.categoryHint}</span></p>}
              {form.stateHint && <p className="text-muted-foreground">State: <span className="text-foreground">{form.stateHint}</span></p>}
              {form.contextHint && <p className="text-muted-foreground">Context: <span className="text-foreground">{form.contextHint}</span></p>}
              {form.countryHint && <p className="text-muted-foreground">Country (photo taken): <span className="text-foreground">{form.countryHint}</span></p>}
              {form.notes && <p className="text-muted-foreground">Notes: <span className="text-foreground">{form.notes}</span></p>}
              {!form.categoryHint && !form.stateHint && !form.notes && (
                <p className="text-muted-foreground italic">No additional hints provided.</p>
              )}
            </div>

            {/* Privacy consent */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.privacyAcknowledged}
                  onChange={(e) => setForm(prev => ({ ...prev, privacyAcknowledged: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">
                  I understand that this image will be used to attempt an identification. It will not be published automatically, sold, or added to the catalogue without my separate consent.{' '}
                  <Link href="/identify/disclaimer" className="text-primary hover:underline" target="_blank">Read disclaimer</Link>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consentForRetention}
                  onChange={(e) => setForm(prev => ({ ...prev, consentForRetention: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-muted-foreground">
                  Allow Seafood Vision to retain this image for improving identification after anonymization and review. <span className="text-xs">(Optional — not checked by default)</span>
                </span>
              </label>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-muted transition-all duration-150 text-sm"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={handleUploadAndAnalyze}
                disabled={!form.privacyAcknowledged || loading}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Submit for identification
                {!loading && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Analyzing */}
        {step === 4 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 size={28} className="text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Analyzing your photo</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Searching Seafood Vision verified data for possible species candidates and related media...
            </p>
            <p className="text-xs text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
