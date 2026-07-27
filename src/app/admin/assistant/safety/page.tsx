'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ChevronLeft, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { INJECTION_PATTERNS } from '@/lib/assistant/types';

export default function AdminAssistantSafetyPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router?.replace('/auth?next=/admin/assistant/safety');
    if (!loading && profile && !['administrator', 'super_admin']?.includes(profile?.role)) router?.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  const protections = [
    { label: 'Injection pattern detection', status: 'active', desc: `${INJECTION_PATTERNS?.length} patterns monitored` },
    { label: 'Private data filter', status: 'active', desc: 'GPS, emails, phone numbers, API keys excluded from context' },
    { label: 'Confidential document filter', status: 'active', desc: 'Only public, verified data sent to any model' },
    { label: 'Role bypass prevention', status: 'active', desc: 'Users cannot escalate their own role via the assistant' },
    { label: 'SQL injection prevention', status: 'active', desc: 'Model cannot generate or execute SQL queries' },
    { label: 'Source fabrication prevention', status: 'active', desc: 'Only real Seafood Vision sources are cited' },
    { label: 'Certification invention prevention', status: 'active', desc: 'No certification is confirmed without verified data' },
    { label: 'Rate limiting', status: 'active', desc: 'Guest: 5/day · Member: 50/day' },
    { label: 'Server-side model calls only', status: 'active', desc: 'No model API calls from browser — keys never exposed' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Shield size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Safety & Security</h1>
              <p className="text-xs text-muted-foreground">Active protections for the AI Knowledge Assistant</p>
            </div>
          </div>

          <div className="space-y-3">
            {protections?.map((p) => (
              <div key={p?.label} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle size={15} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{p?.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p?.desc}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium shrink-0">
                  {p?.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Injection attempts are blocked silently. The assistant returns a refusal message without revealing internal instructions. Monitor the unanswered questions log for patterns.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
