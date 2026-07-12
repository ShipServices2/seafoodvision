'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, BarChart2, Loader2, TrendingUp, Fish, Users, MessageSquare, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface AnalyticsData {
  totalRequests: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  totalCandidates: number;
  totalFeedback: number;
  totalReviews: number;
  reviewsByStatus: Record<string, number>;
}

export default function AdminIdentificationAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('identification_requests').select('status, user_category_hint'),
      supabase.from('identification_candidates').select('id', { count: 'exact', head: true }),
      supabase.from('identification_feedback').select('id', { count: 'exact', head: true }),
      supabase.from('identification_reviews').select('review_status'),
    ]).then(([reqRes, candRes, feedRes, revRes]) => {
      const requests = reqRes.data || [];
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};

      requests.forEach((r) => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        const cat = r.user_category_hint || 'unknown';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      const reviews = revRes.data || [];
      const reviewsByStatus: Record<string, number> = {};
      reviews.forEach((r) => {
        reviewsByStatus[r.review_status] = (reviewsByStatus[r.review_status] || 0) + 1;
      });

      setData({
        totalRequests: requests.length,
        byStatus,
        byCategory,
        totalCandidates: candRes.count || 0,
        totalFeedback: feedRes.count || 0,
        totalReviews: reviews.length,
        reviewsByStatus,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Analytics</span>
        </div>

        <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          <BarChart2 size={18} className="text-ocean-600" />
          Identification Analytics
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total requests', value: data.totalRequests, icon: Fish, color: 'text-blue-600 bg-blue-50' },
                { label: 'Total candidates', value: data.totalCandidates, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'User feedback', value: data.totalFeedback, icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
                { label: 'Expert reviews', value: data.totalReviews, icon: Users, color: 'text-purple-600 bg-purple-50' },
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

            {/* By status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Requests by status</h2>
                <div className="space-y-2">
                  {Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.round((count / data.totalRequests) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Requests by category</h2>
                <div className="space-y-2">
                  {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ocean-500 rounded-full"
                            style={{ width: `${Math.round((count / data.totalRequests) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Review status */}
            {data.totalReviews > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Reviews by status</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.reviewsByStatus).map(([status, count]) => (
                    <div key={status} className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-sm">
                      <span className="text-muted-foreground capitalize">{status.replace(/_/g, ' ')}</span>
                      <span className="ml-2 font-bold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual AI notice */}
            <div className="bg-muted/40 border border-border rounded-2xl p-4 flex items-start gap-3">
              <Eye size={16} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Visual AI metrics:</strong> Not available — Level C (Visual AI) is not yet enabled in Phase 6.1.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
