'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// PHASE 5.3 — SEMANTIC SEARCH LIBRARY
// All queries use only public, verified, non-confidential data
// No OpenAI, no embeddings, no external vector DB
// ============================================================

// ---- Types ----

export interface SemanticSearchResult {
  object_type: string;
  object_id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  relevance_score: number;
  match_type: string;
  matched_terms: string[];
  status: string;
  cover_image: string | null;
  updated_at: string;
}

export interface AutocompleteResult {
  object_type: string;
  object_id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  is_verified: boolean;
}

export interface SearchSuggestion {
  suggestion: string;
  object_type: string;
  similarity_score: number;
}

export interface SearchFacets {
  types: { type: string; count: number }[];
  statuses: { status: string; count: number }[];
}

export interface PaginatedSearchResult {
  results: SemanticSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
  suggestions: SearchSuggestion[];
  hasMore: boolean;
}

export interface SearchOptions {
  resultTypes?: string[];
  languageCode?: string;
  verifiedOnly?: boolean;
  includeDemo?: boolean;
  page?: number;
  pageSize?: number;
}

// ============================================================
// MAIN SEMANTIC SEARCH (calls RPC)
// ============================================================

export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<PaginatedSearchResult> {
  if (!query.trim()) {
    return { results: [], total: 0, page: 1, pageSize: 20, facets: { types: [], statuses: [] }, suggestions: [], hasMore: false };
  }

  const supabase = createClient();
  const {
    resultTypes,
    languageCode = 'en',
    verifiedOnly = false,
    includeDemo = false,
    page = 1,
    pageSize = 20,
  } = options;

  const { data, error } = await supabase.rpc('search_seafood_knowledge', {
    query_text: query,
    result_types: resultTypes || null,
    language_code: languageCode,
    status_filter: null,
    verified_only: verifiedOnly,
    include_demo: includeDemo,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error('semanticSearch RPC error:', error.message);
    // Fallback to basic search
    return fallbackSearch(query, options);
  }

  const results: SemanticSearchResult[] = (data || []).map((r: any) => ({
    object_type: r.object_type,
    object_id: r.object_id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    excerpt: r.excerpt,
    relevance_score: r.relevance_score,
    match_type: r.match_type,
    matched_terms: r.matched_terms || [],
    status: r.status,
    cover_image: r.cover_image,
    updated_at: r.updated_at,
  }));

  // Build facets from results
  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  results.forEach((r) => {
    typeCounts[r.object_type] = (typeCounts[r.object_type] || 0) + 1;
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const facets: SearchFacets = {
    types: Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
  };

  // Log search event (fire and forget)
  logSearchEvent(query, results.length, languageCode).catch(() => {});

  return {
    results,
    total: results.length,
    page,
    pageSize,
    facets,
    suggestions: [],
    hasMore: results.length === pageSize,
  };
}

// ============================================================
// FALLBACK SEARCH (when RPC not available yet)
// ============================================================

async function fallbackSearch(query: string, options: SearchOptions = {}): Promise<PaginatedSearchResult> {
  const supabase = createClient();
  const q = query.trim();
  const { verifiedOnly = false, includeDemo = false, resultTypes } = options;

  const shouldInclude = (type: string) => !resultTypes || resultTypes.includes(type);

  const [speciesRes, productRes, marketRes, certRes, docRes, mediaRes, speciesNamesRes] = await Promise.all([
    shouldInclude('species') ? supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, family, description, is_validated, is_demo, updated_at')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`)
      .eq('is_demo', includeDemo ? undefined as any : false)
      .limit(15) : Promise.resolve({ data: [] }),

    shouldInclude('product') ? supabase
      .from('commercial_products')
      .select('id, slug, public_name, description, status, is_demo, updated_at')
      .eq('is_public', true)
      .ilike('public_name', `%${q}%`)
      .limit(10) : Promise.resolve({ data: [] }),

    shouldInclude('market') ? supabase
      .from('markets')
      .select('id, slug, name, market_type, description, status, is_demo, updated_at')
      .eq('is_public', true)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%,region.ilike.%${q}%`)
      .limit(6) : Promise.resolve({ data: [] }),

    shouldInclude('certification') ? supabase
      .from('certifications')
      .select('id, slug, name, certification_type, description, status, updated_at')
      .eq('is_public', true)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%,issuing_body.ilike.%${q}%`)
      .limit(6) : Promise.resolve({ data: [] }),

    shouldInclude('document') ? supabase
      .from('documents')
      .select('id, public_title, status, is_demo, updated_at')
      .eq('is_public', true)
      .eq('confidentiality_level', 'public')
      .ilike('public_title', `%${q}%`)
      .limit(5) : Promise.resolve({ data: [] }),

    shouldInclude('media') ? supabase
      .from('assets')
      .select('id, slug, title, category, description, review_status, is_demo, updated_at')
      .in('publication_status', ['approved', 'commercial', 'editorial'])
      .or(`title.ilike.%${q}%,product_form.ilike.%${q}%,category.ilike.%${q}%`)
      .limit(8) : Promise.resolve({ data: [] }),

    // Species names (synonyms/translations)
    shouldInclude('species') ? supabase
      .from('species_names')
      .select('id, name, language_code, name_type, species_id, species!inner(id, slug, common_name, scientific_name, is_validated, is_demo, updated_at)')
      .ilike('name', `%${q}%`)
      .in('status', ['verified', 'under_review'])
      .limit(5) : Promise.resolve({ data: [] }),
  ]);

  const results: SemanticSearchResult[] = [];

  (speciesRes.data || []).forEach((s: any) => {
    if (verifiedOnly && !s.is_validated) return;
    if (!includeDemo && s.is_demo) return;
    const isExact = s.common_name?.toLowerCase() === q.toLowerCase() || s.scientific_name?.toLowerCase() === q.toLowerCase();
    results.push({
      object_type: 'species', object_id: s.id, slug: s.slug,
      title: s.common_name, subtitle: s.scientific_name,
      excerpt: s.description ? s.description.slice(0, 200) : null,
      relevance_score: isExact ? 1.0 : 0.8,
      match_type: isExact ? 'exact' : 'commercial_name',
      matched_terms: [s.common_name, s.scientific_name].filter(Boolean),
      status: s.is_validated ? 'verified' : 'unverified',
      cover_image: null, updated_at: s.updated_at,
    });
  });

  (speciesNamesRes.data || []).forEach((sn: any) => {
    const sp = sn.species;
    if (!sp) return;
    if (verifiedOnly && !sp.is_validated) return;
    if (!includeDemo && sp.is_demo) return;
    // Avoid duplicates with species already added
    if (results.find(r => r.object_id === sp.id && r.object_type === 'species')) return;
    results.push({
      object_type: 'species', object_id: sp.id, slug: sp.slug,
      title: sp.common_name, subtitle: sn.name + ' (' + sn.language_code + ')',
      excerpt: null,
      relevance_score: 0.75,
      match_type: sn.name_type === 'scientific_synonym' ? 'synonym' : 'translation',
      matched_terms: [sn.name, sp.common_name].filter(Boolean),
      status: sp.is_validated ? 'verified' : 'unverified',
      cover_image: null, updated_at: sp.updated_at,
    });
  });

  (productRes.data || []).forEach((p: any) => {
    if (verifiedOnly && p.status !== 'verified') return;
    if (!includeDemo && p.is_demo) return;
    results.push({
      object_type: 'product', object_id: p.id, slug: p.slug,
      title: p.public_name, subtitle: null,
      excerpt: p.description ? p.description.slice(0, 200) : null,
      relevance_score: 0.8,
      match_type: 'commercial_name',
      matched_terms: [p.public_name],
      status: p.status, cover_image: null, updated_at: p.updated_at,
    });
  });

  (marketRes.data || []).forEach((m: any) => {
    if (verifiedOnly && m.status !== 'verified') return;
    if (!includeDemo && m.is_demo) return;
    results.push({
      object_type: 'market', object_id: m.id, slug: m.slug,
      title: m.name, subtitle: m.market_type,
      excerpt: m.description ? m.description.slice(0, 200) : null,
      relevance_score: 0.75,
      match_type: 'keyword',
      matched_terms: [m.name],
      status: m.status, cover_image: null, updated_at: m.updated_at,
    });
  });

  (certRes.data || []).forEach((c: any) => {
    if (verifiedOnly && c.status !== 'verified') return;
    results.push({
      object_type: 'certification', object_id: c.id, slug: c.slug,
      title: c.name, subtitle: c.certification_type,
      excerpt: c.description ? c.description.slice(0, 200) : null,
      relevance_score: 0.75,
      match_type: 'keyword',
      matched_terms: [c.name],
      status: c.status, cover_image: null, updated_at: c.updated_at,
    });
  });

  (docRes.data || []).forEach((d: any) => {
    if (verifiedOnly && d.status !== 'verified') return;
    if (!includeDemo && d.is_demo) return;
    results.push({
      object_type: 'document', object_id: d.id, slug: null,
      title: d.public_title, subtitle: null, excerpt: null,
      relevance_score: 0.65,
      match_type: 'description',
      matched_terms: [d.public_title],
      status: d.status, cover_image: null, updated_at: d.updated_at,
    });
  });

  (mediaRes.data || []).forEach((a: any) => {
    if (!includeDemo && a.is_demo) return;
    results.push({
      object_type: 'media', object_id: a.id, slug: a.slug,
      title: a.title, subtitle: a.category, excerpt: a.description ? a.description.slice(0, 200) : null,
      relevance_score: 0.60,
      match_type: 'description',
      matched_terms: [a.title],
      status: a.review_status, cover_image: null, updated_at: a.updated_at,
    });
  });

  results.sort((a, b) => b.relevance_score - a.relevance_score);

  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  results.forEach((r) => {
    typeCounts[r.object_type] = (typeCounts[r.object_type] || 0) + 1;
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  return {
    results,
    total: results.length,
    page: 1,
    pageSize: 20,
    facets: {
      types: Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    },
    suggestions: [],
    hasMore: false,
  };
}

// ============================================================
// AUTOCOMPLETE (max 8 suggestions)
// ============================================================

export async function autocompleteSearch(query: string): Promise<AutocompleteResult[]> {
  if (!query.trim() || query.length < 2) return [];

  const supabase = createClient();

  const { data, error } = await supabase.rpc('autocomplete_seafood', {
    query_text: query,
    max_results: 8,
  });

  if (error) {
    // Fallback: simple ilike on species + products
    const [sp, pr] = await Promise.all([
      supabase.from('species').select('id, slug, common_name, scientific_name, is_validated')
        .ilike('common_name', `${query}%`).eq('is_demo', false).limit(4),
      supabase.from('commercial_products').select('id, slug, public_name, status')
        .eq('is_public', true).eq('is_demo', false).ilike('public_name', `${query}%`).limit(3),
    ]);
    const results: AutocompleteResult[] = [];
    (sp.data || []).forEach((s: any) => results.push({
      object_type: 'species', object_id: s.id, slug: s.slug,
      title: s.common_name, subtitle: s.scientific_name, is_verified: s.is_validated,
    }));
    (pr.data || []).forEach((p: any) => results.push({
      object_type: 'product', object_id: p.id, slug: p.slug,
      title: p.public_name, subtitle: null, is_verified: p.status === 'verified',
    }));
    return results.slice(0, 8);
  }

  return (data || []).map((r: any) => ({
    object_type: r.object_type,
    object_id: r.object_id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    is_verified: r.is_verified,
  }));
}

// ============================================================
// FUZZY SUGGESTIONS ("Did you mean?")
// ============================================================

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim() || query.length < 3) return [];

  const supabase = createClient();

  const { data, error } = await supabase.rpc('suggest_search_correction', {
    query_text: query,
    max_suggestions: 3,
  });

  if (error) {
    console.error('getSearchSuggestions error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    suggestion: r.suggestion,
    object_type: r.object_type,
    similarity_score: r.similarity_score,
  }));
}

// ============================================================
// RELATED SEARCHES (from KG relations + species names)
// ============================================================

export interface RelatedSearch {
  label: string;
  type: string;
  href: string;
}

export async function getRelatedSearches(query: string, results: SemanticSearchResult[]): Promise<RelatedSearch[]> {
  const related: RelatedSearch[] = [];
  const seen = new Set<string>();

  const add = (label: string, type: string, href: string) => {
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      related.push({ label, type, href });
    }
  };

  // From top species results, add synonyms/translations
  const topSpecies = results.filter(r => r.object_type === 'species').slice(0, 2);
  if (topSpecies.length > 0) {
    const supabase = createClient();
    for (const sp of topSpecies) {
      const { data: names } = await supabase
        .from('species_names')
        .select('name, language_code, name_type')
        .eq('species_id', sp.object_id)
        .in('status', ['verified', 'under_review'])
        .limit(4);
      (names || []).forEach((n: any) => {
        if (n.name.toLowerCase() !== query.toLowerCase()) {
          add(n.name, 'translation', `/knowledge/search?q=${encodeURIComponent(n.name)}`);
        }
      });
    }
  }

  // From results, add related entity types
  results.slice(0, 5).forEach((r) => {
    if (r.object_type === 'species') {
      add(`${r.title} products`, 'product', `/knowledge/search?q=${encodeURIComponent(r.title + ' products')}`);
      add(`${r.title} packaging`, 'packaging', `/knowledge/search?q=${encodeURIComponent(r.title + ' packaging')}`);
    }
    if (r.object_type === 'market') {
      add(`products for ${r.title}`, 'product', `/knowledge/search?q=${encodeURIComponent('products for ' + r.title)}`);
    }
  });

  return related.slice(0, 8);
}

// ============================================================
// FACETED NAVIGATION DATA
// ============================================================

export interface FacetGroup {
  label: string;
  key: string;
  options: { value: string; label: string; count: number }[];
}

export async function getSearchFacets(query: string): Promise<FacetGroup[]> {
  const supabase = createClient();
  const q = query.trim();
  if (!q) return [];

  const [speciesRes, productFormsRes, marketsRes, certsRes] = await Promise.all([
    supabase.from('species').select('category').ilike('common_name', `%${q}%`).eq('is_demo', false).limit(50),
    supabase.from('commercial_products')
      .select('product_forms(name)')
      .eq('is_public', true)
      .ilike('public_name', `%${q}%`)
      .limit(30),
    supabase.from('markets').select('market_type').eq('is_public', true).limit(20),
    supabase.from('certifications').select('certification_type').eq('is_public', true).limit(20),
  ]);

  const facets: FacetGroup[] = [];

  // Categories facet
  const catCounts: Record<string, number> = {};
  (speciesRes.data || []).forEach((s: any) => {
    if (s.category) catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  });
  if (Object.keys(catCounts).length > 0) {
    facets.push({
      label: 'Species Category',
      key: 'category',
      options: Object.entries(catCounts).map(([v, c]) => ({ value: v, label: v, count: c })).sort((a, b) => b.count - a.count),
    });
  }

  // Market types facet
  const mktCounts: Record<string, number> = {};
  (marketsRes.data || []).forEach((m: any) => {
    if (m.market_type) mktCounts[m.market_type] = (mktCounts[m.market_type] || 0) + 1;
  });
  if (Object.keys(mktCounts).length > 0) {
    facets.push({
      label: 'Market Type',
      key: 'market_type',
      options: Object.entries(mktCounts).map(([v, c]) => ({ value: v, label: v.replace(/_/g, ' '), count: c })).sort((a, b) => b.count - a.count),
    });
  }

  // Certification types facet
  const certCounts: Record<string, number> = {};
  (certsRes.data || []).forEach((c: any) => {
    if (c.certification_type) certCounts[c.certification_type] = (certCounts[c.certification_type] || 0) + 1;
  });
  if (Object.keys(certCounts).length > 0) {
    facets.push({
      label: 'Certification Type',
      key: 'certification_type',
      options: Object.entries(certCounts).map(([v, c]) => ({ value: v, label: v.replace(/_/g, ' '), count: c })).sort((a, b) => b.count - a.count),
    });
  }

  return facets;
}

// ============================================================
// DISCOVER PAGE DATA
// ============================================================

export interface DiscoverSection {
  recentlyVerified: SemanticSearchResult[];
  recentlyUpdated: any[];
  speciesCategories: { category: string; count: number }[];
  productForms: { name: string; count: number }[];
  markets: { id: string; slug: string; name: string; market_type: string }[];
  certifications: { id: string; slug: string; name: string; certification_type: string }[];
}

export async function fetchDiscoverData(): Promise<DiscoverSection> {
  const supabase = createClient();

  const [verifiedSpecies, recentSpecies, categories, markets, certs] = await Promise.all([
    // Recently validated species
    supabase.from('species')
      .select('id, slug, common_name, scientific_name, family, category, is_validated, is_demo, updated_at')
      .eq('is_validated', true)
      .eq('is_demo', false)
      .order('updated_at', { ascending: false })
      .limit(6),

    // Recently updated species
    supabase.from('species')
      .select('id, slug, common_name, scientific_name, category, updated_at')
      .eq('is_demo', false)
      .order('updated_at', { ascending: false })
      .limit(8),

    // Species categories with counts
    supabase.from('species')
      .select('category')
      .eq('is_demo', false)
      .not('category', 'is', null),

    // Markets
    supabase.from('markets')
      .select('id, slug, name, market_type')
      .eq('is_public', true)
      .eq('is_demo', false)
      .order('name')
      .limit(8),

    // Certifications
    supabase.from('certifications')
      .select('id, slug, name, certification_type')
      .eq('is_public', true)
      .order('name')
      .limit(8),
  ]);

  // Build category counts
  const catCounts: Record<string, number> = {};
  (categories.data || []).forEach((s: any) => {
    if (s.category) catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  });

  const recentlyVerified: SemanticSearchResult[] = (verifiedSpecies.data || []).map((s: any) => ({
    object_type: 'species',
    object_id: s.id,
    slug: s.slug,
    title: s.common_name,
    subtitle: s.scientific_name,
    excerpt: null,
    relevance_score: 1.0,
    match_type: 'exact',
    matched_terms: [],
    status: 'verified',
    cover_image: null,
    updated_at: s.updated_at,
  }));

  return {
    recentlyVerified,
    recentlyUpdated: recentSpecies.data || [],
    speciesCategories: Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    productForms: [],
    markets: markets.data || [],
    certifications: certs.data || [],
  };
}

// ============================================================
// ADMIN SEARCH (includes draft/private/under_review)
// ============================================================

export async function adminSearch(
  query: string,
  options: SearchOptions & { includePrivate?: boolean; includeDraft?: boolean } = {}
): Promise<PaginatedSearchResult> {
  const supabase = createClient();
  const q = query.trim();
  if (!q) return { results: [], total: 0, page: 1, pageSize: 20, facets: { types: [], statuses: [] }, suggestions: [], hasMore: false };

  const { resultTypes, page = 1, pageSize = 20 } = options;
  const shouldInclude = (type: string) => !resultTypes || resultTypes.includes(type);

  const [speciesRes, productRes, marketRes, certRes, docRes, entitiesRes] = await Promise.all([
    shouldInclude('species') ? supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, is_validated, is_demo, updated_at')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`)
      .limit(15) : Promise.resolve({ data: [] }),

    shouldInclude('product') ? supabase
      .from('commercial_products')
      .select('id, slug, public_name, status, is_demo, is_public, updated_at')
      .ilike('public_name', `%${q}%`)
      .limit(10) : Promise.resolve({ data: [] }),

    shouldInclude('market') ? supabase
      .from('markets')
      .select('id, slug, name, market_type, status, is_demo, updated_at')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(8) : Promise.resolve({ data: [] }),

    shouldInclude('certification') ? supabase
      .from('certifications')
      .select('id, slug, name, certification_type, status, updated_at')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(8) : Promise.resolve({ data: [] }),

    shouldInclude('document') ? supabase
      .from('documents')
      .select('id, public_title, internal_title, status, confidentiality_level, is_public, is_demo, updated_at')
      .or(`public_title.ilike.%${q}%,internal_title.ilike.%${q}%,issuing_body.ilike.%${q}%`)
      .limit(8) : Promise.resolve({ data: [] }),

    shouldInclude('knowledge_entity') ? supabase
      .from('knowledge_entities')
      .select('id, slug, canonical_name, label, entity_type, status, is_demo, updated_at')
      .or(`canonical_name.ilike.%${q}%,label.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(8) : Promise.resolve({ data: [] }),
  ]);

  const results: SemanticSearchResult[] = [];

  (speciesRes.data || []).forEach((s: any) => results.push({
    object_type: 'species', object_id: s.id, slug: s.slug,
    title: s.common_name, subtitle: s.scientific_name, excerpt: null,
    relevance_score: 0.9, match_type: 'commercial_name', matched_terms: [s.common_name],
    status: s.is_validated ? 'verified' : 'unverified', cover_image: null, updated_at: s.updated_at,
  }));

  (productRes.data || []).forEach((p: any) => results.push({
    object_type: 'product', object_id: p.id, slug: p.slug,
    title: p.public_name, subtitle: p.is_public ? 'Public' : 'Private', excerpt: null,
    relevance_score: 0.85, match_type: 'commercial_name', matched_terms: [p.public_name],
    status: p.status, cover_image: null, updated_at: p.updated_at,
  }));

  (marketRes.data || []).forEach((m: any) => results.push({
    object_type: 'market', object_id: m.id, slug: m.slug,
    title: m.name, subtitle: m.market_type, excerpt: null,
    relevance_score: 0.80, match_type: 'keyword', matched_terms: [m.name],
    status: m.status, cover_image: null, updated_at: m.updated_at,
  }));

  (certRes.data || []).forEach((c: any) => results.push({
    object_type: 'certification', object_id: c.id, slug: c.slug,
    title: c.name, subtitle: c.certification_type, excerpt: null,
    relevance_score: 0.80, match_type: 'keyword', matched_terms: [c.name],
    status: c.status, cover_image: null, updated_at: c.updated_at,
  }));

  (docRes.data || []).forEach((d: any) => results.push({
    object_type: 'document', object_id: d.id, slug: null,
    title: d.public_title || d.internal_title || 'Untitled',
    subtitle: d.confidentiality_level, excerpt: null,
    relevance_score: 0.70, match_type: 'description', matched_terms: [d.public_title || ''],
    status: d.status, cover_image: null, updated_at: d.updated_at,
  }));

  (entitiesRes.data || []).forEach((e: any) => results.push({
    object_type: 'knowledge_entity', object_id: e.id, slug: e.slug,
    title: e.canonical_name || e.label, subtitle: e.entity_type, excerpt: null,
    relevance_score: 0.65, match_type: 'related_entity', matched_terms: [e.canonical_name || e.label],
    status: e.status, cover_image: null, updated_at: e.updated_at,
  }));

  results.sort((a, b) => b.relevance_score - a.relevance_score);

  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  results.forEach((r) => {
    typeCounts[r.object_type] = (typeCounts[r.object_type] || 0) + 1;
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const offset = (page - 1) * pageSize;
  const paged = results.slice(offset, offset + pageSize);

  return {
    results: paged,
    total: results.length,
    page,
    pageSize,
    facets: {
      types: Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      statuses: Object.entries(statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    },
    suggestions: [],
    hasMore: offset + pageSize < results.length,
  };
}

// ============================================================
// ADMIN ANALYTICS
// ============================================================

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  zeroResultCount: number;
  topQueries: { query: string; count: number }[];
  zeroResultQueries: { query: string; frequency: number; locale: string }[];
  recentSearches: { query: string; locale: string; created_at: string }[];
}

export async function fetchSearchAnalytics(): Promise<SearchAnalytics> {
  const supabase = createClient();

  const [totalRes, topQueriesRes, zeroRes, recentRes] = await Promise.all([
    supabase.from('search_events').select('*', { count: 'exact', head: true }),
    supabase.rpc ? supabase
      .from('search_events')
      .select('query_text_normalized')
      .limit(200) : Promise.resolve({ data: [] }),
    supabase.from('search_zero_results')
      .select('query_normalized, frequency, locale')
      .order('frequency', { ascending: false })
      .limit(20),
    supabase.from('search_events')
      .select('query_text_normalized, locale, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Count unique queries from raw data
  const queryCounts: Record<string, number> = {};
  (topQueriesRes.data || []).forEach((e: any) => {
    const q = e.query_text_normalized;
    queryCounts[q] = (queryCounts[q] || 0) + 1;
  });
  const topQueries = Object.entries(queryCounts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const zeroResultQueries = (zeroRes.data || []).map((r: any) => ({
    query: r.query_normalized,
    frequency: r.frequency,
    locale: r.locale,
  }));

  return {
    totalSearches: totalRes.count ?? 0,
    uniqueQueries: Object.keys(queryCounts).length,
    zeroResultCount: zeroResultQueries.length,
    topQueries,
    zeroResultQueries,
    recentSearches: (recentRes.data || []).map((r: any) => ({
      query: r.query_text_normalized,
      locale: r.locale,
      created_at: r.created_at,
    })),
  };
}

// ============================================================
// LOG SEARCH EVENT (fire and forget)
// ============================================================

async function logSearchEvent(query: string, resultCount: number, locale: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc('log_search_event', {
      p_query: query,
      p_result_count: resultCount,
      p_locale: locale,
    });
  } catch {
    // Silent fail — analytics should never break search
  }
}

// ============================================================
// LIBRARY SEARCH (connects /library to unified search)
// ============================================================

export interface LibrarySearchResult {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  product_form: string | null;
  product_state: string | null;
  is_verified: boolean;
  is_demo: boolean;
  review_status: string;
  species_name: string | null;
  keywords: string[];
}

export async function searchLibraryAssets(query: string, limit = 24): Promise<LibrarySearchResult[]> {
  if (!query.trim()) return [];
  const supabase = createClient();
  const q = query.trim();

  // Search assets by title, description, product_form, category, search_aliases, and via species name
  const [directRes, speciesRes, aliasRes] = await Promise.all([
    supabase
      .from('assets')
      .select('id, slug, title, category, product_form, product_state, is_verified, is_demo, review_status, asset_keywords(keywords(term))')
      .in('publication_status', ['approved', 'commercial', 'editorial'])
      .or(`title.ilike.%${q}%,description.ilike.%${q}%,product_form.ilike.%${q}%,product_state.ilike.%${q}%,category.ilike.%${q}%,packaging.ilike.%${q}%`)
      .limit(limit),

    // Search via species name (common_name or scientific_name)
    supabase
      .from('assets')
      .select('id, slug, title, category, product_form, product_state, is_verified, is_demo, review_status, species!fk_assets_species(common_name, scientific_name), asset_keywords(keywords(term))')
      .in('publication_status', ['approved', 'commercial', 'editorial'])
      .not('species_id', 'is', null)
      .limit(limit * 2), // fetch more to filter client-side

    // Search via search_aliases (validated species names written by human validation)
    supabase
      .from('assets')
      .select('id, slug, title, category, product_form, product_state, is_verified, is_demo, review_status, asset_keywords(keywords(term))')
      .in('publication_status', ['approved', 'commercial', 'editorial'])
      .not('search_aliases', 'is', null)
      .contains('search_aliases', [q.toLowerCase()])
      .limit(limit),
  ]);

  const results: LibrarySearchResult[] = [];
  const seen = new Set<string>();

  const mapAsset = (a: any, speciesName?: string | null): LibrarySearchResult => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    product_form: a.product_form,
    product_state: a.product_state,
    is_verified: a.is_verified,
    is_demo: a.is_demo,
    review_status: a.review_status,
    species_name: speciesName || a.species?.common_name || null,
    keywords: a.asset_keywords?.map((ak: any) => ak.keywords?.term).filter(Boolean) || [],
  });

  // 1. Direct text matches
  (directRes.data || []).forEach((a: any) => {
    if (!seen.has(a.id)) { seen.add(a.id); results.push(mapAsset(a)); }
  });

  // 2. Species-matched assets (filter by species name containing query)
  (speciesRes.data || []).forEach((a: any) => {
    if (seen.has(a.id)) return;
    const sp = a.species;
    if (!sp) return;
    const spName = sp.common_name || sp.scientific_name || '';
    const sciName = sp.scientific_name || '';
    if (
      spName.toLowerCase().includes(q.toLowerCase()) ||
      sciName.toLowerCase().includes(q.toLowerCase())
    ) {
      seen.add(a.id);
      results.push(mapAsset(a, spName));
    }
  });

  // 3. Alias-matched assets (validated species names)
  (aliasRes.data || []).forEach((a: any) => {
    if (!seen.has(a.id)) { seen.add(a.id); results.push(mapAsset(a)); }
  });

  return results.slice(0, limit);
}
