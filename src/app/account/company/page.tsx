'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Save, CircleCheck as CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCompanyProfile, upsertCompanyProfile } from '@/lib/supabase/queries';
import type { CompanyProfile } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const INDUSTRY_OPTIONS = [
  'exporter', 'importer', 'processor', 'wholesaler', 'retailer',
  'restaurant', 'marketing agency', 'journalist', 'university',
  'training center', 'other',
];

const SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function CompanyProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [companyProfile, setCompanyProfile] = useState<Partial<CompanyProfile>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/account/company');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchCompanyProfile(user.id).then((data) => {
      if (data) setCompanyProfile(data);
      setFetching(false);
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const ok = await upsertCompanyProfile(user.id, companyProfile);
      if (ok) {
        setSaved(true);
        toast.success('Company profile saved');
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error('Failed to save company profile');
      }
    } catch {
      toast.error('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof CompanyProfile, value: string) => {
    setCompanyProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-xl">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft size={14} />
            Back to account
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Building2 size={18} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Company Profile</h1>
              <p className="text-sm text-muted-foreground">B2B professional profile</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyProfile.name || ''}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Company or organization name"
                  className="input-base w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <input
                  type="text"
                  value={companyProfile.country || ''}
                  onChange={(e) => update('country', e.target.value)}
                  placeholder="Country"
                  className="input-base w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Website
                </label>
                <input
                  type="url"
                  value={companyProfile.website || ''}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="input-base w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Industry / Role in the sector
                </label>
                <select
                  value={companyProfile.industry || ''}
                  onChange={(e) => update('industry', e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Company Size
                </label>
                <select
                  value={companyProfile.size_range || ''}
                  onChange={(e) => update('size_range', e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">Select size</option>
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt} employees</option>
                  ))}
                </select>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                This information prepares your account for future B2B subscriptions and enterprise features. It is not shared publicly.
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full justify-center mt-2"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving…
                  </span>
                ) : saved ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={15} />
                    Saved
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save size={15} />
                    Save company profile
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
