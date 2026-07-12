'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABELS } from '@/lib/identification/types';
import type { IdentificationStatus } from '@/lib/identification/types';

interface RequestRow {
  id: string;
  status: IdentificationStatus;
  user_id: string | null;
  user_category_hint: string | null;
  user_state_hint: string | null;
  locale: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  uploaded: 'bg-blue-50 text-blue-700 border-blue-200',
  analyzing: 'bg-amber-50 text-amber-700 border-amber-200',
  candidates_ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  human_review_requested: 'bg-purple-50 text-purple-700 border-purple-200',
  human_review_in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  insufficient_quality: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function AdminIdentificationRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let query = supabase
      .from('identification_requests')
      .select('id, status, user_id, user_category_hint, user_state_hint, locale, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    query.then(({ data }) => {
      setRequests((data || []) as RequestRow[]);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Requests</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">All Identification Requests</h1>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No requests found.</div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{req.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[req.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize hidden sm:table-cell">{req.user_category_hint || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{req.user_id ? req.user_id.slice(0, 8) + '…' : 'Anonymous'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/identify/${req.id}`} className="text-primary hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
