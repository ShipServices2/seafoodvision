'use client';

import Link from 'next/link';
import { Camera, Upload, Search, CheckCircle, AlertCircle, ArrowRight, Microscope, Fish, Eye, Users } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


export default function IdentifyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-ocean-900 via-ocean-800 to-ocean-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Microscope size={14} />
            Seafood Identification — Phase 6.1
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Identify a Seafood Product
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-4">
            Upload a real seafood photo and explore possible species, products and related verified media.
          </p>
          <p className="text-sm text-white/60 mb-8 max-w-xl mx-auto">
            Identification results are suggestions and may require expert confirmation.
          </p>
          <Link
            href="/identify/new"
            className="inline-flex items-center gap-2 bg-white text-ocean-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all duration-150 active:scale-95 shadow-lg"
          >
            <Camera size={18} />
            Start Identification
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      {/* Steps */}
      <section className="py-16 px-4 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: 1, icon: Upload, title: 'Upload', desc: 'Select a photo or use your camera to capture the seafood product.' },
              { step: 2, icon: Search, title: 'Add details', desc: 'Optionally describe the product type, state, and context.' },
              { step: 3, icon: Fish, title: 'Review candidates', desc: 'Explore possible species and related verified media from Seafood Vision.' },
              { step: 4, icon: Users, title: 'Request verification', desc: 'Ask an expert reviewer to confirm the identification.' },
            ]?.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center p-6 rounded-2xl bg-muted/40 border border-border">
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
      {/* Disclaimer banner */}
      <section className="py-8 px-4 bg-amber-50 border-b border-amber-200">
        <div className="max-w-3xl mx-auto flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">
              Identification results are suggestions only — not confirmed identifications.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Results use terms such as <em>Probable species</em>, <em>Possible match</em>, and <em>Identification candidate</em>. 
              Human verification is recommended for professional use.{' '}
              <Link href="/identify/disclaimer" className="underline hover:no-underline">Read disclaimer</Link>
            </p>
          </div>
        </div>
      </section>
      {/* What you can do */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-8">What Seafood Identification provides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: CheckCircle, text: 'Species candidates with confidence levels (Strong / Possible / Limited / Insufficient)' },
              { icon: CheckCircle, text: 'Related verified media from the Seafood Vision catalogue' },
              { icon: CheckCircle, text: 'Species fact sheets with scientific and commercial names' },
              { icon: CheckCircle, text: 'Matching based on your category, state, and context hints' },
              { icon: CheckCircle, text: 'Human expert review on request' },
              { icon: CheckCircle, text: 'Private and secure — your photo is never published automatically' },
            ]?.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                <Icon size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* What it does NOT do */}
      <section className="py-12 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Eye size={18} className="text-muted-foreground" />
            Current limitations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'No external AI or vision API used',
              'No automatic species confirmation',
              'No geographic origin determination',
              'No certification recognition',
              'No price estimation',
              'No weight or calibre guarantee',
              'Visual AI comparison not yet enabled',
            ]?.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to identify?</h2>
          <p className="text-muted-foreground mb-6">Upload a photo and explore possible matches from Seafood Vision verified data.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/identify/new"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-ocean-800 transition-all duration-150 active:scale-95"
            >
              <Camera size={16} />
              New identification
            </Link>
            <Link
              href="/identify/history"
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-xl hover:bg-muted transition-all duration-150"
            >
              My history
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
