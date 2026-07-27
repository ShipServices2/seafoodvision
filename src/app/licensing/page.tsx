import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, XCircle, ArrowRight, Shield, FileText } from 'lucide-react';
import { LICENSE_TYPES } from '@/lib/pricingConfig';

export default function LicensingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">

        {/* Hero */}
        <div className="max-w-3xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Licensing</p>
          <h1 className="text-4xl font-bold text-foreground mb-4">License types</h1>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            Every Seafood Vision asset is licensed under one of four license types. Choose the license that matches your intended use — from editorial publications to exclusive commercial campaigns.
          </p>
        </div>

        {/* License cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {LICENSE_TYPES?.map((license) => (
            <div key={license?.id} className="bg-card rounded-2xl border border-border p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${license?.color}`}>
                    <Shield size={11} />
                    {license?.name}
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{license?.name} License</h2>
                </div>
                {license?.price !== null ? (
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-foreground font-mono-data">{license?.price}€</div>
                    <div className="text-xs text-muted-foreground">per asset</div>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-muted-foreground">Included in plan</div>
                    <div className="text-xs text-muted-foreground">or negotiated</div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{license?.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-green-verified" />
                    Permitted uses
                  </h3>
                  <ul className="space-y-1.5">
                    {license?.rights?.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-verified shrink-0 mt-0.5 text-xs">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <XCircle size={12} className="text-red-500" />
                    Restrictions
                  </h3>
                  <ul className="space-y-1.5">
                    {license?.restrictions?.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-500 shrink-0 mt-0.5 text-xs">✗</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* License comparison table */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <FileText size={18} className="text-secondary" />
            License comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">Use case</th>
                  {LICENSE_TYPES?.map((l) => (
                    <th key={l?.id} className="text-center px-4 py-3 font-semibold text-foreground">{l?.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'News & press', values: [true, false, false, false] },
                  { label: 'Educational use', values: [true, true, true, true] },
                  { label: 'Commercial advertising', values: [false, true, true, true] },
                  { label: 'Product packaging', values: [false, true, true, true] },
                  { label: 'Broadcast / streaming', values: [false, false, true, true] },
                  { label: 'Merchandise', values: [false, false, true, true] },
                  { label: 'Exclusive worldwide use', values: [false, false, false, true] },
                  { label: 'Unlimited print runs', values: [false, false, true, true] },
                ]?.map((row) => (
                  <tr key={row?.label} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{row?.label}</td>
                    {row?.values?.map((v, i) => (
                      <td key={i} className="text-center px-4 py-3">
                        {v ? (
                          <CheckCircle2 size={15} className="text-green-verified mx-auto" />
                        ) : (
                          <XCircle size={15} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Note */}
        <div className="bg-muted/50 rounded-xl p-5 text-sm text-muted-foreground leading-relaxed mb-10">
          <strong className="text-foreground">Note:</strong> These licensing terms are preliminary and subject to change before the commercial launch of the platform. Demo assets are not available for licensing. Contact us for enterprise or custom licensing arrangements.
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/pricing" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">
            View pricing plans
            <ArrowRight size={14} />
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
            Contact for custom licensing
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
