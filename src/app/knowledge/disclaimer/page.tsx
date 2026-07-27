'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Disclaimer</span>
        </nav>

        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-0.5">Legal Notice</p>
              <h1 className="text-3xl font-bold text-foreground">Disclaimer</h1>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-8">
            <p className="text-sm text-amber-800 font-medium">
              The information provided in the Seafood Vision encyclopedia is intended for professional reference purposes only. It does not constitute legal, regulatory, or commercial advice.
            </p>
          </div>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-foreground mb-3">Professional Use Only</h2>
              <p>
                All content in the Seafood Vision Knowledge Encyclopedia is intended for professional seafood industry reference. Users are responsible for independently verifying any information before making commercial, regulatory, or operational decisions.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">No Regulatory Guarantee</h2>
              <p>
                Seafood Vision does not provide definitive regulatory advice. Market requirements, import regulations, labeling rules, and certification requirements vary by country and change over time. Always consult official regulatory authorities and qualified legal advisors for compliance matters.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">No Commercial Guarantee</h2>
              <p>
                The presence of a product, species, packaging configuration, or market reference in this encyclopedia does not constitute a commercial endorsement, availability guarantee, or price indication. Commercial conditions vary and must be verified independently.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">Data Subject to Change</h2>
              <p>
                The seafood industry is dynamic. Species classifications, market requirements, certification standards, and product specifications evolve. Data in this encyclopedia reflects the state of knowledge at the time of last validation and may not reflect the most current situation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">No Automatic Certification</h2>
              <p>
                The presence of a certification name or logo in this encyclopedia does not imply that any specific product, company, or facility holds that certification. Certification claims are clearly labeled with their validation status (claimed, under verification, verified, expired, disputed). Only "Verified" status indicates that supporting documentation has been reviewed by a qualified person.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">Confidential Information</h2>
              <p>
                Internal documents, private notes, supplier identities, customer names, and confidential commercial information are never displayed publicly. If you believe confidential information has been inadvertently exposed, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">Demonstration Data</h2>
              <p>
                Data marked with a "Demo" badge is sample data used for platform demonstration purposes only. It does not represent real commercial products, real species documentation, or real market conditions. Demo data is excluded from all real statistics.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">Independent Verification Required</h2>
              <p>
                Before using any information from this encyclopedia for commercial, regulatory, or operational purposes, users must independently verify the information with appropriate official sources, qualified experts, or regulatory authorities.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-foreground mb-3">No Legal Advice</h2>
              <p>
                Nothing in this encyclopedia constitutes legal advice. For legal matters related to seafood trade, import/export regulations, intellectual property, or certification compliance, consult a qualified legal professional.
              </p>
            </section>
          </div>

          <div className="mt-10 flex gap-3">
            <Link href="/knowledge/methodology" className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:border-secondary/40 transition-colors">
              Methodology
            </Link>
            <Link href="/knowledge" className="px-4 py-2.5 bg-ocean-900 text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">
              Back to Encyclopedia
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
