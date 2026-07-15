'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Brain, CheckSquare, Square, AlertTriangle, ChevronDown, X, Loader2, Zap, Eye, Database, Cpu, CheckCircle2, Search, Filter, SlidersHorizontal, RefreshCw, Upload, Fish, Clock, Hash, Globe, Star } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  public_asset_id: string | null;
  title: string | null;
  file_name: string | null;
  category: string | null;
  thumbnail_url: string | null;
  review_status: string | null;
  species_id: string | null;
  created_at: string | null;
  import_batch_id: string | null;
  is_demo: boolean | null;
  // joined
  species_common_name?: string | null;
  species_scientific_name?: string | null;
  // metadata completeness flags (computed)
  has_scientific_name?: boolean;
  has_common_name?: boolean;
  has_keywords?: boolean;
  has_description?: boolean;
  // confidence from sie_jobs
  confidence?: number | null;
  // review status from metadata_review
  metadata_review_status?: string | null;
}

interface FilterState {
  reviewStatus: string;
  metadataFilter: string;
  category: string;
  importBatch: string;
  textSearch: string;
  pilot: boolean;
  review100: boolean;
  review500: boolean;
}

type BatchSize = 1 | 50 | 100 | 500 | 'all';

const PIPELINE_STEPS = [
  { key: 'analyse', label: 'Analyse Vision', icon: Eye },
  { key: 'species', label: 'Recherche espèces', icon: Fish },
  { key: 'taxonomy', label: 'Recherche taxonomique', icon: Database },
  { key: 'commercial', label: 'Recherche commerciale', icon: Globe },
  { key: 'metadata', label: 'Construction métadonnées', icon: Cpu },
  { key: 'candidates', label: 'Top 5 candidats', icon: Star },
  { key: 'done', label: 'Terminé', icon: CheckCircle2 },
];

const BATCH_OPTIONS: { label: string; value: BatchSize }[] = [
  { label: '1 photo', value: 1 },
  { label: '50 photos', value: 50 },
  { label: '100 photos', value: 100 },
  { label: '500 photos', value: 500 },
  { label: 'Tout le résultat filtré', value: 'all' },
];

const REVIEW_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'approved', label: 'Approved' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'draft', label: 'Unknown / Draft' },
  { value: 'imported', label: 'Imported' },
  { value: 'rejected', label: 'Rejected' },
];

const METADATA_FILTER_OPTIONS = [
  { value: '', label: 'Tous les actifs' },
  { value: 'without_species', label: 'Without Species' },
  { value: 'without_metadata', label: 'Without Metadata' },
  { value: 'without_scientific_name', label: 'Without Scientific Name' },
  { value: 'without_common_name', label: 'Without Common Name' },
  { value: 'without_keywords', label: 'Without Keywords' },
  { value: 'without_description', label: 'Without Description' },
];

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  under_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  imported: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  preview_only: 'bg-teal-100 text-teal-700',
  commercial: 'bg-indigo-100 text-indigo-700',
  editorial: 'bg-purple-100 text-purple-700',
};

// ─── Mock Engine ──────────────────────────────────────────────────────────────

const MOCK_SPECIES_POOL = [
  { commonName: 'Atlantic Salmon', scientificName: 'Salmo salar', family: 'Salmonidae', genus: 'Salmo' },
  { commonName: 'Rainbow Trout', scientificName: 'Oncorhynchus mykiss', family: 'Salmonidae', genus: 'Oncorhynchus' },
  { commonName: 'Atlantic Cod', scientificName: 'Gadus morhua', family: 'Gadidae', genus: 'Gadus' },
  { commonName: 'European Sea Bass', scientificName: 'Dicentrarchus labrax', family: 'Moronidae', genus: 'Dicentrarchus' },
  { commonName: 'Gilthead Sea Bream', scientificName: 'Sparus aurata', family: 'Sparidae', genus: 'Sparus' },
  { commonName: 'Yellowfin Tuna', scientificName: 'Thunnus albacares', family: 'Scombridae', genus: 'Thunnus' },
  { commonName: 'Bluefin Tuna', scientificName: 'Thunnus thynnus', family: 'Scombridae', genus: 'Thunnus' },
  { commonName: 'Swordfish', scientificName: 'Xiphias gladius', family: 'Xiphiidae', genus: 'Xiphias' },
  { commonName: 'Mahi-Mahi', scientificName: 'Coryphaena hippurus', family: 'Coryphaenidae', genus: 'Coryphaena' },
  { commonName: 'Halibut', scientificName: 'Hippoglossus hippoglossus', family: 'Pleuronectidae', genus: 'Hippoglossus' },
  { commonName: 'Sole', scientificName: 'Solea solea', family: 'Soleidae', genus: 'Solea' },
  { commonName: 'Turbot', scientificName: 'Scophthalmus maximus', family: 'Scophthalmidae', genus: 'Scophthalmus' },
  { commonName: 'Red Mullet', scientificName: 'Mullus surmuletus', family: 'Mullidae', genus: 'Mullus' },
  { commonName: 'Monkfish', scientificName: 'Lophius piscatorius', family: 'Lophiidae', genus: 'Lophius' },
  { commonName: 'Hake', scientificName: 'Merluccius merluccius', family: 'Merlucciidae', genus: 'Merluccius' },
  { commonName: 'Seabream', scientificName: 'Pagellus erythrinus', family: 'Sparidae', genus: 'Pagellus' },
  { commonName: 'Whiting', scientificName: 'Merlangius merlangus', family: 'Gadidae', genus: 'Merlangius' },
  { commonName: 'Mackerel', scientificName: 'Scomber scombrus', family: 'Scombridae', genus: 'Scomber' },
  { commonName: 'Herring', scientificName: 'Clupea harengus', family: 'Clupeidae', genus: 'Clupea' },
  { commonName: 'Sardine', scientificName: 'Sardina pilchardus', family: 'Clupeidae', genus: 'Sardina' },
];

const PRODUCT_FORMS = ['Whole', 'HGT', 'Fillet', 'Steak', 'Loin', 'IQF', 'Block', 'Vacuum', 'Portion'];

function generateMockCandidates(assetTitle: string | null, category: string | null) {
  // Deterministic seed from asset title for consistent results
  const seed = (assetTitle ?? 'unknown').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseIdx = seed % MOCK_SPECIES_POOL.length;

  const candidates = [];
  const confidences = [72, 58, 41, 28, 18];
  const similarities = [68, 55, 38, 25, 15];

  for (let i = 0; i < 5; i++) {
    const speciesIdx = (baseIdx + i) % MOCK_SPECIES_POOL.length;
    const species = MOCK_SPECIES_POOL[speciesIdx];
    const productForm = PRODUCT_FORMS[(seed + i) % PRODUCT_FORMS.length];

    candidates.push({
      rank: i + 1,
      common_name: species.commonName,
      scientific_name: species.scientificName,
      family: species.family,
      genus: species.genus,
      ai_score: confidences[i],
      similarity_score: similarities[i],
      product_form: productForm,
      source_provider: 'mock',
      main_reasons: [
        i === 0 ? `Coloration et forme correspondent à ${species.family}` : `Famille similaire au candidat #${i}`,
        category ? `Catégorie "${category}" compatible` : 'Analyse visuelle générale',
        i < 2 ? 'Silhouette et texture analysées' : 'Ambiguïté détectée — validation humaine requise',
      ],
      commercial_name: species.commonName,
      description_candidate: `${species.commonName} (${species.scientificName}) — proposition IA générée par le Mock Engine. Validation humaine requise avant publication.`,
      category_candidate: category ?? 'Fish',
      packaging_candidate: productForm,
      product_candidate: productForm,
      keywords_candidate: [species.commonName, species.scientificName, species.family, productForm, 'seafood'],
    });
  }
  return candidates;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIStudioIdentifyPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = useState<BatchSize>(50);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [importBatches, setImportBatches] = useState<{ id: string; name: string }[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    reviewStatus: '',
    metadataFilter: '',
    category: '',
    importBatch: '',
    textSearch: '',
    pilot: false,
    review100: false,
    review500: false,
  });
  const [searchInput, setSearchInput] = useState('');

  // Pipeline state
  const [running, setRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [progressPct, setProgressPct] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [jobsCreated, setJobsCreated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/identify'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  // ── Fetch assets ────────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    if (!profile) return;
    setAssetsLoading(true);

    let query = supabase
      .from('assets')
      .select(`
        id, public_asset_id, title, file_name, category,
        thumbnail_url, review_status, species_id, created_at,
        import_batch_id, is_demo
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Text search
    if (filters.textSearch) {
      query = query.or(`title.ilike.%${filters.textSearch}%,file_name.ilike.%${filters.textSearch}%,public_asset_id.ilike.%${filters.textSearch}%`);
    }

    // Review status filter
    if (filters.reviewStatus) {
      query = query.eq('review_status', filters.reviewStatus);
    }

    // Category filter
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // Import batch filter
    if (filters.importBatch) {
      query = query.eq('import_batch_id', filters.importBatch);
    }

    // Metadata completeness filters
    if (filters.metadataFilter === 'without_species') {
      query = query.is('species_id', null);
    }

    // Pilot / review batch flags
    if (filters.pilot) {
      query = query.eq('is_demo', false);
    }

    // Limit
    const limit = batchSize === 'all' ? 2000 : (batchSize as number);
    query = query.limit(limit);

    const { data, count } = await query;
    const rows: AssetRow[] = (data ?? []).map((a: AssetRow) => ({
      ...a,
      has_scientific_name: false,
      has_common_name: false,
      has_keywords: false,
      has_description: false,
    }));

    setAssets(rows);
    setTotalCount(count ?? 0);
    setAssetsLoading(false);
  }, [profile, filters, batchSize, supabase]);

  const fetchMeta = useCallback(async () => {
    if (!profile) return;
    const [cats, batches] = await Promise.all([
      supabase.from('categories').select('name').order('name'),
      supabase.from('import_batches').select('id, name').order('created_at', { ascending: false }).limit(50),
    ]);
    setCategories((cats.data ?? []).map((c: { name: string }) => c.name));
    setImportBatches((batches.data ?? []) as { id: string; name: string }[]);
  }, [profile, supabase]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(assets.map((a) => a.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectCount = (n: number) => {
    const ids = assets.slice(0, n).map((a) => a.id);
    setSelectedIds(new Set(ids));
  };

  // ── Run identification ───────────────────────────────────────────────────────

  const runIdentification = async () => {
    const toProcess = selectedIds.size > 0
      ? assets.filter((a) => selectedIds.has(a.id))
      : assets;

    if (toProcess.length === 0) { setError('Sélectionnez au moins une photo.'); return; }

    setError(null);
    setSuccess(null);
    setRunning(true);
    setCurrentStepIdx(0);
    setProgressPct(5);
    setProcessedCount(0);
    setTotalToProcess(toProcess.length);
    setJobsCreated(0);
    abortRef.current = false;

    // Step-by-step pipeline animation
    const stepDurations = [500, 600, 500, 400, 500, 400, 300];
    for (let i = 0; i < PIPELINE_STEPS.length - 1; i++) {
      if (abortRef.current) break;
      setCurrentStepIdx(i);
      setProgressPct(Math.round(((i + 1) / PIPELINE_STEPS.length) * 60));
      await new Promise((r) => setTimeout(r, stepDurations[i]));
    }

    // Create SIE jobs + run Mock Engine per asset
    let created = 0;
    const batchChunk = 20; // process in chunks to avoid timeout

    for (let i = 0; i < toProcess.length; i += batchChunk) {
      if (abortRef.current) break;
      const chunk = toProcess.slice(i, i + batchChunk);

      // Insert sie_jobs
      const jobRows = chunk.map((asset) => ({
        asset_id: asset.id,
        public_asset_id: asset.public_asset_id ?? null,
        current_name: asset.title ?? asset.file_name ?? null,
        current_category: asset.category ?? null,
        job_status: 'proposals_ready',
        progress_step: 'proposals_ready',
        progress_pct: 100,
        ai_provider: 'mock',
        ai_model: 'seafood-vision-mock-v1',
        processing_time_ms: 300,
        ambiguity_detected: true,
        vision_confidence: 65,
        species_confidence: 72,
        commercial_confidence: 43,
        metadata_confidence: 36,
        documentation_confidence: 29,
        global_confidence: 58,
      }));

      const { data: insertedJobs, error: jobErr } = await supabase
        .from('sie_jobs')
        .insert(jobRows)
        .select('id, asset_id');

      if (jobErr) {
        setError(`Erreur création jobs: ${jobErr.message}`);
        setRunning(false);
        return;
      }

      // Insert Top 5 candidates per job
      const candidateRows: Record<string, unknown>[] = [];
      for (const job of (insertedJobs ?? [])) {
        const asset = chunk.find((a) => a.id === job.asset_id);
        const candidates = generateMockCandidates(asset?.title ?? asset?.file_name ?? null, asset?.category ?? null);
        for (const c of candidates) {
          candidateRows.push({ job_id: job.id, ...c });
        }
      }

      if (candidateRows.length > 0) {
        await supabase.from('sie_species_candidates').insert(candidateRows);
      }

      // Push top candidate to metadata_suggestions as pending review
      const suggestionRows: Record<string, unknown>[] = [];
      for (const job of (insertedJobs ?? [])) {
        const asset = chunk.find((a) => a.id === job.asset_id);
        const topCandidate = generateMockCandidates(asset?.title ?? asset?.file_name ?? null, asset?.category ?? null)[0];
        if (asset?.id) {
          suggestionRows.push({
            asset_id: asset.id,
            field_name: 'species_candidate',
            suggested_value: topCandidate.scientific_name,
            source: 'ai_generated',
            confidence_score: Math.min(1, (topCandidate.ai_score ?? 0) / 100),
            status: 'under_review',
            review_note: `AI Job: ${job.id} | Top candidate: ${topCandidate.common_name} (${topCandidate.scientific_name}) | Confidence: ${topCandidate.ai_score}% | Mock Engine v1 | Validation humaine requise`,
          });
        }
      }

      if (suggestionRows.length > 0) {
        // Insert suggestions — ignore errors if table doesn't have all fields
        await supabase.from('metadata_suggestions').insert(suggestionRows).select('id');
      }

      created += insertedJobs?.length ?? 0;
      setProcessedCount(i + chunk.length);
      setProgressPct(60 + Math.round(((i + chunk.length) / toProcess.length) * 35));
    }

    setCurrentStepIdx(PIPELINE_STEPS.length - 1);
    setProgressPct(100);
    setJobsCreated(created);
    setSuccess(`${created} job(s) créés. ${created * 5} propositions Top 5 générées. Résultats disponibles dans Metadata Review Center.`);
    setRunning(false);
  };

  // ── Filter helpers ───────────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ reviewStatus: '', metadataFilter: '', category: '', importBatch: '', textSearch: '', pilot: false, review100: false, review500: false });
    setSearchInput('');
  };

  const activeFilterCount = [
    filters.reviewStatus, filters.metadataFilter, filters.category,
    filters.importBatch, filters.textSearch, filters.pilot, filters.review100, filters.review500,
  ].filter(Boolean).length;

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }
  if (!['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
              <Brain size={18} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">AI Studio — Identify with AI</h1>
                <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
                  Mock Engine
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Galerie Assets · Sélection · Pipeline IA · Propositions → Metadata Review Center
              </p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← AI Studio
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Left panel: Controls ── */}
          <div className="space-y-4">

            {/* Batch size */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Hash size={11} />Taille du lot
              </h3>
              <div className="space-y-1.5">
                {BATCH_OPTIONS.map((opt) => (
                  <button key={String(opt.value)} onClick={() => setBatchSize(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-all ${batchSize === opt.value
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-muted/30 border-border text-foreground hover:border-violet-200'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick select */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckSquare size={11} />Sélection rapide
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {[1, 50, 100, 500].map((n) => (
                  <button key={n} onClick={() => selectCount(n)}
                    className="px-2 py-1.5 text-xs font-medium bg-muted/40 border border-border rounded-lg hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                    {n}
                  </button>
                ))}
                <button onClick={selectAll}
                  className="col-span-2 px-2 py-1.5 text-xs font-medium bg-muted/40 border border-border rounded-lg hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                  Tout sélectionner
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={clearSelection}
                    className="col-span-2 px-2 py-1.5 text-xs font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-all">
                    Tout désélectionner
                  </button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <p className="text-xs text-violet-600 font-semibold mt-2 text-center">
                  {selectedIds.size} sélectionné(s)
                </p>
              )}
            </div>

            {/* Filters toggle */}
            <div className="bg-card border border-border rounded-xl p-4">
              <button onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal size={11} />
                  Filtres
                  {activeFilterCount > 0 && (
                    <span className="bg-violet-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="mt-3 space-y-3">
                  {/* Text search */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Recherche texte..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateFilter('textSearch', searchInput); }}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-300"
                    />
                  </div>

                  {/* Review status */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
                    <select value={filters.reviewStatus} onChange={(e) => updateFilter('reviewStatus', e.target.value)}
                      className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                      {REVIEW_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  {/* Metadata completeness */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Métadonnées</label>
                    <select value={filters.metadataFilter} onChange={(e) => updateFilter('metadataFilter', e.target.value)}
                      className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                      {METADATA_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Catégorie</label>
                    <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}
                      className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                      <option value="">Toutes</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Import batch */}
                  {importBatches.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Import Batch</label>
                      <select value={filters.importBatch} onChange={(e) => updateFilter('importBatch', e.target.value)}
                        className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                        <option value="">Tous les lots</option>
                        {importBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Toggle filters */}
                  <div className="space-y-1.5">
                    {[
                      { key: 'pilot', label: 'Pilot (non-demo)' },
                      { key: 'review100', label: 'Review 100' },
                      { key: 'review500', label: 'Review 500' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                          checked={filters[key as keyof FilterState] as boolean}
                          onChange={(e) => updateFilter(key as keyof FilterState, e.target.checked)}
                          className="rounded border-border text-violet-600 focus:ring-violet-300" />
                        <span className="text-xs text-foreground">{label}</span>
                      </label>
                    ))}
                  </div>

                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                      className="w-full text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 py-1">
                      <X size={10} />Effacer les filtres
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pipeline */}
            {(running || success) && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Zap size={11} className="text-violet-500" />Pipeline SIE
                </h3>
                <div className="space-y-1.5 mb-3">
                  {PIPELINE_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i === currentStepIdx && running;
                    const isDone = i < currentStepIdx || (!running && success);
                    return (
                      <div key={step.key}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${isActive ? 'bg-violet-50 border border-violet-200' : isDone ? 'opacity-70' : 'opacity-20'}`}>
                        <StepIcon size={11} className={isActive ? 'text-violet-600' : isDone ? 'text-emerald-500' : 'text-muted-foreground'} />
                        <span className={`text-xs flex-1 ${isActive ? 'text-violet-700 font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                        {isActive && <Loader2 size={9} className="text-violet-500 animate-spin" />}
                        {isDone && !isActive && <CheckCircle2 size={9} className="text-emerald-500" />}
                      </div>
                    );
                  })}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-1">
                  <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{processedCount}/{totalToProcess} actifs</span>
                  <span>{progressPct}%</span>
                </div>
              </div>
            )}

            {/* IDENTIFY WITH AI button */}
            <button
              onClick={runIdentification}
              disabled={running || assets.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold px-6 py-4 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm text-sm">
              {running ? (
                <><Loader2 size={16} className="animate-spin" />Identification en cours...</>
              ) : (
                <><Brain size={16} />IDENTIFY WITH AI</>
              )}
            </button>

            {/* Feedback */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <X size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs text-emerald-700 font-semibold">✓ {success}</p>
                <div className="flex flex-col gap-1">
                  <Link href="/admin/ai-studio/validation"
                    className="text-xs text-violet-600 underline hover:no-underline">
                    → Validation AI Studio
                  </Link>
                  <Link href="/admin/metadata-review/assets"
                    className="text-xs text-blue-600 underline hover:no-underline">
                    → Metadata Review Center
                  </Link>
                </div>
              </div>
            )}

            {/* Safety notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Aucune identification publiée automatiquement. Toutes les propositions restent <strong>Draft / Pending Review</strong>.
              </p>
            </div>
          </div>

          {/* ── Right panel: Asset gallery ── */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-xl overflow-hidden">

              {/* Gallery toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {assetsLoading ? 'Chargement...' : `${assets.length} actifs affichés`}
                    {totalCount > assets.length && (
                      <span className="text-xs text-muted-foreground ml-1">/ {totalCount} total</span>
                    )}
                  </span>
                  {selectedIds.size > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
                      {selectedIds.size} sélectionné(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => fetchAssets()}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={selectAll}
                    className="text-xs text-muted-foreground hover:text-violet-600 transition-colors px-2 py-1 rounded hover:bg-violet-50">
                    Tout sélectionner
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={clearSelection}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                      Désélectionner
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery grid */}
              {assetsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-2 border-border border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <Upload size={36} className="text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Aucun actif trouvé</p>
                  <p className="text-xs text-muted-foreground mt-1">Modifiez les filtres ou importez des assets</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-4 max-h-[680px] overflow-y-auto">
                  {assets.map((asset) => {
                    const isSelected = selectedIds.has(asset.id);
                    const statusColor = STATUS_COLORS[asset.review_status ?? 'draft'] ?? 'bg-gray-100 text-gray-600';
                    return (
                      <div key={asset.id}
                        onClick={() => toggleSelect(asset.id)}
                        className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-150 group ${isSelected
                          ? 'border-violet-500 shadow-lg shadow-violet-100'
                          : 'border-border hover:border-violet-300 hover:shadow-md'}`}>

                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted relative">
                          {asset.thumbnail_url ? (
                            <img
                              src={asset.thumbnail_url}
                              alt={asset.title ?? asset.file_name ?? 'Asset'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Fish size={24} className="text-muted-foreground" />
                            </div>
                          )}

                          {/* Selection overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-violet-500/15 flex items-start justify-end p-1.5">
                              <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow">
                                <CheckSquare size={11} className="text-white" />
                              </div>
                            </div>
                          )}
                          {!isSelected && (
                            <div className="absolute inset-0 flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-5 h-5 rounded-full bg-white/80 border border-border flex items-center justify-center shadow">
                                <Square size={10} className="text-muted-foreground" />
                              </div>
                            </div>
                          )}

                          {/* Status badge */}
                          {asset.review_status && (
                            <div className="absolute bottom-1 left-1">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                {asset.review_status}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2 bg-card">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">
                            {asset.title ?? asset.file_name ?? '—'}
                          </p>
                          {asset.public_asset_id && (
                            <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                              {asset.public_asset_id}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {asset.category && (
                              <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">
                                {asset.category}
                              </span>
                            )}
                            {!asset.species_id && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded font-medium">
                                No species
                              </span>
                            )}
                          </div>
                          {asset.created_at && (
                            <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                              <Clock size={8} />
                              {new Date(asset.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats bar */}
            {!assetsLoading && assets.length > 0 && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground px-1">
                <span>{assets.filter((a) => a.review_status === 'approved').length} approved</span>
                <span>{assets.filter((a) => a.review_status === 'under_review').length} under review</span>
                <span>{assets.filter((a) => !a.species_id).length} without species</span>
                <span className="ml-auto text-violet-600 font-medium">
                  {selectedIds.size > 0 ? `${selectedIds.size} sélectionné(s) — prêt pour identification` : 'Sélectionnez des actifs pour identifier'}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
