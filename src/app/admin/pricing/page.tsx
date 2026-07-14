'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { Settings, DollarSign, CreditCard, Package, Shield, Save, RotateCcw, CheckCircle2,  } from 'lucide-react';
import { SUBSCRIPTION_PLANS, UNIT_PRODUCTS, CREDIT_PACKS, LICENSE_TYPES, type SubscriptionPlan, type UnitProduct, type CreditPack, type LicenseType,  } from '@/lib/pricingConfig';
import Icon from '@/components/ui/AppIcon';


// ─── Local editable state types ──────────────────────────────

interface EditablePlan {
  id: string;
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  downloads: number | null;
}

interface EditableUnit {
  id: string;
  name: string;
  price: number;
}

interface EditableCreditPack {
  id: string;
  credits: number;
  price: number;
}

interface EditableLicense {
  id: string;
  name: string;
  price: number | null;
  description: string;
}

type Section = 'plans' | 'units' | 'credits' | 'licenses';

export default function AdminPricingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<Section>('plans');
  const [saved, setSaved] = useState(false);

  // Editable state (initialized from config)
  const [plans, setPlans] = useState<EditablePlan[]>(
    SUBSCRIPTION_PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyPrice: p.monthlyPrice,
      annualPrice: p.annualPrice,
      downloads: p.downloads,
    }))
  );

  const [units, setUnits] = useState<EditableUnit[]>(
    UNIT_PRODUCTS.map((u) => ({ id: u.id, name: u.name, price: u.price }))
  );

  const [credits, setCredits] = useState<EditableCreditPack[]>(
    CREDIT_PACKS.map((c) => ({ id: c.id, credits: c.credits, price: c.price }))
  );

  const [licenses, setLicenses] = useState<EditableLicense[]>(
    LICENSE_TYPES.map((l) => ({ id: l.id, name: l.name, price: l.price, description: l.description }))
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/admin/pricing');
      return;
    }
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const handleSave = () => {
    // In production, this would persist to Supabase or a config store.
    // For now, it shows a success indicator.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setPlans(SUBSCRIPTION_PLANS.map((p) => ({
      id: p.id, name: p.name, monthlyPrice: p.monthlyPrice,
      annualPrice: p.annualPrice, downloads: p.downloads,
    })));
    setUnits(UNIT_PRODUCTS.map((u) => ({ id: u.id, name: u.name, price: u.price })));
    setCredits(CREDIT_PACKS.map((c) => ({ id: c.id, credits: c.credits, price: c.price })));
    setLicenses(LICENSE_TYPES.map((l) => ({ id: l.id, name: l.name, price: l.price, description: l.description })));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'plans', label: 'Subscription Plans', icon: DollarSign },
    { id: 'units', label: 'Unit Sales', icon: CreditCard },
    { id: 'credits', label: 'Credit Packs', icon: Package },
    { id: 'licenses', label: 'License Types', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
              <span>/</span>
              <span>Pricing</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings size={22} className="text-secondary" />
              Pricing Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage subscription plans, unit prices, credit packs and license types.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 transition-colors"
            >
              {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
          <strong>Note:</strong> This panel displays current pricing configuration from <code className="font-mono-data text-xs bg-amber-100 px-1 py-0.5 rounded">src/lib/pricingConfig.ts</code>. 
          In production, changes will be persisted to the database. Stripe integration will be connected in a future phase.
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeSection === s.id
                    ? 'bg-primary text-white' :'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Subscription Plans ── */}
        {activeSection === 'plans' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Plans</h2>
            {plans.map((plan, idx) => (
              <div key={plan.id} className="bg-card border border-border rounded-xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Plan</label>
                    <div className="font-semibold text-foreground">{plan.name}</div>
                    <div className="text-xs text-muted-foreground font-mono-data">{plan.id}</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Monthly price (€)</label>
                    <input
                      type="number"
                      min={0}
                      value={plan.monthlyPrice ?? ''}
                      placeholder="On quote"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setPlans((prev) => prev.map((p, i) => i === idx ? { ...p, monthlyPrice: val } : p));
                      }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Annual price (€)</label>
                    <input
                      type="number"
                      min={0}
                      value={plan.annualPrice ?? ''}
                      placeholder="On quote"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setPlans((prev) => prev.map((p, i) => i === idx ? { ...p, annualPrice: val } : p));
                      }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Downloads / month</label>
                    <input
                      type="number"
                      min={0}
                      value={plan.downloads ?? ''}
                      placeholder="Unlimited"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setPlans((prev) => prev.map((p, i) => i === idx ? { ...p, downloads: val } : p));
                      }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Unit Sales ── */}
        {activeSection === 'units' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Unit Sales Prices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((unit, idx) => (
                <div key={unit.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="font-semibold text-foreground mb-0.5">{unit.name}</div>
                  <div className="text-xs text-muted-foreground font-mono-data mb-3">{unit.id}</div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Price (€)</label>
                  <input
                    type="number"
                    min={0}
                    value={unit.price}
                    onChange={(e) => {
                      setUnits((prev) => prev.map((u, i) => i === idx ? { ...u, price: Number(e.target.value) } : u));
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Credit Packs ── */}
        {activeSection === 'credits' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Credit Packs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {credits.map((pack, idx) => (
                <div key={pack.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="text-2xl font-extrabold text-foreground font-mono-data mb-0.5">{pack.credits}</div>
                  <div className="text-xs text-muted-foreground mb-3">credits</div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Price (€)</label>
                  <input
                    type="number"
                    min={0}
                    value={pack.price}
                    onChange={(e) => {
                      setCredits((prev) => prev.map((c, i) => i === idx ? { ...c, price: Number(e.target.value) } : c));
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                  />
                  <div className="text-xs text-muted-foreground mt-2">
                    {pack.price > 0 ? `${((pack.price / pack.credits) * 100).toFixed(1)}¢ / credit` : '—'}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Credit usage costs (read-only)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
                {[
                  { label: 'Download Web', cost: 1 },
                  { label: 'Download HD', cost: 4 },
                  { label: 'Download Ultra HD', cost: 8 },
                  { label: 'Download Video', cost: 15 },
                  { label: 'Download 360°', cost: 10 },
                  { label: 'AI Identification', cost: 2 },
                  { label: 'Smart Search', cost: 1 },
                  { label: 'AI Generation', cost: 5 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between bg-card border border-border rounded-lg px-3 py-2">
                    <span>{item.label}</span>
                    <span className="font-semibold text-foreground font-mono-data">{item.cost} cr.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Licenses ── */}
        {activeSection === 'licenses' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">License Types</h2>
            {licenses.map((license, idx) => (
              <div key={license.id} className="bg-card border border-border rounded-xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">License</label>
                    <div className="font-semibold text-foreground">{license.name}</div>
                    <div className="text-xs text-muted-foreground font-mono-data">{license.id}</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Price per asset (€)</label>
                    <input
                      type="number"
                      min={0}
                      value={license.price ?? ''}
                      placeholder="Included / negotiated"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setLicenses((prev) => prev.map((l, i) => i === idx ? { ...l, price: val } : l));
                      }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={license.description}
                      onChange={(e) => {
                        setLicenses((prev) => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l));
                      }}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stripe readiness note */}
        <div className="mt-12 bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <CreditCard size={16} className="text-secondary" />
            Stripe Integration — Ready for connection
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            The pricing architecture is Stripe-ready. Each plan and product has a <code className="font-mono-data text-xs bg-muted px-1 py-0.5 rounded">stripePriceId</code> field in <code className="font-mono-data text-xs bg-muted px-1 py-0.5 rounded">pricingConfig.ts</code> awaiting connection.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {['Monthly subscriptions', 'Annual subscriptions', 'One-time purchases', 'Credit packs'].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 size={12} className="text-green-verified" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
