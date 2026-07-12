import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LicensingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Licensing</p>
          <h1 className="text-4xl font-bold text-foreground mb-4">Licensing Terms</h1>
          <p className="text-muted-foreground mb-10 leading-relaxed">
            SeafoodVision offers two primary license types for its visual assets. All licenses are subject to the terms below.
          </p>

          <div className="space-y-8">
            {[
              {
                title: 'Commercial License',
                badge: 'commercial',
                desc: 'Permits use of the asset in commercial contexts including advertising, product packaging, marketing materials, websites, and promotional content.',
                includes: [
                  'Digital and print advertising',
                  'Product packaging and labeling',
                  'Corporate websites and presentations',
                  'Social media marketing',
                  'Trade publications',
                ],
                excludes: [
                  'Resale of the original asset',
                  'Use in AI training datasets',
                  'Sublicensing to third parties',
                ],
              },
              {
                title: 'Editorial License',
                badge: 'editorial',
                desc: 'Permits use of the asset in editorial contexts including news articles, educational materials, and non-commercial publications.',
                includes: [
                  'News and press articles',
                  'Educational materials',
                  'Research publications',
                  'Non-commercial blogs',
                  'Documentary content',
                ],
                excludes: [
                  'Commercial advertising',
                  'Product packaging',
                  'Resale of the original asset',
                ],
              },
            ]?.map((license) => (
              <div key={license?.title} className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-foreground">{license?.title}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${license?.badge}`}>
                    {license?.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{license?.desc}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Permitted uses</h3>
                    <ul className="space-y-1.5">
                      {license?.includes?.map((item) => (
                        <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-verified shrink-0 mt-0.5">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Not permitted</h3>
                    <ul className="space-y-1.5">
                      {license?.excludes?.map((item) => (
                        <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-muted/50 rounded-xl p-5 text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Note:</strong> These licensing terms are preliminary and subject to change before the commercial launch of the platform. Demo assets are not available for licensing. Contact us for enterprise or custom licensing arrangements.
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/pricing" className="btn-primary">View pricing</Link>
            <Link href="/contact" className="btn-outline">Contact for custom licensing</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
