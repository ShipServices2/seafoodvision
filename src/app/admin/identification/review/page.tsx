'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader as Loader2, Users, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ReviewRow {
  id: string;
  request_id: string;
  review_status: string;
  confidence_level: string | null;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const reviewStatusColors: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-700 border-amber-200',
  queued: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewing: 'bg-purple-50 text-purple-700 border-purple-200',
  clarification_needed: 'bg-orange-50 text-orange-700 border-orange-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unable_to_identify: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function AdminIdentificationReviewPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('identification_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setReviews((data || []) as ReviewRow[]);
        setLoading(false);
      });
  }, []);

  const updateReviewStatus = async (reviewId: string, newStatus: string) => {
    const supabase = createClient();
    await supabase
      .from('identification_reviews')
      .update({ review_status: newStatus, reviewed_at: newStatus === 'completed' ? new Date().toISOString() : null })
      .eq('id', reviewId);
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, review_status: newStatus } : r));
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Review Queue</span>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-ocean-600" />
            Human Review Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Identification requests awaiting expert review.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-foreground font-medium">Review queue is empty</p>
            <p className="text-sm text-muted-foreground mt-1">No pending reviews at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Request: <span className="font-mono text-xs">{review.request_id.slice(0, 12)}…</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">Submitted: {new Date(review.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${reviewStatusColors[review.review_status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {review.review_status.replace(/_/g, ' ')}
                  </span>
                </div>

                {review.notes && (
                  <p className="text-sm text-muted-foreground mb-3 bg-muted/40 rounded-lg p-2">{review.notes}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/identify/${review.request_id}/results`}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Eye size={12} />
                    View request
                  </Link>
                  {review.review_status === 'requested' && (
                    <button
                      onClick={() => updateReviewStatus(review.id, 'assigned')}
                      className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-ocean-800 transition-colors"
                    >
                      Assign to me
                    </button>
                  )}
                  {review.review_status === 'assigned' && (
                    <button
                      onClick={() => updateReviewStatus(review.id, 'reviewing')}
                      className="inline-flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Start reviewing
                    </button>
                  )}
                  {review.review_status === 'reviewing' && (
                    <>
                      <button
                        onClick={() => updateReviewStatus(review.id, 'completed')}
                        className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle size={11} />
                        Mark completed
                      </button>
                      <button
                        onClick={() => updateReviewStatus(review.id, 'unable_to_identify')}
                        className="inline-flex items-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <AlertCircle size={11} />
                        Unable to identify
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
