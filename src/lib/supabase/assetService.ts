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

/**
 * Generate a public URL for a file stored in Supabase Storage.
 * Returns null if bucket or path is missing.
 */
export function getAssetStorageUrl(
  bucket: string | null | undefined,
  path: string | null | undefined
): string | null {
  if (!bucket || !path) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

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
 * Get the best available image URL for an asset from its asset_files.
 * Priority: thumbnail > preview > original
 * Returns null if no files are available.
 */
export function getAssetThumbnailUrl(asset: AssetWithFiles): string | null {
  const files = asset.asset_files;
  if (!files || files.length === 0) return null;
  const thumbnail = files.find((f) => f.file_level === 'thumbnail');
  if (thumbnail) return getAssetStorageUrl(thumbnail.storage_bucket, thumbnail.storage_path);
  const preview = files.find((f) => f.file_level === 'preview');
  if (preview) return getAssetStorageUrl(preview.storage_bucket, preview.storage_path);
  const original = files.find((f) => f.file_level === 'original');
  if (original) return getAssetStorageUrl(original.storage_bucket, original.storage_path);
  return null;
}

/**
 * Get the preview URL for an asset (for the detail page viewer).
 * Priority: preview > thumbnail > original
 */
export function getAssetPreviewUrl(asset: AssetWithFiles): string | null {
  const files = asset.asset_files;
  if (!files || files.length === 0) return null;
  const preview = files.find((f) => f.file_level === 'preview');
  if (preview) return getAssetStorageUrl(preview.storage_bucket, preview.storage_path);
  const thumbnail = files.find((f) => f.file_level === 'thumbnail');
  if (thumbnail) return getAssetStorageUrl(thumbnail.storage_bucket, thumbnail.storage_path);
  const original = files.find((f) => f.file_level === 'original');
  if (original) return getAssetStorageUrl(original.storage_bucket, original.storage_path);
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
    );

  // Text search
  if (filters.query) {
    query = query.or(
      `title.ilike.%${filters.query}%,product_form.ilike.%${filters.query}%,country.ilike.%${filters.query}%`
    );
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
    console.error('fetchAssets error:', error.message);
    return { assets: [], total: 0 };
  }

  return { assets: (data as AssetRow[]) || [], total: count ?? 0 };
}

export async function fetchAssetBySlug(slug: string): Promise<AssetRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('assets')
    .select(
      `*, species!fk_assets_species(id, slug, common_name, scientific_name, family, category), asset_keywords(keywords(term)), asset_files(id, file_level, storage_bucket, storage_path, mime_type, width_px, height_px, file_size_bytes)`
    )
    .eq('slug', slug)
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
  limit = 6
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

  return (data as AssetRow[]) || [];
}
