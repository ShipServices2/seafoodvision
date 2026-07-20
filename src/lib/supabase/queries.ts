'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  Profile,
  CompanyProfile,
  Species,
  Asset,
  Favorite,
  Collection,
  CollectionItem,
  CatalogStats,
  Category,
  ImportBatch,
} from './types';

// ============================================================
// CATALOG STATS
// ============================================================

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const supabase = createClient();
  const enableDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true';

  try {
    const baseFilter = enableDemo ? {} : { is_demo: false };
    const publicStatuses = ['approved', 'commercial', 'editorial', 'preview_only'];

    const [totalResult, verifiedResult, speciesResult, categoryResult, videoResult, photoResult] =
      await Promise.all([
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('is_demo', false)
          .in('review_status', publicStatuses),
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('is_demo', false)
          .eq('is_verified', true)
          .in('review_status', publicStatuses),
        supabase
          .from('species')
          .select('*', { count: 'exact', head: true })
          .eq('is_demo', false),
        supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('is_demo', false)
          .eq('media_type', 'video')
          .in('review_status', publicStatuses),
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('is_demo', false)
          .eq('media_type', 'photo')
          .in('review_status', publicStatuses),
      ]);

    return {
      totalAssets: totalResult.count ?? 0,
      verifiedAssets: verifiedResult.count ?? 0,
      speciesCount: speciesResult.count ?? 0,
      categoryCount: categoryResult.count ?? 0,
      videoCount: videoResult.count ?? 0,
      photoCount: photoResult.count ?? 0,
      loading: false,
      error: null,
    };
  } catch (err) {
    return {
      totalAssets: 0,
      verifiedAssets: 0,
      speciesCount: 0,
      categoryCount: 0,
      videoCount: 0,
      photoCount: 0,
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to load stats',
    };
  }
}

// ============================================================
// SPECIES
// ============================================================

export async function fetchSpeciesList(limit = 50): Promise<Species[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .order('common_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('fetchSpeciesList error:', error.message);
    return [];
  }
  return (data as Species[]) || [];
}

export async function fetchSpeciesBySlug(slug: string): Promise<Species | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('fetchSpeciesBySlug error:', error.message);
    return null;
  }
  return data as Species | null;
}

export async function fetchSpeciesAssets(
  speciesId: string,
  limit = 12
): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*, species!fk_assets_species(id, slug, common_name, scientific_name, family, category), asset_files(id, file_level, storage_bucket, storage_path, mime_type, width_px, height_px, file_size_bytes)')
    .eq('species_id', speciesId)
    .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
    .neq('publication_status', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchSpeciesAssets error:', error.message);
    return [];
  }
  return (data as Asset[]) || [];
}

export async function fetchSpeciesMediaCount(speciesId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('species_id', speciesId)
    .eq('is_demo', false)
    .in('review_status', ['approved', 'commercial', 'editorial']);

  if (error) return 0;
  return count ?? 0;
}

// ============================================================
// CATEGORIES
// ============================================================

export async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('fetchCategories error:', error.message);
    return [];
  }
  return (data as Category[]) || [];
}

// ============================================================
// FAVORITES
// ============================================================

export async function fetchUserFavorites(userId: string): Promise<Favorite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select(
      `id, user_id, asset_id, created_at,
       assets(id, slug, title, category, is_verified, is_real_photo, is_demo, media_type,
         species!fk_assets_species(common_name, scientific_name))`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchUserFavorites error:', error.message);
    return [];
  }
  return (data as unknown as Favorite[]) || [];
}

export async function checkIsFavorited(userId: string, assetId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function addFavorite(userId: string, assetId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, asset_id: assetId });

  if (error) {
    console.error('addFavorite error:', error.message);
    return false;
  }
  return true;
}

export async function removeFavorite(userId: string, assetId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('asset_id', assetId);

  if (error) {
    console.error('removeFavorite error:', error.message);
    return false;
  }
  return true;
}

// ============================================================
// COLLECTIONS
// ============================================================

export async function fetchUserCollections(userId: string): Promise<Collection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchUserCollections error:', error.message);
    return [];
  }
  return (data as Collection[]) || [];
}

export async function fetchCollectionById(
  collectionId: string,
  userId: string
): Promise<Collection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('id', collectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchCollectionById error:', error.message);
    return null;
  }
  return data as Collection | null;
}

export async function fetchCollectionItems(
  collectionId: string
): Promise<CollectionItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collection_items')
    .select(
      `id, collection_id, asset_id, added_at,
       assets(id, slug, title, category, is_verified, is_real_photo, is_demo,
         species!fk_assets_species(common_name, scientific_name))`
    )
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('fetchCollectionItems error:', error.message);
    return [];
  }
  return (data as unknown as CollectionItem[]) || [];
}

export async function createCollection(
  userId: string,
  name: string,
  description?: string
): Promise<Collection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name, description: description || null, is_private: true })
    .select()
    .single();

  if (error) {
    console.error('createCollection error:', error.message);
    return null;
  }
  return data as Collection;
}

export async function updateCollection(
  collectionId: string,
  userId: string,
  updates: { name?: string; description?: string }
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('collections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', collectionId)
    .eq('user_id', userId);

  if (error) {
    console.error('updateCollection error:', error.message);
    return false;
  }
  return true;
}

export async function deleteCollection(
  collectionId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', collectionId)
    .eq('user_id', userId);

  if (error) {
    console.error('deleteCollection error:', error.message);
    return false;
  }
  return true;
}

export async function addToCollection(
  collectionId: string,
  assetId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, asset_id: assetId });

  if (error) {
    if (error.code === '23505') return true; // Already exists
    console.error('addToCollection error:', error.message);
    return false;
  }
  return true;
}

export async function removeFromCollection(
  collectionId: string,
  assetId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('asset_id', assetId);

  if (error) {
    console.error('removeFromCollection error:', error.message);
    return false;
  }
  return true;
}

// ============================================================
// PROFILE
// ============================================================

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchProfile error:', error.message);
    return null;
  }
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'company' | 'country'>>
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('updateProfile error:', error.message);
    return false;
  }
  return true;
}

export async function fetchCompanyProfile(userId: string): Promise<CompanyProfile | null> {
  const supabase = createClient();
  // company_profiles doesn't have user_id — check if there's a link via profiles
  // For now, fetch by contact_email matching the user's email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.email) return null;

  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('contact_email', profile.email)
    .maybeSingle();

  if (error) {
    console.error('fetchCompanyProfile error:', error.message);
    return null;
  }
  return data as CompanyProfile | null;
}

export async function upsertCompanyProfile(
  userId: string,
  profileData: Partial<CompanyProfile>
): Promise<boolean> {
  const supabase = createClient();

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!userProfile?.email) return false;

  const { error } = await supabase.from('company_profiles').upsert(
    {
      ...profileData,
      contact_email: userProfile.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'contact_email' }
  );

  if (error) {
    console.error('upsertCompanyProfile error:', error.message);
    return false;
  }
  return true;
}

// ============================================================
// ADMIN QUERIES
// ============================================================

export async function fetchAdminAssets(
  page = 1,
  pageSize = 20,
  status?: string,
  query?: string
): Promise<{ assets: Asset[]; total: number }> {
  const supabase = createClient();

  let q = supabase
    .from('assets')
    .select('*, species!fk_assets_species(id, slug, common_name, scientific_name)', { count: 'exact' });

  if (status) q = q.eq('review_status', status);
  if (query) q = q.ilike('title', `%${query}%`);

  q = q
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;

  if (error) {
    console.error('fetchAdminAssets error:', error.message);
    return { assets: [], total: 0 };
  }
  return { assets: (data as Asset[]) || [], total: count ?? 0 };
}

export async function updateAssetStatus(
  assetId: string,
  newStatus: string,
  changedBy: string,
  reason?: string
): Promise<boolean> {
  const supabase = createClient();

  const { data: current } = await supabase
    .from('assets')
    .select('review_status')
    .eq('id', assetId)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from('assets')
    .update({ review_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', assetId);

  if (updateError) {
    console.error('updateAssetStatus error:', updateError.message);
    return false;
  }

  // Record history
  await supabase.from('asset_status_history').insert({
    asset_id: assetId,
    changed_by: changedBy,
    old_status: current?.review_status || null,
    new_status: newStatus,
    reason: reason || null,
  });

  return true;
}

export async function fetchAdminSpecies(
  page = 1,
  pageSize = 20
): Promise<{ species: Species[]; total: number }> {
  const supabase = createClient();
  const { data, error, count } = await supabase
    .from('species')
    .select('*', { count: 'exact' })
    .order('common_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error('fetchAdminSpecies error:', error.message);
    return { species: [], total: 0 };
  }
  return { species: (data as Species[]) || [], total: count ?? 0 };
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('fetchAdminCategories error:', error.message);
    return [];
  }
  return (data as Category[]) || [];
}

// ============================================================
// EXTENDED CATALOG STATS (real vs demo separation)
// ============================================================

export async function fetchExtendedCatalogStats(): Promise<{
  realAssets: number;
  demoAssets: number;
  realSpecies: number;
  demoSpecies: number;
  underReview: number;
  previewOnly: number;
}> {
  const supabase = createClient();

  const [realAssetsRes, demoAssetsRes, realSpeciesRes, demoSpeciesRes, underReviewRes, previewOnlyRes] =
    await Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_demo', false),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_demo', true),
      supabase.from('species').select('*', { count: 'exact', head: true }).eq('is_demo', false),
      supabase.from('species').select('*', { count: 'exact', head: true }).eq('is_demo', true),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_demo', false).eq('review_status', 'under_review'),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_demo', false).eq('review_status', 'preview_only'),
    ]);

  return {
    realAssets: realAssetsRes.count ?? 0,
    demoAssets: demoAssetsRes.count ?? 0,
    realSpecies: realSpeciesRes.count ?? 0,
    demoSpecies: demoSpeciesRes.count ?? 0,
    underReview: underReviewRes.count ?? 0,
    previewOnly: previewOnlyRes.count ?? 0,
  };
}

// ============================================================
// IMPORT BATCHES
// ============================================================

export async function fetchImportBatches(limit = 10): Promise<ImportBatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchImportBatches error:', error.message);
    return [];
  }
  return (data as ImportBatch[]) || [];
}

// ============================================================
// ASSET STATUS PROMOTION (admin)
// ============================================================

export async function promoteAssetStatus(
  assetId: string,
  newStatus: string,
  changedBy: string,
  reason?: string
): Promise<boolean> {
  return updateAssetStatus(assetId, newStatus, changedBy, reason);
}
