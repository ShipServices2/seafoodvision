'use client';

import { createClient } from '@/lib/supabase/client';

export interface AssetFile {
  id: string;
  asset_id: string;
  file_level: 'original' | 'preview' | 'thumbnail';
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface AssetRow {
  id: string;
  public_asset_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  media_type: string;
  category: string | null;
  species_id: string | null;
  product_form: string | null;
  product_state: string | null;
  freezing_method: string | null;
  packaging: string | null;
  country: string | null;
  fao_area: string | null;
  orientation: string | null;
  width_px: number | null;
  height_px: number | null;
  file_format: string | null;
  file_size_bytes: number | null;
  color_space: string | null;
  capture_period: string | null;
  license_type: string | null;
  commercial_use: boolean;
  editorial_use: boolean;
  rights_info: string | null;
  restrictions: string | null;
  is_real_photo: boolean;
  is_verified: boolean;
  review_status: string;
  publication_status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  // joined
  species?: {
    id: string;
    slug: string;
    common_name: string;
    scientific_name: string;
    family: string | null;
    category: string | null;
  } | null;
  asset_keywords?: { keywords: { term: string } }[];
  asset_files?: AssetFile[];
}

export interface AssetFilters {
  query?: string;
  mediaType?: string[];
  category?: string[];
  species?: string[];
  productForm?: string[];
  productState?: string[];
  orientation?: string[];
  licenseType?: string[];
  faoArea?: string[];
  verified?: boolean | null;
  realPhoto?: boolean | null;
}

export type SortOption = 'newest' | 'oldest' | 'title-az' | 'title-za' | 'most-relevant';

// Minimal type for asset_files entries (compatible with both AssetRow and Asset)
interface AssetFileEntry {
  file_level: string;
  storage_bucket: string;
  storage_path: string;
}

interface AssetWithFiles {
  asset_files?: AssetFileEntry[] | null;
}

/**
 * Get a signed URL for a private Supabase Storage object via the server API.
 * NEVER uses getPublicUrl on private buckets.
 * Returns null if bucket or path is missing or object doesn't exist.
 */
export async function getSignedStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!bucket || !path) return null;
  // Never expose asset-originals
  if (bucket === 'asset-originals') return null;
  try {
    const params = new URLSearchParams({ bucket, path, expiresIn: String(expiresIn) });
    const res = await fetch(`/api/storage/signed-url?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.signedUrl || null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getSignedStorageUrl instead for private buckets.
 * Kept for backward compatibility only — returns null to force signed URL usage.
 */
export function getAssetStorageUrl(
  _bucket: string | null | undefined,
  _path: string | null | undefined
): string | null {
  // Private buckets require signed URLs — return null to trigger fallback
  // Use getSignedStorageUrl() for actual URL generation
  return null;
}

/**
 * Get the best available thumbnail file entry for an asset.
 * Priority: thumbnail > preview
 * Returns the AssetFileEntry or null.
 */
export function getAssetThumbnailFile(asset: AssetWithFiles): AssetFileEntry | null {
  const files = asset.asset_files;
  if (!files || files.length === 0) return null;
  return (
    files.find((f) => f.file_level === 'thumbnail') ||
    files.find((f) => f.file_level === 'preview') ||
    null
  );
}

/**
 * Get the best available preview file entry for an asset.
 * Priority: preview > thumbnail
 * Returns the AssetFileEntry or null.
 */
export function getAssetPreviewFile(asset: AssetWithFiles): AssetFileEntry | null {
  const files = asset.asset_files;
  if (!files || files.length === 0) return null;
  return (
    files.find((f) => f.file_level === 'preview') ||
    files.find((f) => f.file_level === 'thumbnail') ||
    null
  );
}

/**
 * @deprecated Synchronous URL helpers no longer work for private buckets.
 * Use getSignedStorageUrl(file.storage_bucket, file.storage_path) instead.
 */
export function getAssetThumbnailUrl(_asset: AssetWithFiles): string | null {
  return null;
}

/**
 * @deprecated Synchronous URL helpers no longer work for private buckets.
 * Use getSignedStorageUrl(file.storage_bucket, file.storage_path) instead.
 */
export function getAssetPreviewUrl(_asset: AssetWithFiles): string | null {
  return null;
}

export async function fetchAssets(
  filters: AssetFilters,
  sort: SortOption,
  page: number,
  pageSize: number
): Promise<{ assets: AssetRow[]; total: number }> {
  const supabase = createClient();

  let query = supabase
    .from('assets')
    .select(
      `*, species!fk_assets_species(id, slug, common_name, scientific_name, family, category), asset_keywords(keywords(term)), asset_files(id, file_level, storage_bucket, storage_path, mime_type, width_px, height_px, file_size_bytes)`,
      { count: 'exact' }
    )
    // Only show publicly visible assets (defense-in-depth alongside RLS)
    .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
    .neq('publication_status', 'archived');

  // Text search — searches text columns; alias search handled separately below
  if (filters.query) {
    const q = filters.query;
    query = query.or(
      `title.ilike.%${q}%,product_form.ilike.%${q}%,country.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
    );
  }

  // Media type filter
  if (filters.mediaType?.length) {
    query = query.in('media_type', filters.mediaType);
  }

  // Category filter
  if (filters.category?.length) {
    query = query.in('category', filters.category);
  }

  // Product form filter
  if (filters.productForm?.length) {
    query = query.in('product_form', filters.productForm);
  }

  // Product state filter
  if (filters.productState?.length) {
    query = query.in('product_state', filters.productState);
  }

  // Orientation filter
  if (filters.orientation?.length) {
    query = query.in('orientation', filters.orientation);
  }

  // License type filter
  if (filters.licenseType?.length) {
    query = query.in('license_type', filters.licenseType);
  }

  // FAO area filter
  if (filters.faoArea?.length) {
    query = query.in('fao_area', filters.faoArea);
  }

  // Verified filter
  if (filters.verified === true) {
    query = query.eq('is_verified', true);
  }

  // Real photo filter
  if (filters.realPhoto === true) {
    query = query.eq('is_real_photo', true);
  }

  // Sorting
  switch (sort) {
    case 'title-az':
      query = query.order('title', { ascending: true });
      break;
    case 'title-za':
      query = query.order('title', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    // "Requested range not satisfiable" (PGRST103) means the page is beyond
    // the total result count — treat as empty page, not a fatal error.
    if (
      error.message?.includes('Requested range not satisfiable') ||
      (error as { code?: string }).code === 'PGRST103'
    ) {
      return { assets: [], total: 0 };
    }
    console.error('fetchAssets error:', error.message);
    return { assets: [], total: 0 };
  }

  let assets = (data as AssetRow[]) || [];
  let total = count ?? 0;

  // If a text query is present, also search by search_aliases (validated species names)
  // and merge results (dedup by id), boosting total count
  if (filters.query && page === 1) {
    try {
      const q = filters.query.toLowerCase().trim();
      const { data: aliasData } = await supabase
        .from('assets')
        .select(
          `*, species!fk_assets_species(id, slug, common_name, scientific_name, family, category), asset_keywords(keywords(term)), asset_files(id, file_level, storage_bucket, storage_path, mime_type, width_px, height_px, file_size_bytes)`
        )
        .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
        .neq('publication_status', 'archived')
        .not('search_aliases', 'is', null)
        .contains('search_aliases', [q])
        .limit(pageSize);

      if (aliasData && aliasData.length > 0) {
        const existingIds = new Set(assets.map((a) => a.id));
        const newFromAliases = (aliasData as AssetRow[]).filter((a) => !existingIds.has(a.id));
        if (newFromAliases.length > 0) {
          assets = [...assets, ...newFromAliases].slice(0, pageSize);
          total = total + newFromAliases.length;
        }
      }
    } catch {
      // Non-fatal: alias search failure doesn't break main results
    }
  }

  return { assets, total };
}

export async function fetchAssetBySlug(slug: string): Promise<AssetRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('assets')
    .select(
      `*, species!fk_assets_species(id, slug, common_name, scientific_name, family, category), asset_keywords(keywords(term)), asset_files(id, file_level, storage_bucket, storage_path, mime_type, width_px, height_px, file_size_bytes)`
    )
    .eq('slug', slug)
    // Only return publicly visible assets for the public detail page
    .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
    .neq('publication_status', 'archived')
    .maybeSingle();

  if (error) {
    console.error('fetchAssetBySlug error:', error.message);
    return null;
  }
  return data as AssetRow | null;
}

export async function fetchSimilarAssets(
  currentId: string,
  category: string | null,
  limit = 4
): Promise<AssetRow[]> {
  const supabase = createClient();

  let query = supabase
    .from('assets')
    .select(`id, slug, title, category, is_verified, is_real_photo, species!fk_assets_species(common_name, scientific_name), asset_files(id, file_level, storage_bucket, storage_path)`)
    .neq('id', currentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchSimilarAssets error:', error.message);
    return [];
  }
  return (data as unknown as AssetRow[]) || [];
}
