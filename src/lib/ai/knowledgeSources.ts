// ============================================================
// SEAFOOD VISION — Knowledge Source Connectors (Phase 8)
// FishBase, WoRMS, FAO ASFIS, Catalogue of Life, GBIF
// Enrichment only — NEVER auto-publish data
// ============================================================

export interface KnowledgeSourceResult {
  source: string;
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  order?: string;
  class?: string;
  kingdom?: string;
  synonyms?: string[];
  faoCode?: string;
  iucnStatus?: string;
  habitat?: string;
  distribution?: string;
  confidence: number;
  rawData?: Record<string, unknown>;
}

// ============================================================
// FishBase Connector
// ============================================================

export async function queryFishBase(scientificName: string): Promise<KnowledgeSourceResult | null> {
  try {
    // FishBase REST API — public endpoint, no key required for basic queries
    const encoded = encodeURIComponent(scientificName);
    const res = await fetch(`https://fishbase.ropensci.org/species?sciname=${encoded}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sp = data?.data?.[0];
    if (!sp) return null;
    return {
      source: 'FishBase',
      scientificName: `${sp.Genus} ${sp.Species}`,
      commonNames: sp.FBname ? [sp.FBname] : [],
      family: sp.Family ?? '',
      genus: sp.Genus ?? '',
      order: sp.Order ?? undefined,
      class: sp.Class ?? undefined,
      confidence: 85,
      rawData: sp,
    };
  } catch {
    return null;
  }
}

// ============================================================
// WoRMS Connector
// ============================================================

export async function queryWoRMS(scientificName: string): Promise<KnowledgeSourceResult | null> {
  try {
    const encoded = encodeURIComponent(scientificName);
    const res = await fetch(
      `https://www.marinespecies.org/rest/AphiaRecordsByName/${encoded}?like=false&marine_only=false&offset=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const sp = Array.isArray(data) ? data[0] : null;
    if (!sp) return null;
    return {
      source: 'WoRMS',
      scientificName: sp.scientificname ?? scientificName,
      commonNames: [],
      family: sp.family ?? '',
      genus: sp.genus ?? '',
      order: sp.order ?? undefined,
      class: sp.class ?? undefined,
      kingdom: sp.kingdom ?? undefined,
      confidence: 90,
      rawData: sp,
    };
  } catch {
    return null;
  }
}

// ============================================================
// GBIF Connector
// ============================================================

export async function queryGBIF(scientificName: string): Promise<KnowledgeSourceResult | null> {
  try {
    const encoded = encodeURIComponent(scientificName);
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encoded}&strict=false`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.canonicalName) return null;
    return {
      source: 'GBIF',
      scientificName: data.canonicalName,
      commonNames: [],
      family: data.family ?? '',
      genus: data.genus ?? '',
      order: data.order ?? undefined,
      class: data.class ?? undefined,
      kingdom: data.kingdom ?? undefined,
      confidence: data.confidence ?? 70,
      rawData: data,
    };
  } catch {
    return null;
  }
}

// ============================================================
// Catalogue of Life Connector
// ============================================================

export async function queryCatalogueOfLife(scientificName: string): Promise<KnowledgeSourceResult | null> {
  try {
    const encoded = encodeURIComponent(scientificName);
    const res = await fetch(
      `https://api.catalogueoflife.org/nameusage/search?q=${encoded}&limit=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const sp = data?.result?.[0];
    if (!sp) return null;
    return {
      source: 'Catalogue of Life',
      scientificName: sp.name?.scientificName ?? scientificName,
      commonNames: sp.vernacularNames?.map((v: { name: string }) => v.name) ?? [],
      family: sp.classification?.find((c: { rank: string; name: string }) => c.rank === 'family')?.name ?? '',
      genus: sp.classification?.find((c: { rank: string; name: string }) => c.rank === 'genus')?.name ?? '',
      confidence: 80,
      rawData: sp,
    };
  } catch {
    return null;
  }
}

// ============================================================
// Enrichment Aggregator
// Queries all enabled sources and merges results
// NEVER auto-publishes — returns enrichment data for human review
// ============================================================

export async function enrichSpeciesFromKnowledgeSources(
  scientificName: string,
  sources: string[] = ['FishBase', 'WoRMS', 'GBIF', 'Catalogue of Life']
): Promise<{
  enrichments: KnowledgeSourceResult[];
  mergedFamily: string;
  mergedGenus: string;
  allCommonNames: string[];
  highestConfidence: number;
  note: string;
}> {
  const queries: Promise<KnowledgeSourceResult | null>[] = [];

  if (sources.includes('FishBase')) queries.push(queryFishBase(scientificName));
  if (sources.includes('WoRMS')) queries.push(queryWoRMS(scientificName));
  if (sources.includes('GBIF')) queries.push(queryGBIF(scientificName));
  if (sources.includes('Catalogue of Life')) queries.push(queryCatalogueOfLife(scientificName));

  const results = await Promise.allSettled(queries);
  const enrichments: KnowledgeSourceResult[] = results
    .filter((r): r is PromiseFulfilledResult<KnowledgeSourceResult> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  const allCommonNames = [...new Set(enrichments.flatMap((e) => e.commonNames))];
  const families = enrichments.map((e) => e.family).filter(Boolean);
  const genera = enrichments.map((e) => e.genus).filter(Boolean);
  const mergedFamily = families[0] ?? '';
  const mergedGenus = genera[0] ?? '';
  const highestConfidence = enrichments.length > 0 ? Math.max(...enrichments.map((e) => e.confidence)) : 0;

  return {
    enrichments,
    mergedFamily,
    mergedGenus,
    allCommonNames,
    highestConfidence,
    note: 'Enrichment data — requires human validation before publication. Never auto-published.',
  };
}
