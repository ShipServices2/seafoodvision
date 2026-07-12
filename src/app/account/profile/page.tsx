'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, ArrowLeft, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/supabase/queries';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/account/profile');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setCompany(profile.company || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const ok = await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        company: company.trim() || null,
        country: country.trim() || null,
      });
      if (ok) {
        setSaved(true);
        toast.success('Profile updated');
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error('Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
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
              <User size={18} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Profile</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="input-base w-full"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or organization"
                  className="input-base w-full"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                  className="input-base w-full"
                  autoComplete="country-name"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Role
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm bg-muted text-muted-foreground px-3 py-1.5 rounded-lg capitalize font-medium">
                    {profile?.role || 'member'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Role is managed by the platform administrator
                  </span>
                </div>
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
                    Save changes
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
