'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link2, ChevronRight, Fish, ShoppingBag, Package, Globe, Award, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface Asset {
  id: string;
  title: string;
  slug: string;
  species_id: string | null;
  product_form: string | null;
  review_status: string;
}

interface Species { id: string; common_name: string; }
interface Product { id: string; public_name: string; slug: string; }
interface Market { id: string; name: string; slug: string; }
interface Certification { id: string; name: string; slug: string; }
interface PackagingConfig { id: string; name: string; }

interface LinkProposal {
  type: 'species' | 'product' | 'market' | 'certification' | 'packaging';
  entityId: string;
  entityName: string;
  confidence: number;
  source: string;
  status: 'pending' | 'proposed';
}

export default function MediaLinkingContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = searchParams?.get('asset');

  const [asset, setAsset] = useState<Asset | null>(null);
  const [species, setSpecies] = useState<Species[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [packagingConfigs, setPackagingConfigs] = useState<PackagingConfig[]>([]);
  const [proposals, setProposals] = useState<LinkProposal[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedCert, setSelectedCert] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [confidence, setConfidence] = useState(0.5);
  const [sourceNote, setSourceNote] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/link-media'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchData = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    const [assetRes, speciesRes, productsRes, marketsRes, certsRes, pkgRes] = await Promise.all([
      assetId ? supabase.from('assets').select('id, title, slug, species_id, product_form, review_status').eq('id', assetId).single() : Promise.resolve({ data: null }),
      supabase.from('species').select('id, common_name').order('common_name').limit(100),
      supabase.from('commercial_products').select('id, public_name, slug').order('public_name').limit(100),
      supabase.from('markets').select('id, name, slug').order('name').limit(50),
      supabase.from('certifications').select('id, name, slug').order('name').limit(50),
      supabase.from('packaging_configurations').select('id, name').order('name').limit(50),
    ]);
    setAsset(assetRes.data);
    setSpecies(speciesRes.data ?? []);
    setProducts(productsRes.data ?? []);
    setMarkets(marketsRes.data ?? []);
    setCertifications(certsRes.data ?? []);
    setPackagingConfigs(pkgRes.data ?? []);
    setFetching(false);
  }, [profile, assetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addProposal = (type: LinkProposal['type'], entityId: string, entityName: string) => {
    if (!entityId) return;
    if (proposals.find((p) => p.type === type && p.entityId === entityId)) return;
    setProposals((prev) => [...prev, { type, entityId, entityName, confidence, source: sourceNote || 'internal_experience', status: 'pending' }]);
  };

  const removeProposal = (type: string, entityId: string) => {
    setProposals((prev) => prev.filter((p) => !(p.type === type && p.entityId === entityId)));
  };

  const saveProposals = async () => {
    if (!asset || proposals.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    for (const p of proposals.filter((x) => x.status === 'pending')) {
      if (p.type === 'species') {
        await supabase.from('asset_species').upsert({ asset_id: asset.id, species_id: p.entityId }, { onConflict: 'asset_id,species_id' });
      } else if (p.type === 'product') {
        await supabase.from('asset_products').insert({ asset_id: asset.id, product_id: p.entityId, confidence_score: p.confidence, status: 'suggested', notes: p.source });
      } else if (p.type === 'market') {
        await supabase.from('asset_markets').insert({ asset_id: asset.id, market_id: p.entityId, confidence_score: p.confidence, status: 'suggested', notes: p.source });
      } else if (p.type === 'certification') {
        await supabase.from('asset_certification_observations').insert({ asset_id: asset.id, certification_id: p.entityId, confidence_score: p.confidence, status: 'suggested', notes: p.source });
      } else if (p.type === 'packaging') {
        await supabase.from('asset_packaging').insert({ asset_id: asset.id, packaging_config_id: p.entityId, confidence_score: p.confidence, status: 'suggested', notes: p.source });
      }
    }
    setProposals((prev) => prev.map((p) => ({ ...p, status: 'proposed' as const })));
    setSavedMsg(`${proposals.filter((x) => x.status === 'pending').length} proposal(s) saved as "suggested" — awaiting human validation`);
    setSaving(false);
  };

  if (loading || fetching) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  type LinkTypeOption = { id: string; [key: string]: string };

  const LINK_TYPES: Array<{
    type: LinkProposal['type'];
    label: string;
    icon: React.ElementType;
    options: LinkTypeOption[];
    nameKey: string;
    selected: string;
    setSelected: (v: string) => void;
  }> = [
    { type: 'species', label: 'Species', icon: Fish, options: species as unknown as LinkTypeOption[], nameKey: 'common_name', selected: selectedSpecies, setSelected: setSelectedSpecies },
    { type: 'product', label: 'Product', icon: ShoppingBag, options: products as unknown as LinkTypeOption[], nameKey: 'public_name', selected: selectedProduct, setSelected: setSelectedProduct },
    { type: 'market', label: 'Market', icon: Globe, options: markets as unknown as LinkTypeOption[], nameKey: 'name', selected: selectedMarket, setSelected: setSelectedMarket },
    { type: 'certification', label: 'Certification', icon: Award, options: certifications as unknown as LinkTypeOption[], nameKey: 'name', selected: selectedCert, setSelected: setSelectedCert },
    { type: 'packaging', label: 'Packaging', icon: Package, options: packagingConfigs as unknown as LinkTypeOption[], nameKey: 'name', selected: selectedPkg, setSelected: setSelectedPkg },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Media Linking Assistant</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Media Linking Assistant</h1>
            <p className="text-xs text-slate-500">Propose links from a media asset to knowledge entities — nothing is validated automatically</p>
          </div>
        </div>

        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">A photograph is visual evidence only. It cannot prove origin, certification, market, or weight without additional documentation. All proposals remain &quot;suggested&quot; until human validation.</p>
        </div>

        {asset ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400 text-lg">🖼</div>
            <div className="flex-1">
              <div className="font-semibold text-slate-800 text-sm">{asset.title}</div>
              <div className="text-xs text-slate-400 font-mono">{asset.id.slice(0, 16)}…</div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{asset.review_status}</span>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700">No asset selected. Use <span className="font-mono">?asset=UUID</span> to link a specific media asset.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Proposal Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Confidence Score: {Math.round(confidence * 100)}%</label>
              <input type="range" min="0.1" max="1" step="0.1" value={confidence} onChange={(e) => setConfidence(parseFloat(e.target.value))} className="w-full accent-teal-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>Low (10%)</span><span>High (100%)</span></div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Source / Justification</label>
              <input type="text" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="e.g. visible on media, folder name..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-700 placeholder-slate-400" />
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {LINK_TYPES.map(({ type, label, icon: Icon, options, nameKey, selected, setSelected }) => (
            <div key={type} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <label className="text-sm font-medium text-slate-700 w-28 flex-shrink-0">{label}</label>
                <select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-700">
                  <option value="">— Select {label} —</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o[nameKey]}</option>)}
                </select>
                <button
                  onClick={() => { const opt = options.find((o) => o.id === selected); if (opt) addProposal(type, opt.id, opt[nameKey]); }}
                  disabled={!selected}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  Propose
                </button>
              </div>
            </div>
          ))}
        </div>

        {proposals.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Pending Proposals ({proposals.length})</h3>
            <div className="space-y-2">
              {proposals.map((p) => (
                <div key={`${p.type}-${p.entityId}`} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {p.status === 'proposed' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                    <span className="text-xs font-medium text-slate-600 capitalize">{p.type}</span>
                    <span className="text-xs text-slate-800">{p.entityName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{Math.round(p.confidence * 100)}%</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.status === 'proposed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.status}</span>
                    {p.status === 'pending' && (
                      <button onClick={() => removeProposal(p.type, p.entityId)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {savedMsg && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700">{savedMsg}</p>
              </div>
            )}
            {proposals.some((p) => p.status === 'pending') && (
              <button onClick={saveProposals} disabled={saving || !asset} className="mt-3 w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving proposals…' : `Save ${proposals.filter((p) => p.status === 'pending').length} proposal(s) as "suggested"`}
              </button>
            )}
          </div>
        )}

        <div className="mt-4">
          <Link href="/admin/knowledge" className="text-sm text-slate-500 hover:text-teal-600 flex items-center gap-1">
            ← Back to Knowledge Dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
