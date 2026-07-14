'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, XCircle, ArrowRight, Zap, BarChart2, HelpCircle, GitCompare, CreditCard, Package } from 'lucide-react';
import { SUBSCRIPTION_PLANS, UNIT_PRODUCTS, CREDIT_PACKS, annualSavings, type BillingCycle,  } from '@/lib/pricingConfig';

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">

        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Professional seafood content,<br className="hidden md:block" /> at every scale
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            From free browsing to enterprise API access. All plans include verified, real-photograph assets — no AI-generated content.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-muted rounded-xl p-1 mb-2">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                billing === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2 ${
                billing === 'annual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Save ~17%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            const savings = annualSavings(plan);
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border flex flex-col p-5 transition-all duration-200 ${
                  plan.highlight
                    ? 'border-secondary bg-gradient-to-b from-secondary/8 to-card shadow-lg ring-1 ring-secondary/20 scale-[1.02]'
                    : 'border-border bg-card hover:border-secondary/40 hover:shadow-md'
                }`}
              >
                {plan.badge && (
                  <div className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                    {plan.badge}
                  </div>
                )}
                <h2 className="text-lg font-bold text-foreground mb-0.5">{plan.name}</h2>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.tagline}</p>

                <div className="mb-5">
                  {price === null ? (
                    <div className="text-2xl font-extrabold text-foreground font-mono-data">On quote</div>
                  ) : price === 0 ? (
                    <div className="text-2xl font-extrabold text-foreground font-mono-data">Free</div>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-extrabold text-foreground font-mono-data">{price}€</span>
                        <span className="text-xs text-muted-foreground mb-1">/{billing === 'annual' ? 'year' : 'month'}</span>
                      </div>
                      {billing === 'annual' && savings && savings > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">Save {savings}€/year</p>
                      )}
                    </>
                  )}
                </div>

                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-xs text-foreground">
                      {f.included ? (
                        <CheckCircle2 size={13} className="text-green-verified shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={13} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={f.included ? '' : 'text-muted-foreground/60'}>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={`w-full text-center text-sm font-semibold py-2.5 px-4 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    plan.highlight
                      ? 'bg-secondary text-white hover:bg-secondary/90'
                      : plan.id === 'enterprise' ?'bg-primary text-white hover:bg-ocean-800' :'border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {plan.ctaLabel}
                  <ArrowRight size={13} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          <Link href="/pricing/compare" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <GitCompare size={14} />
            Compare all plans
          </Link>
          <Link href="/pricing/faq" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <HelpCircle size={14} />
            Pricing FAQ
          </Link>
          <Link href="/licensing" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <BarChart2 size={14} />
            License types
          </Link>
          <Link href="/enterprise" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <Zap size={14} />
            Enterprise solutions
          </Link>
        </div>

        {/* Unit sales */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard size={18} className="text-secondary" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Pay per asset</h2>
              <p className="text-sm text-muted-foreground">No subscription required — buy exactly what you need</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {UNIT_PRODUCTS.map((product) => (
              <div key={product.id} className="bg-card border border-border rounded-xl p-4 text-center hover:border-secondary/40 hover:shadow-sm transition-all duration-150">
                <div className="text-xl font-extrabold text-foreground font-mono-data mb-1">{product.price}€</div>
                <div className="text-sm font-semibold text-foreground mb-1">{product.name}</div>
                <div className="text-xs text-muted-foreground leading-tight">{product.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Credit packs */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Package size={18} className="text-secondary" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Credit packs</h2>
              <p className="text-sm text-muted-foreground">Use credits for downloads, AI features and advanced searches</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`bg-card border rounded-xl p-5 relative hover:shadow-md transition-all duration-150 ${
                  pack.popular ? 'border-secondary ring-1 ring-secondary/20' : 'border-border hover:border-secondary/40'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs bg-secondary text-white px-3 py-0.5 rounded-full font-semibold">
                    Best value
                  </div>
                )}
                <div className="text-3xl font-extrabold text-foreground font-mono-data mb-1">{pack.credits}</div>
                <div className="text-sm text-muted-foreground mb-3">credits</div>
                <div className="text-xl font-bold text-foreground mb-1">{pack.price}€</div>
                <div className="text-xs text-muted-foreground">{(pack.pricePerCredit * 100).toFixed(1)}¢ per credit</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Credits can be used for downloads (1–15 credits), AI identification (2 credits), smart search (1 credit) and AI generation (5 credits).
          </p>
        </section>

        {/* Footer note */}
        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            All prices are exclusive of applicable taxes. Licensing terms apply.{' '}
            <Link href="/licensing" className="text-secondary hover:underline">View licensing terms</Link>
            {' · '}
            <Link href="/pricing/faq" className="text-secondary hover:underline">FAQ</Link>
            {' · '}
            <Link href="/contact" className="text-secondary hover:underline">Contact</Link>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Platform in preview — commercial plans launching soon. Prices subject to change before launch.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
