'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Layers, Fish, Tag, Star, ChevronDown, Search } from 'lucide-react';

interface Candidate {
  id: string;
  rank: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  order_name: string | null;
  ai_score: number;
  similarity_score: number;
  main_reasons: string[];
  product_form: string | null;
  commercial_name: string | null;
  is_selected: boolean;
  is_validated: boolean;
  source_provider: string;
  job_id: string;
}

export default function AIStudioCandidatesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFamily, setFilterFamily] = useState('');
  const [families, setFamilies] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/candidates'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchCandidates = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('sie_species_candidates')
      .select('*', { count: 'exact' })
      .order('ai_score', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search) query = query.ilike('common_name', `%${search}%`);
    if (filterFamily) query = query.eq('family', filterFamily);
    const { data, count } = await query;
    setCandidates(data ?? []);
    setTotal(count ?? 0);
    // Extract unique families
    const fams = [...new Set((data ?? []).map((c: Candidate) => c.family).filter(Boolean))] as string[];
    if (fams.length > 0) setFamilies((prev) => [...new Set([...prev, ...fams])]);
    setFetching(false);
  }, [profile, search, filterFamily, page]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const confidenceColor = (score: number) =>
    score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center">
              <Layers size={18} className="text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Species Candidates</h1>
                <span className="text-xs bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-medium">Top 5</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Toutes les propositions IA — jamais publiées automatiquement</p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Rechercher par nom commun..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <div className="relative">
            <select value={filterFamily} onChange={(e) => { setFilterFamily(e.target.value); setPage(0); }}
              className="appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-teal-300">
              <option value="">Toutes les familles</option>
              {families.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span>{total} candidats</span>
          <span>·</span>
          <span>{candidates.filter((c) => c.is_validated).length} validés</span>
          <span>·</span>
          <span>{candidates.filter((c) => c.rank === 1).length} rang 1</span>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-border border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
            <Layers size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Aucun candidat trouvé</p>
            <Link href="/admin/ai-studio/identify" className="text-xs text-teal-600 underline mt-1">
              Lancer une identification
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {candidates.map((c) => (
                <div key={c.id}
                  className={`bg-card border rounded-xl p-4 ${c.is_validated ? 'border-emerald-300 bg-emerald-50/20' : c.rank === 1 ? 'border-teal-200' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.rank === 1 ? 'bg-teal-100 text-teal-700' : 'bg-muted text-muted-foreground'}`}>
                        {c.rank}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{c.common_name}</p>
                        {c.scientific_name && (
                          <p className="text-xs text-muted-foreground italic">{c.scientific_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold font-mono-data ${confidenceColor(c.ai_score)}`}>{c.ai_score}%</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {c.family && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Fish size={9} />{c.family}
                      </span>
                    )}
                    {c.product_form && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Tag size={9} />{c.product_form}
                      </span>
                    )}
                    {c.is_validated && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                        ✓ Validé
                      </span>
                    )}
                  </div>

                  {c.main_reasons && c.main_reasons.length > 0 && (
                    <ul className="space-y-0.5">
                      {c.main_reasons.slice(0, 2).map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <Star size={8} className="text-teal-400 shrink-0 mt-0.5" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Similarité:</span>
                    <div className="flex-1 bg-muted rounded-full h-1">
                      <div className="bg-teal-400 h-1 rounded-full" style={{ width: `${c.similarity_score}%` }} />
                    </div>
                    <span className="text-xs font-mono-data text-muted-foreground">{c.similarity_score}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors">
                Précédent
              </button>
              <span className="text-sm text-muted-foreground">Page {page + 1} · {total} total</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors">
                Suivant
              </button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
