'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, CheckCircle, RotateCcw, History, Award, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { WorkflowStatus, AssetWorkflow, AssetReadiness, AssetReviewComment, AssetBadge, CommentType } from '@/lib/supabase/types';
import {
  WORKFLOW_STEPS, WORKFLOW_STATUS_COLORS, BADGE_COLORS
} from '@/lib/supabase/types';

interface ReviewAsset {
  id: string;
  slug: string;
  title: string;
  review_status: string;
  is_real_photo: boolean;
  is_demo: boolean;
  created_at: string;
  species?: { common_name: string; scientific_name: string } | null;
  workflow?: AssetWorkflow | null;
  readiness?: AssetReadiness | null;
  badges?: AssetBadge[];
}

type ViewFilter = 'all' | 'today' | 'week' | 'month' | 'pending' | 'certified' | 'rejected';

const canAdvanceWorkflow = (role: string, targetStatus: WorkflowStatus): boolean => {
  if (['reviewer', 'administrator', 'super_admin'].includes(role) &&
    ['imported', 'metadata_review', 'species_validation', 'technical_review', 'rights_review', 'commercial_review'].includes(targetStatus)) return true;
  if (['administrator', 'super_admin'].includes(role) && targetStatus === 'certified') return true;
  if (role === 'super_admin' && ['published', 'commercial_license_ready'].includes(targetStatus)) return true;
  return false;
};

export default function AdminReviewsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<ReviewAsset[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [selectedAsset, setSelectedAsset] = useState<ReviewAsset | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<AssetWorkflow[]>([]);
  const [comments, setComments] = useState<AssetReviewComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('comment');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'readiness' | 'history' | 'comments'>('workflow');
  const [statusComment, setStatusComment] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkflowStatus | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/reviews');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchAssets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let query = supabase
      .from('assets')
      .select(`
        id, slug, title, review_status, is_real_photo, is_demo, created_at,
        species!fk_assets_species(common_name, scientific_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (viewFilter === 'today') query = query.gte('created_at', todayStart);
    else if (viewFilter === 'week') query = query.gte('created_at', weekStart);
    else if (viewFilter === 'month') query = query.gte('created_at', monthStart);
    else if (viewFilter === 'certified') query = query.eq('review_status', 'approved');
    else if (viewFilter === 'rejected') query = query.eq('review_status', 'rejected');
    else if (viewFilter === 'pending') query = query.in('review_status', ['under_review', 'draft', 'imported']);

    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data: assetsData } = await query;
    if (!assetsData) { setFetching(false); return; }

    const assetIds = assetsData.map((a) => a.id);

    const workflowResults = await Promise.all([
      supabase.from('asset_workflow').select('*').in('asset_id', assetIds).order('changed_at', { ascending: false }),
      supabase.from('asset_readiness').select('*').in('asset_id', assetIds),
      supabase.from('asset_badges').select('*').in('asset_id', assetIds),
    ]);
    const workflows = workflowResults[0].data;
    const readiness = workflowResults[1].data;
    const badges = workflowResults[2].data;

    const workflowMap: Record<string, AssetWorkflow> = {};
    (workflows || []).forEach((w) => {
      if (!workflowMap[w.asset_id]) workflowMap[w.asset_id] = w as AssetWorkflow;
    });
    const readinessMap: Record<string, AssetReadiness> = {};
    (readiness || []).forEach((r) => { readinessMap[r.asset_id] = r as AssetReadiness; });
    const badgesMap: Record<string, AssetBadge[]> = {};
    (badges || []).forEach((b) => {
      if (!badgesMap[b.asset_id]) badgesMap[b.asset_id] = [];
      badgesMap[b.asset_id].push(b as AssetBadge);
    });

    const enriched: ReviewAsset[] = assetsData.map((a) => ({
      ...a,
      species: Array.isArray(a.species) ? a.species[0] ?? null : a.species ?? null,
      workflow: workflowMap[a.id] ?? null,
      readiness: readinessMap[a.id] ?? null,
      badges: badgesMap[a.id] ?? [],
    }));

    setAssets(enriched);
    setFetching(false);
  }, [profile, viewFilter, search]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const openAssetPanel = async (asset: ReviewAsset) => {
    setSelectedAsset(asset);
    setActiveTab('workflow');
    const supabase = createClient();
    const panelResults = await Promise.all([
      supabase.from('asset_workflow').select('*, profiles(id, display_name, email, role)').eq('asset_id', asset.id).order('changed_at', { ascending: false }),
      supabase.from('asset_review_comments').select('*, profiles(id, display_name, email, role)').eq('asset_id', asset.id).order('created_at', { ascending: false }),
    ]);
    const hist = panelResults[0].data;
    const cmts = panelResults[1].data;
    setWorkflowHistory((hist as AssetWorkflow[]) || []);
    setComments((cmts as AssetReviewComment[]) || []);
  };

  const advanceStatus = async () => {
    if (!selectedAsset || !targetStatus || !profile) return;
    setSubmitting(true);
    const supabase = createClient();
    const currentStatus = selectedAsset.workflow?.workflow_status ?? 'imported';

    await supabase.from('asset_workflow').insert({
      asset_id: selectedAsset.id,
      workflow_status: targetStatus,
      previous_status: currentStatus,
      changed_by: user?.id,
      comment: statusComment || null,
    });

    // Also update asset_status_history
    await supabase.from('asset_status_history').insert({
      asset_id: selectedAsset.id,
      changed_by: user?.id,
      old_status: currentStatus,
      new_status: targetStatus,
      reason: statusComment || null,
    });

    setShowStatusModal(false);
    setStatusComment('');
    setTargetStatus(null);
    setSubmitting(false);
    await fetchAssets();
    // Refresh selected asset
    const updated = assets.find((a) => a.id === selectedAsset.id);
    if (updated) openAssetPanel(updated);
  };

  const rollbackStatus = async () => {
    if (!selectedAsset || !workflowHistory.length) return;
    const prev = workflowHistory[0]?.previous_status;
    if (!prev) return;
    setTargetStatus(prev);
    setShowStatusModal(true);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !selectedAsset || !user) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from('asset_review_comments').insert({
      asset_id: selectedAsset.id,
      reviewer_id: user.id,
      comment_type: commentType,
      content: newComment.trim(),
    });
    setNewComment('');
    const { data } = await supabase.from('asset_review_comments').select('*, profiles(id, display_name, email, role)').eq('asset_id', selectedAsset.id).order('created_at', { ascending: false });
    setComments((data as AssetReviewComment[]) || []);
    setSubmitting(false);
  };

  const updateReadiness = async (field: keyof AssetReadiness, value: boolean) => {
    if (!selectedAsset || !user) return;
    const supabase = createClient();
    const existing = selectedAsset.readiness;
    if (existing) {
      await supabase.from('asset_readiness').update({ [field]: value, updated_by: user.id, updated_at: new Date().toISOString() }).eq('asset_id', selectedAsset.id);
    } else {
      await supabase.from('asset_readiness').insert({ asset_id: selectedAsset.id, [field]: value, updated_by: user.id });
    }
    await fetchAssets();
  };

  const currentWorkflowStatus = selectedAsset?.workflow?.workflow_status ?? 'imported';
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.status === currentWorkflowStatus);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} /> Back to admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Asset Review Center</h1>
            <p className="text-sm text-muted-foreground">Validate, certify, and manage asset workflow</p>
          </div>
          <button onClick={fetchAssets} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* View filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'today', 'week', 'month', 'pending', 'certified', 'rejected'] as ViewFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setViewFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium capitalize transition-colors ${viewFilter === f ? 'bg-secondary text-white border-secondary' : 'bg-card text-muted-foreground border-border hover:border-secondary/40'}`}
            >
              {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assets by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-secondary/40"
          />
        </div>

        <div className="flex gap-6">
          {/* Asset list */}
          <div className={`${selectedAsset ? 'w-1/2 lg:w-2/5' : 'w-full'} transition-all`}>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assets ({assets.length})</span>
              </div>
              {fetching ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-border border-t-secondary rounded-full animate-spin" />
                </div>
              ) : assets.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No assets found.</div>
              ) : (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {assets.map((asset) => {
                    const wStatus = asset.workflow?.workflow_status ?? 'imported';
                    const pct = asset.readiness?.completion_pct ?? 0;
                    return (
                      <button
                        key={asset.id}
                        onClick={() => openAssetPanel(asset)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${selectedAsset?.id === asset.id ? 'bg-secondary/5 border-l-2 border-secondary' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
                            {asset.species && (
                              <p className="text-xs text-muted-foreground italic truncate">{asset.species.scientific_name}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${WORKFLOW_STATUS_COLORS[wStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {wStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono-data">{pct.toFixed(0)}%</span>
                        </div>
                        {(asset.badges ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(asset.badges ?? []).slice(0, 3).map((b) => (
                              <span key={b.id} className={`text-xs px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[b.badge] || 'bg-gray-100 text-gray-600'}`}>
                                {b.badge.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedAsset && (
            <div className="flex-1 min-w-0">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Panel header */}
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-foreground">{selectedAsset.title}</h2>
                      {selectedAsset.species && (
                        <p className="text-xs text-muted-foreground italic">{selectedAsset.species.scientific_name}</p>
                      )}
                    </div>
                    <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
                  </div>

                  {/* Workflow progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {WORKFLOW_STEPS.map((step, idx) => (
                        <div key={step.status} className="flex items-center gap-1 shrink-0">
                          <div className={`w-2 h-2 rounded-full ${idx <= currentStepIndex ? 'bg-secondary' : 'bg-muted'}`} />
                          {idx < WORKFLOW_STEPS.length - 1 && (
                            <div className={`w-4 h-0.5 ${idx < currentStepIndex ? 'bg-secondary' : 'bg-muted'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}: <span className="font-medium text-foreground">{WORKFLOW_STEPS[currentStepIndex]?.label}</span>
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {WORKFLOW_STEPS.map((step) => {
                      if (!canAdvanceWorkflow(profile.role, step.status)) return null;
                      if (step.status === currentWorkflowStatus) return null;
                      const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.status === step.status);
                      if (stepIdx !== currentStepIndex + 1 && stepIdx !== currentStepIndex - 1) return null;
                      const isNext = stepIdx === currentStepIndex + 1;
                      return (
                        <button
                          key={step.status}
                          onClick={() => { setTargetStatus(step.status); setShowStatusModal(true); }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isNext ? 'bg-secondary text-white hover:bg-secondary/90' : 'bg-muted text-muted-foreground hover:bg-muted/70 border border-border'}`}
                        >
                          {isNext ? <ChevronRight size={12} /> : <RotateCcw size={12} />}
                          {isNext ? `→ ${step.label}` : `← ${step.label}`}
                        </button>
                      );
                    })}
                    {workflowHistory.length > 0 && workflowHistory[0]?.previous_status && (
                      <button
                        onClick={rollbackStatus}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        <RotateCcw size={12} /> Rollback
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                  {(['workflow', 'readiness', 'history', 'comments'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 text-xs font-medium py-2.5 capitalize transition-colors ${activeTab === tab ? 'text-secondary border-b-2 border-secondary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="p-5 max-h-[400px] overflow-y-auto">
                  {/* Workflow tab */}
                  {activeTab === 'workflow' && (
                    <div className="space-y-3">
                      {WORKFLOW_STEPS.map((step, idx) => (
                        <div key={step.status} className={`flex items-start gap-3 p-3 rounded-lg border ${idx === currentStepIndex ? 'border-secondary/30 bg-secondary/5' : 'border-border bg-muted/20'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${idx < currentStepIndex ? 'bg-green-100 text-green-700' : idx === currentStepIndex ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'}`}>
                            {idx < currentStepIndex ? '✓' : idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{step.label}</p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Required: <span className="capitalize">{step.requiredRole.replace('_', ' ')}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Readiness tab */}
                  {activeTab === 'readiness' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-2xl font-bold text-foreground font-mono-data">{(selectedAsset.readiness?.completion_pct ?? 0).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">Commercial Readiness</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{(selectedAsset.readiness?.commercial_score ?? 0).toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">Commercial Score</p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full mb-5">
                        <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${selectedAsset.readiness?.completion_pct ?? 0}%` }} />
                      </div>
                      <div className="space-y-2">
                        {([
                          ['metadata_completed', 'Metadata'],
                          ['species_validated', 'Species'],
                          ['technical_quality', 'Technical Quality'],
                          ['rights_verified', 'Rights Verified'],
                          ['packaging_completed', 'Packaging'],
                          ['keywords_completed', 'Keywords'],
                          ['preview_available', 'Preview'],
                          ['thumbnail_available', 'Thumbnail'],
                          ['original_available', 'Original Archived'],
                          ['license_ready', 'License Ready'],
                          ['publication_ready', 'Publication Ready'],
                        ] as [keyof AssetReadiness, string][]).map(([field, label]) => {
                          const checked = selectedAsset.readiness?.[field] as boolean ?? false;
                          return (
                            <label key={field} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => updateReadiness(field, e.target.checked)}
                                className="w-4 h-4 accent-secondary"
                              />
                              <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                              {checked && <CheckCircle size={14} className="text-green-500 ml-auto" />}
                            </label>
                          );
                        })}
                      </div>
                      {(selectedAsset.readiness?.completion_pct ?? 0) === 100 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                          <Award size={16} className="text-green-600" />
                          <span className="text-sm font-semibold text-green-700">Certified Asset — All criteria met</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* History tab */}
                  {activeTab === 'history' && (
                    <div className="space-y-3">
                      {workflowHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No workflow history yet.</p>
                      ) : workflowHistory.map((h) => (
                        <div key={h.id} className="flex gap-3 p-3 bg-muted/20 rounded-lg border border-border">
                          <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {h.previous_status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${WORKFLOW_STATUS_COLORS[h.previous_status] || ''}`}>{h.previous_status.replace(/_/g, ' ')}</span>
                              )}
                              {h.previous_status && <ChevronRight size={10} className="text-muted-foreground" />}
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${WORKFLOW_STATUS_COLORS[h.workflow_status] || ''}`}>{h.workflow_status.replace(/_/g, ' ')}</span>
                            </div>
                            {h.comment && <p className="text-xs text-muted-foreground mt-1">{h.comment}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              {h.profiles?.display_name ?? 'Unknown'} · {new Date(h.changed_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comments tab */}
                  {activeTab === 'comments' && (
                    <div>
                      <div className="space-y-3 mb-4">
                        {comments.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                        ) : comments.map((c) => (
                          <div key={c.id} className="p-3 bg-muted/20 rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${c.comment_type === 'correction' ? 'bg-red-100 text-red-700' : c.comment_type === 'suggestion' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                {c.comment_type}
                              </span>
                              <span className="text-xs text-muted-foreground">{c.profiles?.display_name ?? 'Reviewer'}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-foreground">{c.content}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border pt-3">
                        <div className="flex gap-2 mb-2">
                          {(['comment', 'suggestion', 'correction'] as CommentType[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setCommentType(t)}
                              className={`text-xs px-2 py-1 rounded capitalize transition-colors ${commentType === t ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write a comment..."
                          rows={3}
                          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-secondary/40 resize-none"
                        />
                        <button
                          onClick={submitComment}
                          disabled={!newComment.trim() || submitting}
                          className="mt-2 text-xs bg-secondary text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 hover:bg-secondary/90 transition-colors"
                        >
                          {submitting ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Status change modal */}
      {showStatusModal && targetStatus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-foreground mb-1">Change Workflow Status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Moving to: <span className={`px-2 py-0.5 rounded text-xs font-medium border ${WORKFLOW_STATUS_COLORS[targetStatus]}`}>{targetStatus.replace(/_/g, ' ')}</span>
            </p>
            <textarea
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              rows={3}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-secondary/40 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowStatusModal(false); setTargetStatus(null); setStatusComment(''); }}
                className="flex-1 text-sm border border-border rounded-lg py-2 text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={advanceStatus}
                disabled={submitting}
                className="flex-1 text-sm bg-secondary text-white rounded-lg py-2 font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
