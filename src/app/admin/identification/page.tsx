'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Microscope, ClipboardList, Eye, ChartBar as BarChart2, Settings, MessageSquare, ChevronRight, Loader as Loader2, TrendingUp, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface Stats {
  total: number;
  pending: number;
  candidatesReady: number;
  reviewRequested: number;
  completed: number;
}

export default function AdminIdentificationPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, candidatesReady: 0, reviewRequested: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('identification_requests')
      .select('status', { count: 'exact' })
      .then(({ data }) => {
        const rows = data || [];
        setStats({
          total: rows.length,
          pending: rows.filter((r) => ['uploaded', 'validating', 'analyzing'].includes(r.status)).length,
          candidatesReady: rows.filter((r) => r.status === 'candidates_ready').length,
          reviewRequested: rows.filter((r) => ['human_review_requested', 'human_review_in_progress'].includes(r.status)).length,
          completed: rows.filter((r) => r.status === 'completed').length,
        });
        setLoading(false);
      });
  }, []);

  const adminLinks = [
    { href: '/admin/identification/requests', icon: ClipboardList, label: 'All Requests', desc: 'View and manage all identification requests' },
    { href: '/admin/identification/review', icon: Eye, label: 'Review Queue', desc: 'Process requests awaiting human review', badge: stats.reviewRequested > 0 ? stats.reviewRequested : undefined },
    { href: '/admin/identification/species-candidates', icon: Microscope, label: 'Species Candidates', desc: 'Manage candidate results and confidence levels' },
    { href: '/admin/identification/feedback', icon: MessageSquare, label: 'Feedback', desc: 'View user feedback on identification results' },
    { href: '/admin/identification/analytics', icon: BarChart2, label: 'Analytics', desc: 'Usage statistics and identification metrics' },
    { href: '/admin/identification/settings', icon: Settings, label: 'Settings', desc: 'Configure quotas, retention, and engine settings' },
  ];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/admin" className="hover:text-foreground">Admin</Link>
            <ChevronRight size={12} />
            <span>Identification</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Microscope size={22} className="text-ocean-600" />
            Seafood Identification
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Phase 6.1 — Manage identification requests, review queue, and engine settings.</p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total requests', value: stats.total, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
              { label: 'Pending analysis', value: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Candidates ready', value: stats.candidatesReady, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Awaiting review', value: stats.reviewRequested, icon: AlertCircle, color: 'text-purple-600 bg-purple-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Icon size={16} />
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminLinks.map(({ href, icon: Icon, label, desc, badge }) => (
            <Link
              key={href}
              href={href}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:bg-muted/20 transition-all duration-150 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-ocean-50 flex items-center justify-center">
                  <Icon size={18} className="text-ocean-600" />
                </div>
                {badge !== undefined && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200">
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{label}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>

        {/* Phase info */}
        <div className="mt-8 bg-muted/40 border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-muted-foreground" />
            Phase 6.1 — Foundation status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-muted-foreground">Level A: Metadata hints</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-muted-foreground">Level B: Structured search</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              <span className="text-muted-foreground">Level C: Visual AI (not yet enabled)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
