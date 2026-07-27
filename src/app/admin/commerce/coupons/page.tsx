'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Tag, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  name: string;
  coupon_type: string;
  discount_amount: number | null;
  discount_pct: number | null;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  status: string;
}

interface Promotion {
  id: string;
  name: string;
  slug: string;
  promotion_type: string;
  discount_pct: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export default function AdminCouponsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<'coupons' | 'promotions'>('coupons');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', coupon_type: 'percentage', discount_pct: '', valid_until: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/coupons');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
    ]).then(([cRes, pRes]) => {
      setCoupons((cRes.data as Coupon[]) ?? []);
      setPromotions((pRes.data as Promotion[]) ?? []);
      setFetching(false);
    });
  }, [user]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase().trim(),
      name: form.name,
      coupon_type: form.coupon_type,
      discount_pct: form.coupon_type === 'percentage' ? parseFloat(form.discount_pct) : null,
      valid_until: form.valid_until || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
    setShowForm(false);
    setForm({ code: '', name: '', coupon_type: 'percentage', discount_pct: '', valid_until: '' });
    setSaving(false);
  };

  const toggleCoupon = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from('coupons').update({ is_active: !current, status: !current ? 'active' : 'inactive' }).eq('id', id);
    setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current, status: !current ? 'active' : 'inactive' } : c));
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/admin" className="hover:text-foreground">Admin</Link>
            <span>/</span>
            <Link href="/admin/commerce" className="hover:text-foreground">Commerce</Link>
            <span>/</span>
            <span>Coupons & Promotions</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Coupons & Promotions</h1>
                <p className="text-sm text-muted-foreground">Discount codes and campaigns</p>
              </div>
            </div>
            {tab === 'coupons' && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Coupon
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit mb-6">
          {(['coupons', 'promotions'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Create coupon form */}
        {showForm && tab === 'coupons' && (
          <form onSubmit={handleCreateCoupon} className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-foreground mb-4">New Coupon</h3>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Code *</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="SUMMER20" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono uppercase" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Summer 20% off" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
                <select value={form.coupon_type} onChange={(e) => setForm({ ...form, coupon_type: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {form.coupon_type === 'percentage' ? 'Discount %' : 'Discount amount (€)'}
                </label>
                <input required type="number" min="0" max={form.coupon_type === 'percentage' ? '100' : undefined}
                  value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Valid until</label>
                <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Coupon'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : tab === 'coupons' ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Discount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Uses</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Expires</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No coupons yet</td></tr>
                ) : coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{c.code}</td>
                    <td className="px-4 py-3 text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.coupon_type === 'percentage' ? `${c.discount_pct}%` : `${c.discount_amount} ${c.currency}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        c.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-border'
                      }`}>
                        {c.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleCoupon(c.id, c.is_active)}
                        className="text-xs text-secondary hover:underline">
                        {c.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Discount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Valid until</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {promotions.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No promotions yet</td></tr>
                ) : promotions.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.promotion_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.discount_pct ? `${p.discount_pct}%` : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        p.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-border'
                      }`}>
                        {p.is_active ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
