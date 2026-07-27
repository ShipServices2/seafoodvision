'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ChevronRight, Loader as Loader2, Fish, Plus, CircleAlert as AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABELS } from '@/lib/identification/types';
import type { IdentificationStatus } from '@/lib/identification/types';

interface HistoryItem {
  id: string;
  status: IdentificationStatus;
  userCategoryHint: string | null;
  userStateHint: string | null;
  userNotes: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  uploaded: 'bg-blue-50 text-blue-700 border-blue-200',
  validating: 'bg-blue-50 text-blue-700 border-blue-200',
  analyzing: 'bg-amber-50 text-amber-700 border-amber-200',
  candidates_ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  human_review_requested: 'bg-purple-50 text-purple-700 border-purple-200',
  human_review_in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  insufficient_quality: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function IdentifyHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsGuest(true);
        setLoading(false);
        return;
      }
      supabase
        .from('identification_requests')
        .select('id, status, user_category_hint, user_state_hint, user_notes, created_at')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setItems((data || []).map((r) => ({
            id: r.id,
            status: r.status as IdentificationStatus,
            userCategoryHint: r.user_category_hint,
            userStateHint: r.user_state_hint,
            userNotes: r.user_notes,
            createdAt: r.created_at,
          })));
          setLoading(false);
        });
    });
  }, []);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Identification History</h1>
            <p className="text-sm text-muted-foreground mt-1">Your past identification requests.</p>
          </div>
          <Link
            href="/identify/new"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm"
          >
            <Plus size={14} />
            New
          </Link>
        </div>

        {isGuest && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Sign in to save your history</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Anonymous requests are not saved.{' '}
                <Link href="/auth" className="underline hover:no-underline">Sign in or create an account</Link>
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Fish size={36} className="text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No identification requests yet</h2>
            <p className="text-sm text-muted-foreground mb-6">Upload a seafood photo to start your first identification.</p>
            <Link
              href="/identify/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm"
            >
              <Plus size={14} />
              Start identification
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.status === 'candidates_ready' || item.status === 'completed' ? `/identify/${item.id}/results` : `/identify/${item.id}`}
                className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 hover:bg-muted/20 transition-all duration-150 group"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Fish size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    {item.userCategoryHint && (
                      <span className="text-xs text-muted-foreground capitalize">{item.userCategoryHint}</span>
                    )}
                    {item.userStateHint && (
                      <span className="text-xs text-muted-foreground capitalize">{item.userStateHint}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={11} />
                    {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {item.userNotes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{item.userNotes}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
