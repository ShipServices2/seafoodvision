'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CircleAlert as AlertCircle, Loader as Loader2, Trash2, Users, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABELS } from '@/lib/identification/types';
import type { IdentificationStatus } from '@/lib/identification/types';

interface RequestDetail {
  id: string;
  status: IdentificationStatus;
  qualityStatus: string;
  qualityFlags: { code: string; severity: string; message: string }[];
  userCategoryHint: string | null;
  userStateHint: string | null;
  userContextHint: string | null;
  userCountryHint: string | null;
  userNotes: string | null;
  locale: string;
  consentForRetention: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export default function IdentifyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from('identification_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Request not found or access denied.');
        } else {
          setRequest({
            id: data.id,
            status: data.status as IdentificationStatus,
            qualityStatus: data.quality_status || 'pending',
            qualityFlags: data.quality_flags || [],
            userCategoryHint: data.user_category_hint,
            userStateHint: data.user_state_hint,
            userContextHint: data.user_context_hint,
            userCountryHint: data.user_country_hint,
            userNotes: data.user_notes,
            locale: data.locale || 'en',
            consentForRetention: data.consent_for_retention || false,
            createdAt: data.created_at,
            updatedAt: data.updated_at || data.created_at,
            completedAt: data.completed_at,
          });
        }
        setLoading(false);
      });
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this identification request? This cannot be undone.')) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('identification_requests').update({ status: 'cancelled' }).eq('id', id);
    router.push('/identify/history');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle size={40} className="text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Request not found</h1>
          <p className="text-muted-foreground mb-6">{error || 'This identification request does not exist or you do not have access.'}</p>
          <Link href="/identify/history" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm">
            View my history
          </Link>
        </div>
      </div>
    );
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
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/identify/history" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={14} />
          My history
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Identification Request</h1>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{request.id}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusColors[request.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {STATUS_LABELS[request.status] || request.status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          {(request.status === 'candidates_ready' || request.status === 'completed') && (
            <Link
              href={`/identify/${id}/results`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm"
            >
              View candidates
              <ChevronRight size={14} />
            </Link>
          )}
          {request.status === 'uploaded' && (
            <Link
              href={`/identify/${id}/results`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm"
            >
              View results
              <ChevronRight size={14} />
            </Link>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 border border-border text-muted-foreground font-medium px-4 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all duration-150 text-sm"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              Timeline
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{new Date(request.createdAt).toLocaleString()}</span>
              </div>
              {request.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-foreground">{new Date(request.completedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {(request.userCategoryHint || request.userStateHint || request.userContextHint || request.userCountryHint || request.userNotes) && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Your hints</h2>
              <div className="space-y-2 text-sm">
                {request.userCategoryHint && <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="text-foreground">{request.userCategoryHint}</span></div>}
                {request.userStateHint && <div className="flex justify-between"><span className="text-muted-foreground">State</span><span className="text-foreground">{request.userStateHint}</span></div>}
                {request.userContextHint && <div className="flex justify-between"><span className="text-muted-foreground">Context</span><span className="text-foreground">{request.userContextHint}</span></div>}
                {request.userCountryHint && <div className="flex justify-between"><span className="text-muted-foreground">Country (photo)</span><span className="text-foreground">{request.userCountryHint}</span></div>}
                {request.userNotes && <div><span className="text-muted-foreground">Notes</span><p className="text-foreground mt-1">{request.userNotes}</p></div>}
              </div>
            </div>
          )}

          {request.qualityFlags.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <AlertCircle size={14} />
                Quality notices
              </h2>
              <div className="space-y-2">
                {request.qualityFlags.map((flag) => (
                  <p key={flag.code} className="text-sm text-amber-800">{flag.message}</p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" />
              Human review
            </h2>
            {request.status === 'human_review_requested' || request.status === 'human_review_in_progress' ? (
              <p className="text-sm text-muted-foreground">Your request for expert review has been submitted and is in the queue.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can request expert review from the{' '}
                <Link href={`/identify/${id}/results`} className="text-primary hover:underline">results page</Link>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
