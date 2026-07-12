'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  AssistantRelatedEntity,
  AssistantRelatedMedia,
  AssistantSource,
} from './types';
import { PUBLIC_STATUSES } from './types';

// ============================================================
// PHASE 5.4 — RETRIEVAL ENGINE
// Only fetches public, verified, non-confidential data
// Never exposes private paths, GPS, emails, secrets
// ============================================================

export interface RetrievalContext {
  entities: AssistantRelatedEntity[];
  sources: AssistantSource[];
  media: AssistantRelatedMedia[];
  facts: string[];
  locale: string;
  query: string;
  detected_types: string[];
}

export async function retrieveContext(
  query: string,
  locale: string = 'en',
  contextEntities: AssistantRelatedEntity[] = []
): Promise<RetrievalContext> {
  const supabase = await createClient();
  const q = query.trim();
  const entities: AssistantRelatedEntity[] = [];
  const sources: AssistantSource[] = [];
  const media: AssistantRelatedMedia[] = [];
  const facts: string[] = [];
  const detected_types: string[] = [];

  // ---- 1. Try RPC search_seafood_knowledge ----
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_seafood_knowledge', {
    query_text: q,
    result_types: null,
    language_code: locale,
    status_filter: null,
    verified_only: true,
    include_demo: false,
    p_page: 1,
    p_page_size: 20,
  });

  if (!rpcError && rpcData && rpcData.length > 0) {
    for (const r of rpcData.slice(0, 15)) {
      const href = buildHref(r.object_type, r.slug, r.object_id);
      entities.push({
        id: r.object_id,
        type: r.object_type,
        title: r.title,
        subtitle: r.subtitle,
        slug: r.slug,
        href,
        cover_image: r.cover_image,
        status: r.status,
      });
      if (!detected_types.includes(r.object_type)) detected_types.push(r.object_type);
      sources.push({
        id: `src-${r.object_id}`,
        source_type: r.object_type,
        source_id: r.object_id,
        source_title: r.title,
        source_url: href,
        relevance_score: r.relevance_score,
        citation_order: sources.length + 1,
      });
    }
  } else {
    // ---- 2. Fallback: direct table queries ----
    await fallbackRetrieval(supabase, q, entities, sources, detected_types);
  }

  // ---- 3. Fetch related media (thumbnails only, no originals) ----
  if (entities.length > 0) {
    const speciesIds = entities.filter(e => e.type === 'species').map(e => e.id).slice(0, 3);
    if (speciesIds.length > 0) {
      const { data: mediaData } = await supabase
        .from('assets')
        .select('id, slug, title, category')
        .in('species_id', speciesIds)
        .in('review_status', ['approved', 'commercial', 'editorial'])
        .eq('is_demo', false)
        .limit(6);
      (mediaData || []).forEach((m: any) => {
        media.push({
          id: m.id,
          slug: m.slug,
          title: m.title,
          category: m.category,
          href: `/asset/${m.slug}`,
        });
      });
    }
  }

  // ---- 4. Build facts from top entities ----
  for (const entity of entities.slice(0, 5)) {
    if (entity.type === 'species') {
      const detail = await fetchSpeciesDetail(supabase, entity.id);
      if (detail) facts.push(...detail);
    } else if (entity.type === 'product') {
      facts.push(`Product: ${entity.title}${entity.subtitle ? ` — ${entity.subtitle}` : ''}`);
    } else if (entity.type === 'certification') {
      facts.push(`Certification: ${entity.title}${entity.subtitle ? ` (${entity.subtitle})` : ''}`);
    } else if (entity.type === 'market') {
      facts.push(`Market: ${entity.title}${entity.subtitle ? ` — ${entity.subtitle}` : ''}`);
    }
  }

  return { entities, sources, media, facts, locale, query: q, detected_types };
}

async function fallbackRetrieval(
  supabase: any,
  q: string,
  entities: AssistantRelatedEntity[],
  sources: AssistantSource[],
  detected_types: string[]
) {
  const [speciesRes, productRes, certRes, marketRes, docRes] = await Promise.all([
    supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, family, category, is_validated')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`)
      .eq('is_demo', false)
      .limit(8),
    supabase
      .from('commercial_products')
      .select('id, slug, public_name, description, status')
      .eq('is_public', true)
      .eq('is_demo', false)
      .ilike('public_name', `%${q}%`)
      .limit(6),
    supabase
      .from('certifications')
      .select('id, slug, name, certification_type, status')
      .eq('is_public', true)
      .ilike('name', `%${q}%`)
      .limit(4),
    supabase
      .from('markets')
      .select('id, slug, name, market_type, status')
      .eq('is_public', true)
      .or(`name.ilike.%${q}%,region.ilike.%${q}%`)
      .limit(4),
    supabase
      .from('documents')
      .select('id, public_title, status')
      .eq('is_public', true)
      .eq('confidentiality_level', 'public')
      .ilike('public_title', `%${q}%`)
      .limit(3),
  ]);

  const addEntity = (type: string, id: string, title: string, subtitle?: string, slug?: string) => {
    const href = buildHref(type, slug || null, id);
    entities.push({ id, type, title, subtitle, slug, href });
    sources.push({
      id: `src-${id}`,
      source_type: type,
      source_id: id,
      source_title: title,
      source_url: href,
      relevance_score: 0.8,
      citation_order: sources.length + 1,
    });
    if (!detected_types.includes(type)) detected_types.push(type);
  };

  (speciesRes.data || []).forEach((s: any) => {
    if (s.is_validated) addEntity('species', s.id, s.common_name, s.scientific_name, s.slug);
  });
  (productRes.data || []).forEach((p: any) => {
    if (PUBLIC_STATUSES.includes(p.status)) addEntity('product', p.id, p.public_name, undefined, p.slug);
  });
  (certRes.data || []).forEach((c: any) => {
    if (PUBLIC_STATUSES.includes(c.status)) addEntity('certification', c.id, c.name, c.certification_type, c.slug);
  });
  (marketRes.data || []).forEach((m: any) => {
    if (PUBLIC_STATUSES.includes(m.status)) addEntity('market', m.id, m.name, m.market_type, m.slug);
  });
  (docRes.data || []).forEach((d: any) => {
    if (PUBLIC_STATUSES.includes(d.status)) addEntity('document', d.id, d.public_title, undefined, undefined);
  });
}

async function fetchSpeciesDetail(supabase: any, speciesId: string): Promise<string[]> {
  const facts: string[] = [];
  const { data: sp } = await supabase
    .from('species')
    .select('common_name, scientific_name, family, category, fao_areas, description, is_validated')
    .eq('id', speciesId)
    .maybeSingle();
  if (!sp) return facts;
  if (sp.common_name) facts.push(`Common name: ${sp.common_name}`);
  if (sp.scientific_name) facts.push(`Scientific name: ${sp.scientific_name}`);
  if (sp.family) facts.push(`Family: ${sp.family}`);
  if (sp.category) facts.push(`Category: ${sp.category}`);
  if (sp.fao_areas?.length) facts.push(`FAO areas: ${sp.fao_areas.join(', ')}`);
  if (sp.description) facts.push(sp.description.slice(0, 300));

  // Commercial names
  const { data: names } = await supabase
    .from('species_names')
    .select('name, language_code, name_type')
    .eq('species_id', speciesId)
    .in('status', ['verified'])
    .limit(8);
  if (names?.length) {
    const nameList = names.map((n: any) => `${n.name} (${n.language_code})`).join(', ');
    facts.push(`Commercial names: ${nameList}`);
  }
  return facts;
}

function buildHref(type: string, slug: string | null, id: string): string {
  switch (type) {
    case 'species': return slug ? `/species/${slug}` : `/species`;
    case 'product': return slug ? `/products/${slug}` : `/products`;
    case 'media': return slug ? `/asset/${slug}` : `/library`;
    case 'certification': return slug ? `/knowledge/search?q=${encodeURIComponent(slug)}` : `/knowledge`;
    case 'market': return slug ? `/knowledge/search?q=${encodeURIComponent(slug)}` : `/knowledge`;
    case 'document': return `/knowledge/sources`;
    default: return `/knowledge/search?q=${encodeURIComponent(id)}`;
  }
}

// ---- Media-specific retrieval ----
export async function retrieveMedia(
  query: string,
  locale: string = 'en'
): Promise<AssistantRelatedMedia[]> {
  const supabase = await createClient();
  const q = query.trim();
  const { data } = await supabase
    .from('assets')
    .select('id, slug, title, category, description')
    .in('review_status', ['approved', 'commercial', 'editorial'])
    .eq('is_demo', false)
    .or(`title.ilike.%${q}%,category.ilike.%${q}%,product_form.ilike.%${q}%`)
    .limit(12);
  return (data || []).map((m: any) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    category: m.category,
    href: `/asset/${m.slug}`,
  }));
}

// ---- Comparison retrieval ----
export async function retrieveForComparison(
  terms: string[],
  locale: string = 'en'
): Promise<AssistantRelatedEntity[][]> {
  const results: AssistantRelatedEntity[][] = [];
  for (const term of terms.slice(0, 3)) {
    const ctx = await retrieveContext(term, locale);
    results.push(ctx.entities.slice(0, 3));
  }
  return results;
}
