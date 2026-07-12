import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const plans = [
  {
    id: 'explorer',
    name: 'Explorer',
    price: 'Free',
    description: 'Browse the catalog and discover verified seafood imagery.',
    features: [
      'Browse full catalog',
      'View asset metadata',
      'Save favorites',
      'Create collections',
      'Species index access',
    ],
    cta: 'Get started free',
    href: '/auth/sign-up',
    highlight: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 'Coming soon',
    description: 'For food industry professionals needing licensed imagery.',
    features: [
      'Everything in Explorer',
      'Download high-resolution assets',
      'Commercial license included',
      'Editorial license included',
      'Priority support',
    ],
    cta: 'Notify me',
    href: '/contact',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For agencies, retailers and large-scale operations.',
    features: [
      'Everything in Professional',
      'Team accounts',
      'API access',
      'Custom licensing',
      'Dedicated account manager',
    ],
    cta: 'Contact us',
    href: '/contact',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Start free. Upgrade when you need licensed downloads. No hidden fees.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
            Platform in preview — commercial plans launching soon
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans?.map((plan) => (
            <div
              key={plan?.id}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan?.highlight
                  ? 'border-secondary bg-gradient-to-b from-secondary/5 to-transparent shadow-lg'
                  : 'border-border bg-card'
              }`}
            >
              {plan?.highlight && (
                <div className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                  Most popular
                </div>
              )}
              <h2 className="text-xl font-bold text-foreground mb-1">{plan?.name}</h2>
              <div className="text-3xl font-extrabold text-foreground mb-2 font-mono-data">
                {plan?.price}
              </div>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{plan?.description}</p>
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan?.features?.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 size={14} className="text-green-verified shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan?.href}
                className={`w-full justify-center ${plan?.highlight ? 'btn-secondary' : 'btn-outline'}`}
              >
                {plan?.cta}
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All prices are exclusive of applicable taxes. Licensing terms apply.{' '}
            <Link href="/licensing" className="text-secondary hover:underline">View licensing terms</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
