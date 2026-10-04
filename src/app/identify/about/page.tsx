'use client';

import Link from 'next/link';
import { CircleAlert as AlertCircle, ArrowLeft, Shield, Eye, Trash2, FileText } from 'lucide-react';

export default function IdentifyAboutPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/identify" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={14} />
          Back to Identification
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">About Seafood Identification</h1>
          <p className="text-muted-foreground">
            Understanding how the identification system works and what it can and cannot do.
          </p>
        </div>

        <div className="space-y-8">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText size={18} className="text-ocean-600" />
              How identification works
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Seafood Vision Identification uses a structured, multi-level approach to suggest possible species and products based on your photo and the information you provide.
              </p>
              <p>
                <strong className="text-foreground">Level A — Your hints:</strong> The category, state (fresh/frozen), context, and notes you provide are used to narrow down candidates from the Seafood Vision database.
              </p>
              <p>
                <strong className="text-foreground">Level B — Structured search:</strong> Your information is compared against verified species, commercial names, product forms, and related media in Seafood Vision.
              </p>
              <p>
                <strong className="text-foreground">Level C — Visual AI:</strong> Visual comparison is not yet enabled. When available, it will be clearly indicated and will use only verified, authorised data.
              </p>
            </div>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              Important limitations
            </h2>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                Results are always suggestions — never confirmed identifications unless validated by an authorised expert.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                The system cannot determine geographic origin, certifications, price, weight, or calibre.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                The country where the photo was taken is never interpreted as the product's country of origin.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                No external AI or vision API is used in this phase.
              </li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield size={18} className="text-ocean-600" />
              Privacy and your photos
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Your uploaded photos are stored privately and securely. They are never published automatically.</p>
              <p>Photos are not added to the Seafood Vision catalogue without your separate, explicit consent.</p>
              <p>Photos are not sold or used for commercial purposes without your consent.</p>
              <p>You may delete your identification requests and associated photos at any time.</p>
              <p>Anonymous uploads are automatically deleted after a short retention period.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Eye size={18} className="text-ocean-600" />
              Confidence levels explained
            </h2>
            <div className="space-y-3">
              {[
                { level: 'Strong candidate', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'Multiple matching signals found in Seafood Vision verified data.' },
                { level: 'Possible candidate', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'Some matching signals found. Further verification recommended.' },
                { level: 'Limited evidence', color: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'Weak matching signals. Human review strongly recommended.' },
                { level: 'Insufficient information', color: 'bg-gray-100 text-gray-700 border-gray-200', desc: 'Not enough information to suggest a reliable candidate.' },
              ]?.map(({ level, color, desc }) => (
                <div key={level} className="flex items-start gap-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${color}`}>
                    {level}
                  </span>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Trash2 size={18} className="text-ocean-600" />
              Data retention
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Anonymous uploads: deleted automatically after 7 days.</p>
              <p>Member uploads: retained for 90 days if consent is given, otherwise 7 days.</p>
              <p>Cancelled requests: deleted promptly.</p>
              <p>Completed requests: deleted or archived according to your consent preference.</p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/identify/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm">
            Start identification
          </Link>
          <Link href="/identify/disclaimer" className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-muted transition-all duration-150 text-sm">
            Read disclaimer
          </Link>
        </div>
      </div>
    </div>
  );
}
