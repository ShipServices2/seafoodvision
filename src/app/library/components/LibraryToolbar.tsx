'use client';

import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, ChevronDown } from 'lucide-react';
import type { FilterState, SortOption, ViewMode } from './LibraryContent';

interface LibraryToolbarProps {
  filters: FilterState;
  sort: SortOption;
  viewMode: ViewMode;
  filtersOpen: boolean;
  activeFilterCount: number;
  totalResults: number;
  onQueryChange: (q: string) => void;
  onSortChange: (s: SortOption) => void;
  onViewModeChange: (v: ViewMode) => void;
  onToggleFilters: () => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-az', label: 'Title A–Z' },
  { value: 'title-za', label: 'Title Z–A' },
  { value: 'most-relevant', label: 'Most relevant' },
];

export default function LibraryToolbar({
  filters,
  sort,
  viewMode,
  filtersOpen,
  activeFilterCount,
  totalResults,
  onQueryChange,
  onSortChange,
  onViewModeChange,
  onToggleFilters,
}: LibraryToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-lg">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search species, scientific name, product form…"
          className="input-base pl-9 pr-4"
          aria-label="Search library"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Filter toggle */}
        <button
          onClick={onToggleFilters}
          className={`hidden md:flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
            filtersOpen || activeFilterCount > 0
              ? 'border-secondary bg-secondary/8 text-secondary' :'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-secondary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="input-base pr-8 appearance-none cursor-pointer min-w-[160px]"
            aria-label="Sort assets"
          >
            {sortOptions.map((opt) => (
              <option key={`sort-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* View mode */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2.5 transition-colors duration-150 ${
              viewMode === 'grid' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2.5 transition-colors duration-150 border-l border-border ${
              viewMode === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List size={15} />
          </button>
        </div>

        {/* Results count */}
        <span className="text-xs text-muted-foreground font-mono-data whitespace-nowrap hidden lg:block">
          {totalResults.toLocaleString()} results
        </span>
      </div>
    </div>
  );
}