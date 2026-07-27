import React from 'react';
import { CircleCheck as CheckCircle2, Camera, Shield, Circle as XCircle } from 'lucide-react';

const verificationSteps = [
  {
    id: 'step-submit',
    step: '01',
    title: 'Field Documentation',
    description: 'Images are captured at source — fishing ports, processing facilities, markets, and aquaculture sites.',
  },
  {
    id: 'step-review',
    step: '02',
    title: 'Expert Review',
    description: 'Each asset is reviewed by a seafood professional who verifies species ID, product form, and metadata accuracy.',
  },
  {
    id: 'step-metadata',
    step: '03',
    title: 'Scientific Indexing',
    description: 'Scientific name, FAO area, product form, packaging, and all relevant attributes are documented before approval.',
  },
  {
    id: 'step-badge',
    step: '04',
    title: 'Verification Badge',
    description: 'Only assets that pass the full review receive the "Verified Real Seafood Image" badge visible on every approved asset.',
  },
];

const notOnPlatform = [
  'AI-generated or AI-enhanced images',
  'Studio composites with incorrect species',
  'Unverified species identification',
  'Images with GPS or supplier data',
  'Misleading product form labeling',
];

export default function AuthenticitySection() {
  return (
    <section className="py-20 bg-primary text-primary-foreground">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left: Verification process */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/8 text-white/70 text-xs font-medium mb-6">
              <Camera size={11} />
              Authenticity Framework
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold text-white mb-4 leading-tight">
              The &quot;Verified Real Seafood Image&quot; standard
            </h2>
            <p className="text-white/65 leading-relaxed mb-10">
              In an era of AI-generated imagery, the seafood industry needs a reliable visual reference. Every image on SeafoodVision goes through a structured verification process before it becomes visible.
            </p>

            <div className="flex flex-col gap-6">
              {verificationSteps?.map((step) => (
                <div key={step?.id} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                    <span className="text-xs font-bold font-mono-data text-secondary">
                      {step?.step}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">
                      {step?.title}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {step?.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Badge + what's NOT here */}
          <div className="flex flex-col gap-6">
            {/* Verified badge showcase */}
            <div className="bg-white/8 border border-white/15 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-verified/20 border border-green-verified/30 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                  Platform Standard
                </p>
                <h3 className="text-xl font-bold text-white mb-2">
                  Verified Real Seafood Image
                </h3>
                <p className="text-sm text-white/60 max-w-xs">
                  Manually verified, scientifically named, professionally documented. The badge you can trust.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-green-verified/15 border border-green-verified/25 rounded-full px-4 py-2">
                <CheckCircle2 size={14} className="text-green-400" />
                <span className="text-xs font-semibold text-green-300">
                  Verified Real Seafood Image
                </span>
              </div>
            </div>

            {/* What's NOT here */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Shield size={16} className="text-white/50" />
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                  You will not find here
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {notOnPlatform?.map((item) => (
                  <div key={`not-${item}`} className="flex items-center gap-3">
                    <XCircle size={14} className="text-coral-500 shrink-0" />
                    <span className="text-sm text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}