'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, Star, BarChart2, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface ReviewerStats {
  assetsToday: number;
  speciesValidated: number;
  technicalReviews: number;
  rightsReviews: number;
  commercialReviews: number;
  totalReviewed: number;
  avgReadiness: number;
  loading: boolean;
}

interface QCStats {
  avgResolution: string;
  avgTechnicalScore: number;
  avgCommercialScore: number;
  rejectedAssets: number;
  pendingAssets: number;
  certifiedAssets: number;
  totalAssets: number;
  loading: boolean;
}

interface CommercialCandidate {
  id: string;
  title: string;
  completion_pct: number;
  commercial_score: number;
  technical_score: number;
  workflow_status: string;
}

type CandidateView = 'top100' | 'top500' | 'top_technical' | 'top_commercial' | 'needs_review' | 'low_quality';

export default function ReviewerDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [reviewerStats, setReviewerStats] = useState<ReviewerStats>({
    assetsToday: 0, speciesValidated: 0, technicalReviews: 0, rightsReviews: 0,
    commercialReviews: 0, totalReviewed: 0, avgReadiness: 0, loading: true,
  });
  const [qcStats, setQcStats] = useState<QCStats>({
    avgResolution: '—', avgTechnicalScore: 0, avgCommercialScore: 0,
    rejectedAssets: 0, pendingAssets: 0, certifiedAssets: 0, totalAssets: 0, loading: true,
  });
  const [candidates, setCandidates] = useState<CommercialCandidate[]>([]);
  const [candidateView, setCandidateView] = useState<CandidateView>('top100');
  const [activeSection, setActiveSection] = useState<'reviewer' | 'qc' | 'candidates' | 'reports'>('reviewer');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/reviewer-dashboard');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).gte('changed_at', todayStart.toISOString()),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).eq('workflow_status', 'species_validation'),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).eq('workflow_status', 'technical_review'),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).eq('workflow_status', 'rights_review'),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).eq('workflow_status', 'commercial_review'),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }),
      supabase.from('asset_readiness').select('completion_pct'),
    ]).then(([today, species, tech, rights, commercial, total, readiness]) => {
      const pcts = (readiness.data ?? []).map((r) => r.completion_pct ?? 0);
      const avg = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      setReviewerStats({
        assetsToday: today.count ?? 0,
        speciesValidated: species.count ?? 0,
        technicalReviews: tech.count ?? 0,
        rightsReviews: rights.count ?? 0,
        commercialReviews: commercial.count ?? 0,
        totalReviewed: total.count ?? 0,
        avgReadiness: Math.round(avg),
        loading: false,
      });
    });

    Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'rejected'),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'under_review'),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'approved'),
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('asset_readiness').select('technical_score, commercial_score'),
    ]).then(([rejected, pending, certified, total, scores]) => {
      const scoreData = scores.data ?? [];
      const avgTech = scoreData.length > 0 ? scoreData.reduce((a, b) => a + (b.technical_score ?? 0), 0) / scoreData.length : 0;
      const avgComm = scoreData.length > 0 ? scoreData.reduce((a, b) => a + (b.commercial_score ?? 0), 0) / scoreData.length : 0;
      setQcStats({
        avgResolution: '—',
        avgTechnicalScore: Math.round(avgTech),
        avgCommercialScore: Math.round(avgComm),
        rejectedAssets: rejected.count ?? 0,
        pendingAssets: pending.count ?? 0,
        certifiedAssets: certified.count ?? 0,
        totalAssets: total.count ?? 0,
        loading: false,
      });
    });
  }, [profile]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();

    let query = supabase.from('asset_readiness').select(`
      asset_id, completion_pct, commercial_score, technical_score,
      assets!inner(id, title)
    `);

    if (candidateView === 'top100' || candidateView === 'top500') {
      query = query.order('completion_pct', { ascending: false }).limit(candidateView === 'top100' ? 100 : 500);
    } else if (candidateView === 'top_technical') {
      query = query.order('technical_score', { ascending: false }).limit(50);
    } else if (candidateView === 'top_commercial') {
      query = query.order('commercial_score', { ascending: false }).limit(50);
    } else if (candidateView === 'needs_review') {
      query = query.gte('completion_pct', 30).lt('completion_pct', 70).order('completion_pct', { ascending: false }).limit(50);
    } else if (candidateView === 'low_quality') {
      query = query.lt('completion_pct', 30).order('completion_pct', { ascending: true }).limit(50);
    }

    query.then(({ data }) => {
      const mapped: CommercialCandidate[] = (data ?? []).map((r: any) => ({
        id: r.asset_id,
        title: r.assets?.title ?? 'Unknown',
        completion_pct: r.completion_pct ?? 0,
        commercial_score: r.commercial_score ?? 0,
        technical_score: r.technical_score ?? 0,
        workflow_status: '',
      }));
      setCandidates(mapped);
    });
  }, [profile, candidateView]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const reportTypes = [
    { label: 'Daily Review', desc: 'Assets reviewed today, status changes, comments', period: 'Today' },
    { label: 'Weekly Review', desc: 'Weekly summary of all review activity', period: 'This Week' },
    { label: 'Monthly Review', desc: 'Monthly certification and quality metrics', period: 'This Month' },
    { label: 'Commercial Readiness', desc: 'Top commercial candidates and readiness scores', period: 'All Time' },
    { label: 'Certification Report', desc: 'Certified assets, badges granted, workflow completion', period: 'All Time' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} /> Back to admin
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Review & Quality Dashboards</h1>
          <p className="text-sm text-muted-foreground">Reviewer performance, quality control, commercial candidates, and reports</p>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-8 w-fit">
          {(['reviewer', 'qc', 'candidates', 'reports'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`text-sm font-medium px-4 py-2 rounded-lg capitalize transition-colors ${activeSection === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'qc' ? 'Quality Control' : s === 'candidates' ? 'Commercial Candidates' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Reviewer Dashboard */}
        {activeSection === 'reviewer' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Reviewer Dashboard</h2>
            {reviewerStats.loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                    <div className="h-7 bg-muted rounded w-16 mb-2" />
                    <div className="h-3 bg-muted rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Assets Today', value: reviewerStats.assetsToday, icon: Clock, color: 'text-blue-600' },
                  { label: 'Species Validated', value: reviewerStats.speciesValidated, icon: CheckCircle, color: 'text-cyan-600' },
                  { label: 'Technical Reviews', value: reviewerStats.technicalReviews, icon: Star, color: 'text-violet-600' },
                  { label: 'Rights Reviews', value: reviewerStats.rightsReviews, icon: Award, color: 'text-orange-600' },
                  { label: 'Commercial Reviews', value: reviewerStats.commercialReviews, icon: TrendingUp, color: 'text-amber-600' },
                  { label: 'Total Reviewed', value: reviewerStats.totalReviewed, icon: BarChart2, color: 'text-secondary' },
                  { label: 'Avg Readiness', value: `${reviewerStats.avgReadiness}%`, icon: CheckCircle, color: 'text-green-600' },
                  { label: 'Avg Review Time', value: '—', icon: Clock, color: 'text-muted-foreground' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={14} className={stat.color} />
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                      <p className={`text-2xl font-bold font-mono-data ${stat.color}`}>{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quality Control Dashboard */}
        {activeSection === 'qc' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Quality Control Dashboard</h2>
            {qcStats.loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                    <div className="h-7 bg-muted rounded w-16 mb-2" />
                    <div className="h-3 bg-muted rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Avg Resolution', value: qcStats.avgResolution, color: 'text-foreground' },
                  { label: 'Avg Technical Score', value: qcStats.avgTechnicalScore, color: 'text-violet-600' },
                  { label: 'Avg Commercial Score', value: qcStats.avgCommercialScore, color: 'text-amber-600' },
                  { label: 'Rejected Assets', value: qcStats.rejectedAssets, color: 'text-red-600' },
                  { label: 'Pending Assets', value: qcStats.pendingAssets, color: 'text-blue-600' },
                  { label: 'Certified Assets', value: qcStats.certifiedAssets, color: 'text-green-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                    <p className={`text-2xl font-bold font-mono-data ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Final Report */}
            <div className="mt-8 bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Final Report</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Imported', value: qcStats.totalAssets },
                  { label: 'Certified', value: qcStats.certifiedAssets },
                  { label: 'Pending', value: qcStats.pendingAssets },
                  { label: 'Rejected', value: qcStats.rejectedAssets },
                  { label: 'Avg Quality', value: `${qcStats.avgTechnicalScore}%` },
                  { label: 'Avg Validation Time', value: '—' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground font-mono-data">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">Issues detected: No assets have been fully certified yet. Begin the certification workflow in the Asset Review Center.</p>
              </div>
            </div>
          </div>
        )}

        {/* Commercial Candidates */}
        {activeSection === 'candidates' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Commercial Candidates</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {([
                { key: 'top100', label: 'Top 100' },
                { key: 'top500', label: 'Top 500' },
                { key: 'top_technical', label: 'Top Technical' },
                { key: 'top_commercial', label: 'Top Commercial' },
                { key: 'needs_review', label: 'Needs Review' },
                { key: 'low_quality', label: 'Low Quality' },
              ] as { key: CandidateView; label: string }[]).map((v) => (
                <button
                  key={v.key}
                  onClick={() => setCandidateView(v.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${candidateView === v.key ? 'bg-secondary text-white border-secondary' : 'bg-card text-muted-foreground border-border hover:border-secondary/40'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asset</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Readiness</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Commercial</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Technical</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No assets found for this view. Complete the readiness checklist for assets first.
                      </td>
                    </tr>
                  ) : candidates.map((c, idx) => (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono-data">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/asset-detail?slug=${c.id}`} className="font-medium text-foreground hover:text-secondary transition-colors text-sm truncate block max-w-[200px]">
                          {c.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${c.completion_pct}%` }} />
                          </div>
                          <span className="text-xs font-mono-data text-muted-foreground">{c.completion_pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs font-mono-data text-amber-600">{c.commercial_score.toFixed(0)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono-data text-violet-600">{c.technical_score.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports */}
        {activeSection === 'reports' && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTypes.map((report) => (
                <div key={report.label} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground text-sm">{report.label}</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{report.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{report.desc}</p>
                  <button
                    disabled
                    className="w-full text-xs border border-border rounded-lg py-2 text-muted-foreground cursor-not-allowed bg-muted/20"
                  >
                    Generate Report — Coming Soon
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
