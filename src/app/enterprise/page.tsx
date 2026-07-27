import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowRight, CheckCircle2, Zap, Globe, Lock, BarChart2, Users, Cpu, Headphones, Database } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const enterpriseFeatures = [
  {
    icon: Database,
    title: 'API Access',
    description: 'Full REST API with JSON responses. Integrate Seafood Vision data directly into your ERP, CMS or e-commerce platform.',
  },
  {
    icon: Globe,
    title: 'Extended downloads',
    description: 'Unlimited or high-volume downloads across all formats — web, HD, Ultra HD, video and 360° views.',
  },
  {
    icon: Lock,
    title: 'Private collections',
    description: 'Create private asset collections accessible only to your team. Organise by product line, campaign or region.',
  },
  {
    icon: Users,
    title: 'Multi-user management',
    description: 'Manage multiple users with role-based access. Assign permissions per team member or department.',
  },
  {
    icon: Headphones,
    title: 'Priority support',
    description: 'Dedicated account manager, SLA-backed response times, and direct access to our technical team.',
  },
  {
    icon: BarChart2,
    title: 'Statistics & reporting',
    description: 'Download reports, usage analytics, and asset performance data for your organisation.',
  },
  {
    icon: Cpu,
    title: 'AI suite',
    description: 'Full access to Seafood Identification, Smart Search, AI Knowledge Assistant and Seafood AI Generator.',
  },
  {
    icon: Zap,
    title: 'ERP/CRM integration (future)',
    description: 'Planned integration with major ERP and CRM platforms for seamless data synchronisation.',
  },
];

const useCases = [
  {
    title: 'Seafood retailers & supermarkets',
    description: 'Enrich product listings with verified imagery and species data across thousands of SKUs.',
  },
  {
    title: 'Food industry agencies',
    description: 'Deliver high-quality seafood visuals to multiple clients from a single managed account.',
  },
  {
    title: 'Certification bodies',
    description: 'Access regulatory data, FAO zones, and certification records for compliance workflows.',
  },
  {
    title: 'Research institutions',
    description: 'Integrate species data, habitats, and nutritional information into research databases.',
  },
  {
    title: 'E-commerce platforms',
    description: 'Power product pages with real seafood photography via API — at scale.',
  },
  {
    title: 'Media & publishing',
    description: 'License editorial and commercial content for print, broadcast and digital publications.',
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">

        {/* Hero */}
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Enterprise</p>
          <h1 className="text-4xl font-bold text-foreground mb-5">
            Seafood Vision for<br className="hidden md:block" /> large-scale operations
          </h1>
          <p className="text-muted-foreground leading-relaxed text-lg mb-8">
            Custom plans for agencies, retailers, research institutions and platforms that need high-volume access, API integration and dedicated support.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors"
            >
              Contact sales
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-border text-foreground px-6 py-3 rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
            >
              View all plans
            </Link>
          </div>
        </div>

        {/* Features bento */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-foreground mb-6">Enterprise features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {enterpriseFeatures?.map((feature) => {
              const Icon = feature?.icon;
              return (
                <div key={feature?.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-secondary/30 transition-all duration-200">
                  <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center mb-3">
                    <Icon size={17} className="text-secondary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5 text-sm">{feature?.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature?.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Use cases */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-foreground mb-6">Who uses Enterprise</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCases?.map((uc) => (
              <div key={uc?.title} className="flex items-start gap-3 bg-card border border-border rounded-xl p-5">
                <CheckCircle2 size={16} className="text-green-verified shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{uc?.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{uc?.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's included */}
        <section className="mb-16 bg-primary rounded-2xl p-8 text-white">
          <h2 className="text-xl font-bold mb-6">Everything in Business, plus:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              'Unlimited downloads',
              'Dedicated account manager',
              'SLA-backed support',
              'Custom licensing agreements',
              'Multi-user & role management',
              'Private asset collections',
              'Full API access',
              'Usage statistics & reporting',
              'ERP/CRM integration (roadmap)',
              'Collaborative workspaces',
              'Custom onboarding',
              'Volume pricing',
            ]?.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-white/85">
                <CheckCircle2 size={14} className="text-secondary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Tell us about your organisation and we'll build a custom plan that fits your needs and budget.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors"
          >
            Contact our sales team
            <ArrowRight size={14} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
