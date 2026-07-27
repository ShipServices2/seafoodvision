'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function IdentifyDisclaimerPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/identify" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={14} />
          Back to Identification
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium mb-4">
            <AlertTriangle size={12} />
            Important notice
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Identification Disclaimer</h1>
          <p className="text-muted-foreground">
            Please read this disclaimer carefully before using the Seafood Identification feature.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">1. Suggestions only — not confirmed identifications</h2>
            <p className="text-sm text-muted-foreground">
              All results produced by the Seafood Vision Identification system are suggestions and identification candidates only. They are presented using terms such as <em>Probable species</em>, <em>Possible match</em>, and <em>Identification candidate</em>. No result should be treated as a confirmed identification unless it has been explicitly validated by an authorised expert or administrator within the Seafood Vision platform.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">2. Database limitations</h2>
            <p className="text-sm text-muted-foreground">
              Results depend entirely on the data currently available in Seafood Vision. The database may be incomplete. Species, products, or presentations not yet catalogued will not appear as candidates. The absence of a result does not mean the species does not exist.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">3. No legal, medical, or regulatory advice</h2>
            <p className="text-sm text-muted-foreground">
              Seafood Vision Identification does not provide legal advice, medical advice, food safety advice, or regulatory compliance guidance. For any question involving food safety, import/export regulations, allergens, certifications, or health, you must consult the relevant competent authority or certified professional.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">4. No certification or origin guarantee</h2>
            <p className="text-sm text-muted-foreground">
              The system cannot confirm certifications, geographic origin, sustainability status, or compliance with any standard. The country where a photo was taken is never interpreted as the product's country of origin. No result constitutes a guarantee of any kind.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">5. No price, weight, or calibre estimation</h2>
            <p className="text-sm text-muted-foreground">
              The system does not estimate prices, weights, calibres, or commercial availability. Any such information must be obtained from verified commercial sources.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">6. Data may change</h2>
            <p className="text-sm text-muted-foreground">
              The Seafood Vision database is continuously updated. Information that was accurate at the time of a previous identification may have changed. Always verify against the most current data.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3">7. No visual AI in this phase</h2>
            <p className="text-sm text-muted-foreground">
              The current version of Seafood Identification does not use any external AI vision model or image recognition API. Candidates are generated from structured data and user-provided hints only. When visual AI is enabled in a future phase, it will be clearly indicated.
            </p>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-amber-900 mb-3">Professional reference notice</h2>
            <p className="text-sm text-amber-800">
              This tool is provided for professional reference purposes only and does not replace verification with the relevant authority, certification body, or qualified expert. Seafood Vision accepts no liability for decisions made based solely on identification suggestions produced by this system.
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link href="/identify/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm">
            I understand — Start identification
          </Link>
        </div>
      </div>
    </div>
  );
}
