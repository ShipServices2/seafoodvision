'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, FileCheck, Globe, Newspaper, Briefcase, Building2, ArrowRight, Lock, Info } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import type { LicenseDefinition } from '@/lib/supabase/types';
import Icon from '@/components/ui/AppIcon';


const LICENSE_ICONS: Record<string, React.ElementType> = {
  web: Globe,
  editorial: Newspaper,
  commercial: Briefcase,
  extended: FileCheck,
  enterprise: Building2,
};

const LICENSE_COLORS: Record<string, string> = {
  web: 'from-blue-50 to-blue-100/50 border-blue-200',
  editorial: 'from-violet-50 to-violet-100/50 border-violet-200',
  commercial: 'from-amber-50 to-amber-100/50 border-amber-200',
  extended: 'from-orange-50 to-orange-100/50 border-orange-200',
  enterprise: 'from-slate-50 to-slate-100/50 border-slate-200',
};

const LICENSE_ICON_COLORS: Record<string, string> = {
  web: 'text-blue-600 bg-blue-100',
  editorial: 'text-violet-600 bg-violet-100',
  commercial: 'text-amber-600 bg-amber-100',
  extended: 'text-orange-600 bg-orange-100',
  enterprise: 'text-slate-600 bg-slate-100',
};

const FALLBACK_LICENSES: LicenseDefinition[] = [
  {
    id: '1', license_type: 'web', display_name: 'Web License',
    description: 'For digital use on websites, social media, and online platforms.',
    rights: 'Digital display, social media, web publishing, email marketing',
    restrictions: 'No print, no broadcast, no resale, no sublicensing',
    indicative_price_eur: 29, is_active: false, coming_soon: true,
    created_at: '', updated_at: '',
  },
  {
    id: '2', license_type: 'editorial', display_name: 'Editorial License',
    description: 'For editorial use in news, magazines, and educational content.',
    rights: 'News articles, magazines, educational materials, non-commercial editorial',
    restrictions: 'No commercial advertising, no product packaging, no resale',
    indicative_price_eur: 49, is_active: false, coming_soon: true,
    created_at: '', updated_at: '',
  },
  {
    id: '3', license_type: 'commercial', display_name: 'Commercial License',
    description: 'For commercial advertising, marketing, and promotional materials.',
    rights: 'Advertising, marketing, product promotion, commercial campaigns',
    restrictions: 'No resale, no sublicensing, no broadcast without upgrade',
    indicative_price_eur: 149, is_active: false, coming_soon: true,
    created_at: '', updated_at: '',
  },
  {
    id: '4', license_type: 'extended', display_name: 'Extended Commercial License',
    description: 'For broad commercial use including print, broadcast, and merchandise.',
    rights: 'All commercial uses, print, broadcast, merchandise, product packaging',
    restrictions: 'No resale as standalone asset, no sublicensing',
    indicative_price_eur: 499, is_active: false, coming_soon: true,
    created_at: '', updated_at: '',
  },
  {
    id: '5', license_type: 'enterprise', display_name: 'Enterprise License',
    description: 'Unlimited use across all channels for large organizations.',
    rights: 'Unlimited digital and print, broadcast, merchandise, global campaigns',
    restrictions: 'No resale, no sublicensing to third parties',
    indicative_price_eur: 1499, is_active: false, coming_soon: true,
    created_at: '', updated_at: '',
  },
];

export default function LicensingCenterPage() {
  const [licenses, setLicenses] = useState<LicenseDefinition[]>(FALLBACK_LICENSES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('license_definitions').select('*').order('indicative_price_eur', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setLicenses(data as LicenseDefinition[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        {/* Hero */}
        <div className="mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-secondary bg-secondary/10 px-3 py-1.5 rounded-full mb-4">
            <Shield size={12} /> Licensing Center
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Image Licensing</h1>
          <p className="text-muted-foreground leading-relaxed">
            Professional seafood photography licensed for every use case. From editorial coverage to global commercial campaigns — choose the license that fits your project.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            <Lock size={12} />
            <span>Licensing is currently in preparation. All licenses are <strong>Coming Soon</strong>. No purchase is possible at this time.</span>
          </div>
        </div>

        {/* License cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {licenses.map((lic) => {
            const Icon = LICENSE_ICONS[lic.license_type] ?? Shield;
            const colorClass = LICENSE_COLORS[lic.license_type] ?? 'from-gray-50 to-gray-100/50 border-gray-200';
            const iconColor = LICENSE_ICON_COLORS[lic.license_type] ?? 'text-gray-600 bg-gray-100';
            return (
              <div key={lic.id} className={`bg-gradient-to-br ${colorClass} border rounded-2xl p-6 relative overflow-hidden`}>
                {lic.coming_soon && (
                  <div className="absolute top-4 right-4">
                    <span className="text-xs font-semibold bg-white/80 text-muted-foreground border border-border px-2 py-0.5 rounded-full">Coming Soon</span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconColor}`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">{lic.display_name}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{lic.description}</p>

                {lic.indicative_price_eur && (
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-foreground">€{lic.indicative_price_eur.toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground ml-1">indicative / asset</span>
                  </div>
                )}

                <div className="space-y-3 mb-5">
                  {lic.rights && (
                    <div>
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Rights Included</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{lic.rights}</p>
                    </div>
                  )}
                  {lic.restrictions && (
                    <div>
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Restrictions</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{lic.restrictions}</p>
                    </div>
                  )}
                </div>

                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl bg-white/60 text-muted-foreground border border-border cursor-not-allowed"
                >
                  <Lock size={14} />
                  Coming Soon
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ / Info section */}
        <div className="bg-card border border-border rounded-2xl p-8 mb-8">
          <div className="flex items-start gap-3 mb-6">
            <Info size={18} className="text-secondary mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold text-foreground mb-1">About Our Licensing</h2>
              <p className="text-sm text-muted-foreground">Seafood Vision is building a professional licensing infrastructure for commercial seafood photography. All licenses are currently in preparation.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { q: 'When will licensing be available?', a: 'Licensing is currently in preparation. We are certifying our asset catalog and building the commercial infrastructure. No timeline is confirmed yet.' },
              { q: 'Can I purchase images now?', a: 'No. No purchase, download, or payment is possible at this time. All licenses are marked Coming Soon.' },
              { q: 'What types of licenses will be offered?', a: 'Web, Editorial, Commercial, Extended Commercial, and Enterprise licenses — covering all use cases from digital to global campaigns.' },
              { q: 'Are prices final?', a: 'Prices shown are indicative only and subject to change. Final pricing will be confirmed at launch.' },
            ].map((item) => (
              <div key={item.q}>
                <p className="text-sm font-semibold text-foreground mb-1">{item.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 font-medium transition-colors">
            Browse the Library <ArrowRight size={14} />
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Contact us about licensing
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
