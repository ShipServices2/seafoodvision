import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, ShieldCheck, Download, ArrowRight } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Browse the catalog',
    description: 'Search by species, product form, scientific name, or category. Filter by media type, orientation, license type, and more.',
  },
  {
    number: '02',
    icon: ShieldCheck,
    title: 'Verify the asset',
    description: 'Each asset shows its review status, species identification, product form, and origin. Verified assets carry a quality badge.',
  },
  {
    number: '03',
    icon: Download,
    title: 'License and download',
    description: 'Choose the appropriate license for your use case. Commercial and editorial licenses available. HD downloads coming soon.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">How it works</p>
          <h1 className="text-4xl font-bold text-foreground mb-4">From search to license in three steps</h1>
          <p className="text-muted-foreground leading-relaxed">
            SeafoodVision is designed for professionals who need reliable, traceable seafood imagery fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps?.map((step) => {
            const Icon = step?.icon;
            return (
              <div key={step?.number} className="relative">
                <div className="text-6xl font-extrabold text-muted/40 font-mono-data mb-4 leading-none">
                  {step?.number}
                </div>
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-secondary" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">{step?.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{step?.description}</p>
              </div>
            );
          })}
        </div>

        {/* Content pipeline */}
        <div className="bg-card rounded-2xl border border-border p-8 mb-12">
          <h2 className="text-xl font-bold text-foreground mb-4">How content is produced</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Photography & documentation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each asset is photographed in professional conditions. Species are identified by scientific name. Product form, state, packaging, and origin are documented at the time of capture.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Review & validation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Assets go through an internal review pipeline before publication. Metadata is verified, sensitive data is removed, and only approved content reaches the public catalog.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/library" className="btn-primary">
            Start browsing
            <ArrowRight size={14} />
          </Link>
          <Link href="/licensing" className="btn-outline">View licensing terms</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
