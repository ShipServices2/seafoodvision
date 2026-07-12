'use client';

import React, { useState, useCallback } from 'react';
import LibraryFilters from './LibraryFilters';
import LibraryGrid from './LibraryGrid';
import LibraryToolbar from './LibraryToolbar';
import ActiveFilterChips from './ActiveFilterChips';
import { allDemoAssets } from './libraryData';

export type SortOption = 'newest' | 'oldest' | 'title-az' | 'title-za' | 'most-relevant';
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

function applyFilters(assets: typeof allDemoAssets, filters: FilterState) {
  return assets.filter((asset) => {
    if (
      filters.query &&
      !asset.title.toLowerCase().includes(filters.query.toLowerCase()) &&
      !asset.scientificName.toLowerCase().includes(filters.query.toLowerCase()) &&
      !asset.species.toLowerCase().includes(filters.query.toLowerCase())
    ) {
      return false;
    }
    if (filters.category.length && !filters.category.includes(asset.category)) return false;
    if (filters.species.length && !filters.species.includes(asset.species)) return false;
    if (filters.productForm.length && !filters.productForm.includes(asset.productForm)) return false;
    if (filters.productState.length && !filters.productState.includes(asset.productState)) return false;
    if (filters.orientation.length && !filters.orientation.includes(asset.orientation)) return false;
    if (filters.licenseType.length && !filters.licenseType.includes(asset.licenseType)) return false;
    if (filters.faoArea.length && !filters.faoArea.includes(asset.faoArea)) return false;
    if (filters.verified !== null && asset.isVerified !== filters.verified) return false;
    if (filters.realPhoto !== null && asset.isRealPhoto !== filters.realPhoto) return false;
    return true;
  });
}

function applySorting(assets: typeof allDemoAssets, sort: SortOption) {
  const sorted = [...assets];
  switch (sort) {
    case 'title-az':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-za':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'oldest':
      return sorted.sort((a, b) => a.id.localeCompare(b.id));
    case 'newest':
    default:
      return sorted.sort((a, b) => b.id.localeCompare(a.id));
  }
}

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48];

export default function LibraryContent() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

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

  const filtered = applyFilters(allDemoAssets, filters);
  const sorted = applySorting(filtered, sort);
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
          {filtered.length.toLocaleString()} assets — verified real seafood photographs
        </p>
      </div>

      <LibraryToolbar
        filters={filters}
        sort={sort}
        viewMode={viewMode}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        totalResults={filtered.length}
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
          <LibraryGrid
            assets={paginated}
            viewMode={viewMode}
            totalResults={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
          />
        </div>
      </div>
    </div>
  );
}