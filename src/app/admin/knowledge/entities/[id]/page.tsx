'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChevronRight, Database, GitBranch, FileText, Clock, ArrowLeft, Network } from 'lucide-react';

interface Entity {
  id: string;
  entity_type: string;
  label: string;
  slug: string;
  description: string | null;
  status: string | null;
  is_demo: boolean | null;
  is_public: boolean | null;
  canonical_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Relation {
  id: string;
  relation_type: string;
  status: string | null;
  confidence_score: number | null;
  from_entity_id: string;
  to_entity_id: string;
}

interface Claim {
  id: string;
  claim_text: string;
  claim_status: string;
  confidence_score: number | null;
  predicate: string | null;
  value_text: string | null;
  status: string | null;
  created_at: string;
}

interface Version {
  id: string;
  version_number: number;
  change_type: string | null;
  change_reason: string | null;
  changed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  suggested: 'bg-blue-100 text-blue-700',
  unverified: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  disputed: 'bg-purple-100 text-purple-700',
  obsolete: 'bg-slate-100 text-slate-500',
  proposed: 'bg-blue-100 text-blue-700',
  deprecated: 'bg-slate-100 text-slate-400',
};

export default function EntityDetailPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const entityId = params?.id as string;

  const [entity, setEntity] = useState<Entity | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'relations' | 'claims' | 'versions'>('overview');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !entityId) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('knowledge_entities').select('*').eq('id', entityId).single(),
      supabase.from('knowledge_relations').select('*').or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`).limit(50),
      supabase.from('knowledge_claims').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50),
      supabase.from('knowledge_versions').select('*').eq('entity_id', entityId).order('version_number', { ascending: false }).limit(20),
    ]).then(([ent, rels, clms, vers]) => {
      setEntity(ent.data);
      setRelations(rels.data ?? []);
      setClaims(clms.data ?? []);
      setVersions(vers.data ?? []);
      setFetching(false);
    });
  }, [profile, entityId]);

  if (loading || fetching) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!entity) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Entity not found</p></div>;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Database },
    { id: 'relations', label: `Relations (${relations.length})`, icon: GitBranch },
    { id: 'claims', label: `Claims (${claims.length})`, icon: FileText },
    { id: 'versions', label: `Versions (${versions.length})`, icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge/entities" className="hover:text-teal-600">Entities</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium truncate max-w-48">{entity.label}</span>
        </div>

        {/* Entity header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{entity.label}</h1>
                {entity.canonical_name && entity.canonical_name !== entity.label && (
                  <p className="text-sm text-slate-500">Canonical: {entity.canonical_name}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{entity.entity_type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entity.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>{entity.status ?? 'draft'}</span>
                  {entity.is_demo && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">demo</span>}
                  {entity.is_public && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">public</span>}
                </div>
              </div>
            </div>
            <Link href={`/admin/knowledge/entities/${entity.id}/graph`} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              <Network className="w-4 h-4" /> Graph View
            </Link>
          </div>
          {entity.description && (
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">{entity.description}</p>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-xs text-slate-400">
            <span>ID: <span className="font-mono">{entity.id}</span></span>
            <span>Slug: <span className="font-mono">{entity.slug}</span></span>
            <span>Created: {new Date(entity.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${activeTab === tab.id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Entity Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Entity Type', value: entity.entity_type },
                { label: 'Status', value: entity.status ?? 'draft' },
                { label: 'Slug', value: entity.slug },
                { label: 'Is Demo', value: entity.is_demo ? 'Yes' : 'No' },
                { label: 'Is Public', value: entity.is_public ? 'Yes' : 'No' },
                { label: 'Updated', value: new Date(entity.updated_at).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                  <dt className="text-xs text-slate-500 mb-1">{item.label}</dt>
                  <dd className="text-sm font-medium text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {activeTab === 'relations' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {relations.length === 0 ? (
              <div className="p-12 text-center">
                <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No relations found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Direction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Relation Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.from_entity_id === entity.id ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                          {r.from_entity_id === entity.id ? '→ outgoing' : '← incoming'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.relation_type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status ?? 'suggested'] ?? 'bg-slate-100 text-slate-600'}`}>{r.status ?? 'suggested'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.confidence_score != null ? `${Math.round((r.confidence_score ?? 0) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'claims' && (
          <div className="space-y-3">
            {claims.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No claims found</p>
              </div>
            ) : claims.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-700 flex-1">{c.claim_text}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[c.claim_status] ?? 'bg-slate-100 text-slate-600'}`}>{c.claim_status}</span>
                </div>
                {c.predicate && (
                  <div className="mt-2 flex gap-3 text-xs text-slate-500">
                    <span>Predicate: <span className="font-mono">{c.predicate}</span></span>
                    {c.value_text && <span>Value: {c.value_text}</span>}
                  </div>
                )}
                <div className="mt-2 flex gap-3 text-xs text-slate-400">
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  {c.confidence_score != null && <span>Confidence: {Math.round((c.confidence_score ?? 0) * 100)}%</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {versions.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No version history</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Version</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Change Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">v{v.version_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{v.change_type ?? 'updated'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{v.change_reason ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(v.changed_at ?? v.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="mt-6">
          <Link href="/admin/knowledge/entities" className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600">
            <ArrowLeft className="w-4 h-4" /> Back to Entities
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
