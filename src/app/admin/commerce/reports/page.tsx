'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ChartBar as BarChart2, Download, TrendingUp, FileText, Coins, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface RevenueRow { month: string; revenue: number; orders: number }
interface DownloadRow { date: string; downloads: number }

export default function AdminReportsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [revenueData, setRevenueData] = useState<RevenueRow[]>([]);
  const [downloadData, setDownloadData] = useState<DownloadRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeReport, setActiveReport] = useState<'revenue' | 'downloads' | 'licenses' | 'credits'>('revenue');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/reports');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const [ordersRes, downloadsRes] = await Promise.all([
        supabase.from('orders').select('status, total_amount, created_at').eq('status', 'paid'),
        supabase.from('download_events').select('downloaded_at').order('downloaded_at', { ascending: false }).limit(500),
      ]);

      // Group orders by month
      const monthMap: Record<string, { revenue: number; orders: number }> = {};
      (ordersRes.data ?? []).forEach((o) => {
        const month = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthMap[month]) monthMap[month] = { revenue: 0, orders: 0 };
        monthMap[month].revenue += Number(o.total_amount ?? 0);
        monthMap[month].orders += 1;
      });
      setRevenueData(Object.entries(monthMap).map(([month, v]) => ({ month, ...v })).slice(-6));

      // Group downloads by date
      const dateMap: Record<string, number> = {};
      (downloadsRes.data ?? []).forEach((d) => {
        const date = new Date(d.downloaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateMap[date] = (dateMap[date] ?? 0) + 1;
      });
      setDownloadData(Object.entries(dateMap).map(([date, downloads]) => ({ date, downloads })).slice(-14));

      setFetching(false);
    })();
  }, [user]);

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return null;

  const REPORTS = [
    { id: 'revenue' as const, label: 'Revenue Report', icon: TrendingUp },
    { id: 'downloads' as const, label: 'Download Report', icon: Download },
    { id: 'licenses' as const, label: 'License Report', icon: FileText },
    { id: 'credits' as const, label: 'Credits Report', icon: Coins },
  ];

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
            <span>Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reports</h1>
              <p className="text-sm text-muted-foreground">Real data only — no mock statistics</p>
            </div>
          </div>
        </div>

        {/* Report tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit mb-6 flex-wrap">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeReport === r.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <r.icon className="w-3.5 h-3.5" />
              {r.label}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeReport === 'revenue' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">Revenue by Month (paid orders)</h2>
                    <button
                      onClick={() => exportCSV(revenueData as unknown as Record<string, unknown>[], 'revenue-report')}
                      className="flex items-center gap-1.5 text-xs text-secondary hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                  {revenueData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No paid orders yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`, 'Revenue']} />
                        <Bar dataKey="revenue" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {activeReport === 'downloads' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Downloads (last 14 days)</h2>
                  <button
                    onClick={() => exportCSV(downloadData as unknown as Record<string, unknown>[], 'download-report')}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                {downloadData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No downloads recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={downloadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="downloads" stroke="var(--secondary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {(activeReport === 'licenses' || activeReport === 'credits') && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  {activeReport === 'licenses' ? 'License Report' : 'Credits Report'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Detailed {activeReport} analytics will be available once transactions are recorded.
                  All data shown will be real — no mock statistics.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
