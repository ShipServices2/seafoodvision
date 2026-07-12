'use client';

import React, { useState, useCallback, useEffect } from 'react';
import LibraryFilters from './LibraryFilters';
import LibraryGrid from './LibraryGrid';
import LibraryToolbar from './LibraryToolbar';
import ActiveFilterChips from './ActiveFilterChips';
import { fetchAssets, type AssetRow, type SortOption } from '@/lib/supabase/assetService';

export type { SortOption };
export type ViewMode = 'grid' | 'list';

export interface FilterState {
  query: string;
  mediaType: string[];
  category: string[];
  species: string[];
  productForm: string[];
  productState: string[];
  freezingMethod: string[];
  packaging: string[];
  country: string[];
  faoArea: string[];
  orientation: string[];
  licenseType: string[];
  verified: boolean | null;
  realPhoto: boolean | null;
}

const defaultFilters: FilterState = {
  query: '',
  mediaType: [],
  category: [],
  species: [],
  productForm: [],
  productState: [],
  freezingMethod: [],
  packaging: [],
  country: [],
  faoArea: [],
  orientation: [],
  licenseType: [],
  verified: null,
  realPhoto: null,
};

// Map AssetRow to the shape LibraryGrid expects (compatible with DemoAsset shape)
function mapAssetRow(asset: AssetRow) {
  const keywords = asset.asset_keywords?.map((ak) => ak.keywords?.term).filter(Boolean) || [];
  const dims =
    asset.width_px && asset.height_px ? `${asset.width_px} × ${asset.height_px} px` : '—';

  // Emoji/color based on category
  const categoryEmoji: Record<string, { emoji: string; bgColor: string }> = {
    Fish: { emoji: '🐟', bgColor: 'from-blue-200 to-blue-100' },
    Crustaceans: { emoji: '🦐', bgColor: 'from-orange-200 to-orange-100' },
    Cephalopods: { emoji: '🐙', bgColor: 'from-purple-200 to-purple-100' },
    Molluscs: { emoji: '🦪', bgColor: 'from-teal-200 to-teal-100' },
    'Fillets & Portions': { emoji: '🍣', bgColor: 'from-red-200 to-red-100' },
    'Frozen Products': { emoji: '🧊', bgColor: 'from-cyan-200 to-cyan-100' },
    Packaging: { emoji: '📦', bgColor: 'from-slate-200 to-slate-100' },
    Aquaculture: { emoji: '🌊', bgColor: 'from-emerald-200 to-emerald-100' },
  };
  const meta = categoryEmoji[asset.category || ''] || { emoji: '🐠', bgColor: 'from-blue-200 to-blue-100' };

  return {
    id: asset.id,
    slug: asset.slug,
    title: asset.title,
    species: asset.species?.common_name || asset.category || '',
    scientificName: asset.species?.scientific_name || '',
    family: asset.species?.family || '',
    category: asset.category || '',
    productForm: asset.product_form || '',
    productState: asset.product_state || '',
    freezingMethod: asset.freezing_method || 'N/A',
    packaging: asset.packaging || 'None',
    country: asset.country || '',
    faoArea: asset.fao_area || '',
    orientation: asset.orientation || '',
    licenseType: asset.license_type || 'commercial',
    isVerified: asset.is_verified,
    isRealPhoto: asset.is_real_photo,
    mediaType: asset.media_type || 'Photo',
    dimensions: dims,
    format: asset.file_format || 'JPEG',
    status: asset.review_status,
    keywords,
    isDemo: asset.is_demo,
    emoji: meta.emoji,
    bgColor: meta.bgColor,
  };
}

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48];

export default function LibraryContent() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [assets, setAssets] = useState<ReturnType<typeof mapAssetRow>[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { assets: rows, total } = await fetchAssets(
        {
          query: filters.query,
          category: filters.category,
          productForm: filters.productForm,
          productState: filters.productState,
          orientation: filters.orientation,
          licenseType: filters.licenseType,
          faoArea: filters.faoArea,
          verified: filters.verified,
          realPhoto: filters.realPhoto,
        },
        sort,
        currentPage,
        itemsPerPage
      );
      setAssets(rows.map(mapAssetRow));
      setTotalResults(total);
    } catch {
      setAssets([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [filters, sort, currentPage, itemsPerPage]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilter = useCallback((key: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [key]: defaultFilters[key] }));
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(totalResults / itemsPerPage);

  const activeFilterCount = [
    filters.query,
    ...filters.category,
    ...filters.species,
    ...filters.productForm,
    ...filters.productState,
    ...filters.orientation,
    ...filters.licenseType,
    ...filters.faoArea,
    filters.verified !== null ? 'verified' : '',
    filters.realPhoto !== null ? 'realPhoto' : '',
  ].filter(Boolean).length;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Visual Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? (
            <span className="inline-block w-24 h-4 bg-muted rounded animate-pulse" />
          ) : (
            `${totalResults.toLocaleString()} asset${totalResults !== 1 ? 's' : ''} — verified real seafood photographs`
          )}
        </p>
      </div>

      <LibraryToolbar
        filters={filters}
        sort={sort}
        viewMode={viewMode}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        totalResults={totalResults}
        onQueryChange={(q) => updateFilter('query', q)}
        onSortChange={setSort}
        onViewModeChange={setViewMode}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />

      <ActiveFilterChips
        filters={filters}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
        activeCount={activeFilterCount}
      />

      <div className="flex gap-6 mt-5">
        {/* Filter panel */}
        {filtersOpen && (
          <aside className="w-64 xl:w-72 shrink-0 hidden md:block">
            <LibraryFilters
              filters={filters}
              onFilterChange={updateFilter}
              onClearAll={clearAllFilters}
            />
          </aside>
        )}

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: itemsPerPage }).map((_, i) => (
                <div key={`skel-${i}`} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-muted" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <h3 className="text-lg font-semibold text-foreground mb-2">No assets found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters or clearing them to see all available assets.' :'The catalog is being built. Check back soon for new seafood assets.'}
              </p>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="btn-outline mt-4">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <LibraryGrid
              assets={assets}
              viewMode={viewMode}
              totalResults={totalResults}
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}