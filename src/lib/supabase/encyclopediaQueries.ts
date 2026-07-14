'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// PHASE 5.2 / PHASE 7 — ENCYCLOPEDIA QUERIES
// All queries return only public, verified, non-confidential data
// ============================================================

// ---- Types ----

export interface EncSpecies {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  genus: string | null;
  family: string | null;
  order_name: string | null;
  category: string | null;
  fao_areas: string[] | null;
  fao_alpha3_code: string | null;
  taxonomic_status: string | null;
  validation_status: string | null;
  description: string | null;
  // Phase 7 extended fields
  habitat: string | null;
  habitat_depth: string | null;
  world_distribution: string | null;
  fishing_methods: string[] | null;
  aquaculture_methods: string[] | null;
  seasonality: Record<string, unknown> | null;
  size_info: Record<string, unknown> | null;
  nutritional_values: Record<string, unknown> | null;
  possible_certifications: string[] | null;
  commercial_forms: string[] | null;
  presentations: string[] | null;
  packaging_notes: string | null;
  conservation_methods: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  // flags
  is_demo: boolean;
  is_public: boolean | null;
  is_validated: boolean;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
  // computed
  media_count?: number;
  product_count?: number;
}

export interface EncSpeciesName {
  id: string;
  species_id: string;
  language_code: string;
  name: string;
  name_type: string;
  country_id: string | null;
  region: string | null;
  is_preferred: boolean;
  status: string;
}

export interface EncProduct {
  id: string;
  slug: string;
  public_name: string;
  description: string | null;
  product_form_id: string | null;
  processing_method_id: string | null;
  preservation_method_id: string | null;
  freezing_method_id: string | null;
  status: string;
  is_demo: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // joined
  product_forms?: { label: string } | null;
  processing_methods?: { label: string } | null;
  preservation_methods?: { label: string } | null;
  freezing_methods?: { label: string } | null;
  species?: { common_name: string; scientific_name: string; slug: string }[];
}

export interface EncPackaging {
  id: string;
  name: string;
  material: string | null;
  net_weight: number | null;
  gross_weight: number | null;
  weight_unit: string | null;
  units_per_package: number | null;
  packages_per_carton: number | null;
  cartons_per_pallet: number | null;
  pallet_type: string | null;
  dimensions: string | null;
  labeling_language: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
  // joined
  packaging_types?: { name: string; description: string | null } | null;
}

export interface EncMarket {
  id: string;
  slug: string;
  name: string;
  market_type: string;
  country_id: string | null;
  region: string | null;
  description: string | null;
  status: string;
  is_demo: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface EncCertification {
  id: string;
  slug: string;
  name: string;
  issuing_body: string | null;
  certification_type: string;
  description: string | null;
  verification_required: boolean;
  status: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface EncDocument {
  id: string;
  public_title: string;
  document_type_id: string | null;
  status: string;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  is_public: boolean;
  is_demo: boolean;
  created_at: string;
  // joined
  document_types?: { label: string } | null;
}

export interface EncSource {
  id: string;
  source_type: string;
  title: string | null;
  author_or_organization: string | null;
  reference: string | null;
  publication_date: string | null;
  reliability_level: string;
  confidentiality_level: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  type: 'species' | 'product' | 'packaging' | 'market' | 'certification' | 'document';
  title: string;
  subtitle: string | null;
  slug: string | null;
  status: string;
  is_demo: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================
// SPECIES
// ============================================================

export async function fetchEncSpeciesList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  family?: string;
  verifiedOnly?: boolean;
  hasPublicMedia?: boolean;
  hasProducts?: boolean;
}): Promise<PaginatedResult<EncSpecies>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, category, family, verifiedOnly } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('species')
    .select('*', { count: 'exact' })
    .order('common_name', { ascending: true })
    .range(from, to);

  if (search?.trim()) {
    // Search across scientific name, common name, family, and also species_names (synonyms/local)
    query = query.or(
      `common_name.ilike.%${search}%,scientific_name.ilike.%${search}%,family.ilike.%${search}%`
    );
  }
  if (category) query = query.eq('category', category);
  if (family) query = query.ilike('family', `%${family}%`);
  if (verifiedOnly) query = query.eq('is_validated', true);

  const { data, count, error } = await query;
  if (error) {
    console.error('fetchEncSpeciesList error:', error.message);
    return { data: [], total: 0, page, pageSize };
  }
  return { data: (data as EncSpecies[]) || [], total: count ?? 0, page, pageSize };
}

/**
 * Phase 7: Search species also by synonyms and local names from species_names table
 */
export async function fetchEncSpeciesListWithNames(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  verifiedOnly?: boolean;
}): Promise<PaginatedResult<EncSpecies>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, category, verifiedOnly } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!search?.trim()) {
    return fetchEncSpeciesList({ page, pageSize, category, verifiedOnly });
  }

  const q = search.trim();

  // First find species IDs matching via species_names (synonyms, local names)
  const { data: nameMatches } = await supabase
    .from('species_names')
    .select('species_id')
    .ilike('name', `%${q}%`)
    .limit(100);

  const matchedIds = nameMatches?.map((n: { species_id: string }) => n.species_id) || [];

  let query = supabase
    .from('species')
    .select('*', { count: 'exact' })
    .order('common_name', { ascending: true })
    .range(from, to);

  if (matchedIds.length > 0) {
    query = query.or(
      `common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%,id.in.(${matchedIds.join(',')})`
    );
  } else {
    query = query.or(
      `common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`
    );
  }

  if (category) query = query.eq('category', category);
  if (verifiedOnly) query = query.eq('is_validated', true);

  const { data, count, error } = await query;
  if (error) {
    console.error('fetchEncSpeciesListWithNames error:', error.message);
    return { data: [], total: 0, page, pageSize };
  }
  return { data: (data as EncSpecies[]) || [], total: count ?? 0, page, pageSize };
}

export async function fetchEncSpeciesBySlug(slug: string): Promise<EncSpecies | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) { console.error('fetchEncSpeciesBySlug error:', error.message); return null; }
  return data as EncSpecies | null;
}

export async function fetchSpeciesNames(speciesId: string): Promise<EncSpeciesName[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species_names')
    .select('*')
    .eq('species_id', speciesId)
    .in('status', ['verified', 'under_review'])
    .order('is_preferred', { ascending: false });
  if (error) { console.error('fetchSpeciesNames error:', error.message); return []; }
  return (data as EncSpeciesName[]) || [];
}

export async function fetchSpeciesProducts(speciesId: string): Promise<EncProduct[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_product_species')
    .select(`
      commercial_products(
        id, slug, public_name, description, status, is_demo, is_public, created_at, updated_at,
        product_forms(label),
        processing_methods(label),
        preservation_methods(label),
        freezing_methods(label)
      )
    `)
    .eq('species_id', speciesId)
    .eq('status', 'verified');
  if (error) { console.error('fetchSpeciesProducts error:', error.message); return []; }
  return (data?.map((r: any) => r.commercial_products).filter(Boolean) as EncProduct[]) || [];
}

export async function fetchSpeciesCertifications(speciesId: string): Promise<EncCertification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('certification_claims')
    .select(`certifications(id, slug, name, issuing_body, certification_type, description, verification_required, status, is_public, created_at, updated_at)`)
    .eq('subject_type', 'species')
    .eq('subject_id', speciesId)
    .in('claim_status', ['verified', 'document_received', 'under_verification']);
  if (error) { console.error('fetchSpeciesCertifications error:', error.message); return []; }
  return (data?.map((r: any) => r.certifications).filter(Boolean) as EncCertification[]) || [];
}

export async function fetchSpeciesMarkets(speciesId: string): Promise<EncMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species_markets')
    .select(`markets(id, slug, name, market_type, country_id, region, description, status, is_demo, is_public, created_at, updated_at)`)
    .eq('species_id', speciesId);
  if (error) { console.error('fetchSpeciesMarkets error:', error.message); return []; }
  return (data?.map((r: any) => r.markets).filter(Boolean) as EncMarket[]) || [];
}

export async function fetchSpeciesDocuments(speciesId: string): Promise<EncDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document_species')
    .select(`documents(id, public_title, status, issuing_body, issue_date, expiration_date, is_public, is_demo, created_at, document_types(label))`)
    .eq('species_id', speciesId);
  if (error) { console.error('fetchSpeciesDocuments error:', error.message); return []; }
  return (
    data
      ?.map((r: any) => r.documents)
      .filter((d: any) => d && d.is_public === true) as EncDocument[]
  ) || [];
}

export async function fetchRelatedSpecies(speciesId: string, limit = 4): Promise<EncSpecies[]> {
  const supabase = createClient();
  const { data: current } = await supabase.from('species').select('family, category').eq('id', speciesId).maybeSingle();
  if (!current) return [];
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .neq('id', speciesId)
    .or(`family.eq.${current.family},category.eq.${current.category}`)
    .limit(limit);
  if (error) return [];
  return (data as EncSpecies[]) || [];
}

// ============================================================
// ADMIN SPECIES QUERIES (Phase 7)
// ============================================================

export async function adminFetchSpeciesList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  validationStatus?: string;
}): Promise<PaginatedResult<EncSpecies>> {
  const supabase = createClient();
  const { page = 1, pageSize = 25, search, category, validationStatus } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('species')
    .select('*', { count: 'exact' })
    .order('common_name', { ascending: true })
    .range(from, to);

  if (search?.trim()) {
    query = query.or(
      `common_name.ilike.%${search}%,scientific_name.ilike.%${search}%,family.ilike.%${search}%`
    );
  }
  if (category) query = query.eq('category', category);
  if (validationStatus) query = query.eq('validation_status', validationStatus);

  const { data, count, error } = await query;
  if (error) {
    console.error('adminFetchSpeciesList error:', error.message);
    return { data: [], total: 0, page, pageSize };
  }
  return { data: (data as EncSpecies[]) || [], total: count ?? 0, page, pageSize };
}

export async function adminCreateSpecies(payload: Partial<EncSpecies>): Promise<EncSpecies | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species')
    .insert([payload])
    .select()
    .single();
  if (error) { console.error('adminCreateSpecies error:', error.message); return null; }
  return data as EncSpecies;
}

export async function adminUpdateSpecies(id: string, payload: Partial<EncSpecies>): Promise<EncSpecies | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('adminUpdateSpecies error:', error.message); return null; }
  return data as EncSpecies;
}

export async function adminLinkAssetToSpecies(speciesId: string, assetId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('asset_species')
    .upsert({ asset_id: assetId, species_id: speciesId });
  if (error) { console.error('adminLinkAssetToSpecies error:', error.message); return false; }
  return true;
}

export async function adminLinkDocumentToSpecies(speciesId: string, documentId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('document_species')
    .insert({ document_id: documentId, species_id: speciesId });
  if (error) { console.error('adminLinkDocumentToSpecies error:', error.message); return false; }
  return true;
}

export async function adminLinkProductToSpecies(speciesId: string, productId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('commercial_product_species')
    .upsert({ product_id: productId, species_id: speciesId, status: 'verified' });
  if (error) { console.error('adminLinkProductToSpecies error:', error.message); return false; }
  return true;
}

export async function adminAddSpeciesName(payload: Omit<EncSpeciesName, 'id'>): Promise<EncSpeciesName | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species_names')
    .insert([payload])
    .select()
    .single();
  if (error) { console.error('adminAddSpeciesName error:', error.message); return null; }
  return data as EncSpeciesName;
}

export async function adminDeleteSpeciesName(nameId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('species_names').delete().eq('id', nameId);
  if (error) { console.error('adminDeleteSpeciesName error:', error.message); return false; }
  return true;
}

// ============================================================
// PRODUCTS
// ============================================================

export async function fetchEncProductList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  verifiedOnly?: boolean;
}): Promise<PaginatedResult<EncProduct>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, verifiedOnly } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('commercial_products')
    .select(`
      id, slug, public_name, description, status, is_demo, is_public, created_at, updated_at,
      product_forms(label),
      processing_methods(label),
      preservation_methods(label),
      freezing_methods(label)
    `, { count: 'exact' })
    .eq('is_public', true)
    .order('public_name', { ascending: true })
    .range(from, to);

  if (search?.trim()) {
    query = query.ilike('public_name', `%${search}%`);
  }
  if (verifiedOnly) query = query.eq('status', 'verified');

  const { data, count, error } = await query;
  if (error) {
    console.error('fetchEncProductList error:', error.message);
    return { data: [], total: 0, page, pageSize };
  }
  return { data: (data as EncProduct[]) || [], total: count ?? 0, page, pageSize };
}

export async function fetchEncProductBySlug(slug: string): Promise<EncProduct | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_products')
    .select(`
      id, slug, public_name, description, status, is_demo, is_public, created_at, updated_at,
      product_forms(label),
      processing_methods(label),
      preservation_methods(label),
      freezing_methods(label)
    `)
    .eq('slug', slug)
    .maybeSingle();
  if (error) { console.error('fetchEncProductBySlug error:', error.message); return null; }
  return data as EncProduct | null;
}

export async function fetchProductSpecies(productId: string): Promise<EncSpecies[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_product_species')
    .select(`species(id, slug, common_name, scientific_name, family, category, is_demo, is_validated, created_at, updated_at)`)
    .eq('product_id', productId);
  if (error) { console.error('fetchProductSpecies error:', error.message); return []; }
  return (data?.map((r: any) => r.species).filter(Boolean) as EncSpecies[]) || [];
}

export async function fetchProductMarkets(productId: string): Promise<EncMarket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('product_markets')
    .select(`markets(id, slug, name, market_type, country_id, region, description, status, is_demo, is_public, created_at, updated_at)`)
    .eq('product_id', productId);
  if (error) { console.error('fetchProductMarkets error:', error.message); return []; }
  return (data?.map((r: any) => r.markets).filter(Boolean) as EncMarket[]) || [];
}

// ============================================================
// MARKETS
// ============================================================

export async function fetchEncMarketList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  marketType?: string;
}): Promise<PaginatedResult<EncMarket>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, marketType } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('markets')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .order('name', { ascending: true })
    .range(from, to);

  if (search?.trim()) query = query.ilike('name', `%${search}%`);
  if (marketType) query = query.eq('market_type', marketType);

  const { data, count, error } = await query;
  if (error) { console.error('fetchEncMarketList error:', error.message); return { data: [], total: 0, page, pageSize }; }
  return { data: (data as EncMarket[]) || [], total: count ?? 0, page, pageSize };
}

export async function fetchEncMarketBySlug(slug: string): Promise<EncMarket | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('markets').select('*').eq('slug', slug).maybeSingle();
  if (error) { console.error('fetchEncMarketBySlug error:', error.message); return null; }
  return data as EncMarket | null;
}

// ============================================================
// CERTIFICATIONS
// ============================================================

export async function fetchEncCertificationList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  certType?: string;
}): Promise<PaginatedResult<EncCertification>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, certType } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('certifications')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .order('name', { ascending: true })
    .range(from, to);

  if (search?.trim()) query = query.ilike('name', `%${search}%`);
  if (certType) query = query.eq('certification_type', certType);

  const { data, count, error } = await query;
  if (error) { console.error('fetchEncCertificationList error:', error.message); return { data: [], total: 0, page, pageSize }; }
  return { data: (data as EncCertification[]) || [], total: count ?? 0, page, pageSize };
}

export async function fetchEncCertificationBySlug(slug: string): Promise<EncCertification | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('certifications').select('*').eq('slug', slug).maybeSingle();
  if (error) { console.error('fetchEncCertificationBySlug error:', error.message); return null; }
  return data as EncCertification | null;
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function fetchEncDocumentList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  docType?: string;
}): Promise<PaginatedResult<EncDocument>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search, docType } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('documents')
    .select(`id, public_title, status, issuing_body, issue_date, expiration_date, is_public, is_demo, created_at, document_types(label)`, { count: 'exact' })
    .eq('is_public', true)
    .eq('confidentiality_level', 'public')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search?.trim()) query = query.ilike('public_title', `%${search}%`);

  const { data, count, error } = await query;
  if (error) { console.error('fetchEncDocumentList error:', error.message); return { data: [], total: 0, page, pageSize }; }
  return { data: (data as EncDocument[]) || [], total: count ?? 0, page, pageSize };
}

// ============================================================
// PACKAGING
// ============================================================

export async function fetchEncPackagingList(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResult<EncPackaging>> {
  const supabase = createClient();
  const { page = 1, pageSize = 24, search } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('packaging_configurations')
    .select(`id, name, material, net_weight, gross_weight, weight_unit, units_per_package, packages_per_carton, cartons_per_pallet, pallet_type, dimensions, labeling_language, status, is_demo, created_at, packaging_types(name, description)`, { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (search?.trim()) query = query.ilike('name', `%${search}%`);

  const { data, count, error } = await query;
  if (error) { console.error('fetchEncPackagingList error:', error.message); return { data: [], total: 0, page, pageSize }; }
  return { data: (data as EncPackaging[]) || [], total: count ?? 0, page, pageSize };
}

// ============================================================
// SOURCES (public only)
// ============================================================

export async function fetchPublicSources(opts: {
  page?: number;
  pageSize?: number;
  sourceType?: string;
}): Promise<PaginatedResult<EncSource>> {
  const supabase = createClient();
  const { page = 1, pageSize = 30, sourceType } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('knowledge_sources')
    .select('id, source_type, title, author_or_organization, reference, publication_date, reliability_level, confidentiality_level, created_at', { count: 'exact' })
    .eq('confidentiality_level', 'public')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sourceType) query = query.eq('source_type', sourceType);

  const { data, count, error } = await query;
  if (error) { console.error('fetchPublicSources error:', error.message); return { data: [], total: 0, page, pageSize }; }
  return { data: (data as EncSource[]) || [], total: count ?? 0, page, pageSize };
}

// ============================================================
// GLOBAL SEARCH
// ============================================================

export async function encyclopediaSearch(query: string, limit = 30): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const supabase = createClient();
  const q = query.trim();

  const [speciesRes, speciesNamesRes, productRes, marketRes, certRes, docRes] = await Promise.all([
    supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, is_demo, is_validated')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`)
      .limit(8),
    supabase
      .from('species_names')
      .select('species_id, name')
      .ilike('name', `%${q}%`)
      .limit(10),
    supabase
      .from('commercial_products')
      .select('id, slug, public_name, status, is_demo')
      .eq('is_public', true)
      .ilike('public_name', `%${q}%`)
      .limit(8),
    supabase
      .from('markets')
      .select('id, slug, name, market_type, status, is_demo')
      .eq('is_public', true)
      .ilike('name', `%${q}%`)
      .limit(5),
    supabase
      .from('certifications')
      .select('id, slug, name, certification_type, status')
      .eq('is_public', true)
      .ilike('name', `%${q}%`)
      .limit(5),
    supabase
      .from('documents')
      .select('id, public_title, status, is_demo')
      .eq('is_public', true)
      .eq('confidentiality_level', 'public')
      .ilike('public_title', `%${q}%`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];
  const seenSpeciesIds = new Set<string>();

  speciesRes.data?.forEach((s: any) => {
    seenSpeciesIds.add(s.id);
    results.push({
      id: s.id, type: 'species', title: s.common_name,
      subtitle: s.scientific_name, slug: s.slug,
      status: s.is_validated ? 'verified' : 'unverified', is_demo: s.is_demo,
    });
  });

  // Add species found via synonym/local name search (avoid duplicates)
  if (speciesNamesRes.data && speciesNamesRes.data.length > 0) {
    const nameSpeciesIds = [...new Set(speciesNamesRes.data.map((n: any) => n.species_id))].filter(id => !seenSpeciesIds.has(id));
    if (nameSpeciesIds.length > 0) {
      const { data: extraSpecies } = await supabase
        .from('species')
        .select('id, slug, common_name, scientific_name, is_demo, is_validated')
        .in('id', nameSpeciesIds)
        .limit(5);
      extraSpecies?.forEach((s: any) => {
        const matchedName = speciesNamesRes.data?.find((n: any) => n.species_id === s.id);
        results.push({
          id: s.id, type: 'species', title: s.common_name,
          subtitle: matchedName ? `"${matchedName.name}" — ${s.scientific_name}` : s.scientific_name,
          slug: s.slug, status: s.is_validated ? 'verified' : 'unverified', is_demo: s.is_demo,
        });
      });
    }
  }

  productRes.data?.forEach((p: any) => results.push({
    id: p.id, type: 'product', title: p.public_name,
    subtitle: null, slug: p.slug, status: p.status, is_demo: p.is_demo,
  }));
  marketRes.data?.forEach((m: any) => results.push({
    id: m.id, type: 'market', title: m.name,
    subtitle: m.market_type, slug: m.slug, status: m.status, is_demo: m.is_demo,
  }));
  certRes.data?.forEach((c: any) => results.push({
    id: c.id, type: 'certification', title: c.name,
    subtitle: c.certification_type, slug: c.slug, status: c.status, is_demo: false,
  }));
  docRes.data?.forEach((d: any) => results.push({
    id: d.id, type: 'document', title: d.public_title,
    subtitle: null, slug: null, status: d.status, is_demo: d.is_demo,
  }));

  return results.slice(0, limit);
}

// ============================================================
// KNOWLEDGE STATS (public summary)
// ============================================================

export async function fetchKnowledgeStats() {
  const supabase = createClient();
  const [sp, prod, pkg, mkt, cert, doc] = await Promise.all([
    supabase.from('species').select('*', { count: 'exact', head: true }).eq('is_demo', false),
    supabase.from('commercial_products').select('*', { count: 'exact', head: true }).eq('is_public', true).eq('is_demo', false),
    supabase.from('packaging_configurations').select('*', { count: 'exact', head: true }).eq('is_demo', false),
    supabase.from('markets').select('*', { count: 'exact', head: true }).eq('is_public', true).eq('is_demo', false),
    supabase.from('certifications').select('*', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('is_public', true).eq('confidentiality_level', 'public'),
  ]);
  return {
    species: sp.count ?? 0,
    products: prod.count ?? 0,
    packaging: pkg.count ?? 0,
    markets: mkt.count ?? 0,
    certifications: cert.count ?? 0,
    documents: doc.count ?? 0,
  };
}
