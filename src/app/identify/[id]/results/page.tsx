'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertCircle, Loader2, CheckCircle, ThumbsUp, ThumbsDown,
  HelpCircle, Users, ExternalLink, Fish, Eye, Info, Zap
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  CONFIDENCE_LABELS, CONFIDENCE_COLORS, STATUS_LABELS
} from '@/lib/identification/types';
import type { IdentificationStatus, ConfidenceLevel } from '@/lib/identification/types';
import Icon from '@/components/ui/AppIcon';


interface CandidateRow {
  id: string;
  request_id: string;
  species_id: string | null;
  candidate_type: string;
  rank: number;
  confidence_level: string;
  confidence_score: number | null;
  match_reasons: { code: string; label: string; detail?: string }[];
  source_type: string;
  model_name: string | null;
  status: string;
  species?: {
    id: string;
    slug: string;
    common_name: string;
    scientific_name: string;
    family: string | null;
    category: string | null;
    description: string | null;
  } | null;
}

interface RequestRow {
  id: string;
  status: string;
  user_category_hint: string | null;
  user_state_hint: string | null;
  user_notes: string | null;
}

export default function IdentifyResultsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    Promise.all([
      supabase.from('identification_requests').select('id, status, user_category_hint, user_state_hint, user_notes').eq('id', id).maybeSingle(),
      supabase.from('identification_candidates').select('*, species:species_id(id, slug, common_name, scientific_name, family, category, description)').eq('request_id', id).order('rank'),
    ]).then(([reqRes, candRes]) => {
      if (reqRes.error || !reqRes.data) {
        setError('Request not found or access denied.');
      } else {
        setRequest(reqRes.data as RequestRow);
        setCandidates((candRes.data || []) as CandidateRow[]);
      }
      setLoading(false);
    });
  }, [id]);

  const sendFeedback = async (feedbackType: string, candidateId?: string) => {
    setSendingFeedback(true);
    try {
      const res = await fetch('/api/identification/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, feedbackType, candidateId }),
      });
      if (res.ok) {
        setFeedbackSent(feedbackType);
        if (feedbackType === 'request_expert_review') {
          setRequest(prev => prev ? { ...prev, status: 'human_review_requested' } : prev);
        }
      }
    } finally {
      setSendingFeedback(false);
    }
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
          <h1 className="text-xl font-semibold text-foreground mb-2">Results not found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/identify/history" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl text-sm">
            My history
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[request.status as IdentificationStatus] || request.status;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href={`/identify/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={14} />
          Request details
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Identification Candidates</h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{statusLabel}</span>
          </p>
        </div>

        {/* Disclaimer banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            These are <strong>identification candidates</strong> — not confirmed identifications. Human verification is recommended for professional use.
          </p>
        </div>

        {/* Visual AI notice — dynamic based on source */}
        {candidates.length > 0 && candidates[0]?.source_type === 'openai_vision' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Eye size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Analysed by OpenAI Vision (GPT-4o)</strong> — candidates are based on real visual analysis of your photo.
              {candidates.some(c => (c.confidence_score ?? 0) < 40) && (
                <span className="block mt-1 text-blue-700">Some candidates have low confidence — identification is probable, not confirmed.</span>
              )}
            </p>
          </div>
        ) : (
          <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6 flex items-start gap-3">
            <Eye size={16} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Candidates based on metadata hints.</strong> Visual AI analysis was not available for this request.
            </p>
          </div>
        )}

        {/* Candidates */}
        {candidates.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Fish size={32} className="text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No candidates found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Seafood Vision could not find matching candidates based on the provided information.
              Try adding more details or request expert review.
            </p>
            <button
              onClick={() => sendFeedback('request_expert_review')}
              disabled={sendingFeedback || !!feedbackSent}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-ocean-800 transition-all duration-150 text-sm disabled:opacity-50"
            >
              <Users size={14} />
              Request expert review
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {candidates.map((candidate, idx) => (
              <div key={candidate.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {candidate.species?.common_name || 'Unknown species'}
                      </h3>
                      {candidate.species?.scientific_name && (
                        <p className="text-xs text-muted-foreground italic">{candidate.species.scientific_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CONFIDENCE_COLORS[candidate.confidence_level as ConfidenceLevel] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {CONFIDENCE_LABELS[candidate.confidence_level as ConfidenceLevel] || candidate.confidence_level}
                    </span>
                    {candidate.confidence_score != null && (
                      <span className="text-xs text-muted-foreground font-mono">{candidate.confidence_score}%</span>
                    )}
                  </div>
                </div>

                {candidate.species?.category && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Category: <span className="text-foreground">{candidate.species.category}</span>
                    {candidate.species.family && <> · Family: <span className="text-foreground">{candidate.species.family}</span></>}
                  </p>
                )}

                {/* Match reasons */}
                {candidate.match_reasons?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Why this candidate:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.match_reasons.map((reason) => (
                        <span key={reason.code} className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} className="text-emerald-500" />
                          {reason.label}
                          {reason.detail && <span className="text-muted-foreground/70">: {reason.detail}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source note */}
                <p className="text-xs text-muted-foreground mb-3">
                  Source:{' '}
                  <span className="text-foreground">
                    {candidate.source_type === 'openai_vision'
                      ? `OpenAI Vision${candidate.model_name ? ` (${candidate.model_name})` : ''}`
                      : candidate.source_type === 'structured_search' ?'Seafood Vision structured search' :'User metadata hints'}
                  </span>
                </p>

                {/* Links */}
                {candidate.species?.slug && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/species/${candidate.species.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      target="_blank"
                    >
                      <ExternalLink size={11} />
                      View species fact sheet
                    </Link>
                    <Link
                      href={`/hub/${candidate.species.slug}?from=identify&identify_id=${id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-secondary/10 text-secondary hover:bg-secondary hover:text-white px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Zap size={11} />
                      Open Intelligence Hub
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Feedback section */}
        {!feedbackSent ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info size={14} className="text-muted-foreground" />
              Your feedback
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Do these candidates look right to you?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'looks_correct', icon: ThumbsUp, label: 'Looks correct', color: 'hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700' },
                { type: 'incorrect', icon: ThumbsDown, label: 'Incorrect', color: 'hover:bg-red-50 hover:border-red-300 hover:text-red-700' },
                { type: 'not_sure', icon: HelpCircle, label: 'Not sure', color: 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700' },
                { type: 'request_expert_review', icon: Users, label: 'Request expert', color: 'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700' },
              ].map(({ type, icon: Icon, label, color }) => (
                <button
                  key={type}
                  onClick={() => sendFeedback(type)}
                  disabled={sendingFeedback}
                  className={`flex flex-col items-center gap-1.5 p-3 border border-border rounded-xl text-xs font-medium text-muted-foreground transition-all duration-150 disabled:opacity-50 ${color}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                {feedbackSent === 'request_expert_review' ?'Expert review requested. A reviewer will be assigned shortly.' :'Thank you for your feedback. It helps improve Seafood Vision.'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link href="/identify/new" className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-muted transition-all duration-150 text-sm">
            New identification
          </Link>
          <Link href="/identify/history" className="inline-flex items-center gap-2 text-muted-foreground font-medium px-5 py-2.5 rounded-xl hover:bg-muted transition-all duration-150 text-sm">
            My history
          </Link>
        </div>
      </div>
    </div>
  );
}
