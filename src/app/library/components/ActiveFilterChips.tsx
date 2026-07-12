'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { FilterState } from './LibraryContent';

interface ActiveFilterChipsProps {
  filters: FilterState;
  onClearFilter: (key: keyof FilterState) => void;
  onClearAll: () => void;
  activeCount: number;
}

export default function ActiveFilterChips({
  filters,
  onClearFilter,
  onClearAll,
  activeCount,
}: ActiveFilterChipsProps) {
  if (activeCount === 0) return null;

  const chips: { label: string; key: keyof FilterState }[] = [];

  if (filters.query) chips.push({ label: `"${filters.query}"`, key: 'query' });
  if (filters.verified === true) chips.push({ label: 'Verified only', key: 'verified' });
  if (filters.realPhoto === true) chips.push({ label: 'Real Photo only', key: 'realPhoto' });
  filters.category.forEach((v) => chips.push({ label: v, key: 'category' }));
  filters.species.forEach((v) => chips.push({ label: v, key: 'species' }));
  filters.productForm.forEach((v) => chips.push({ label: v, key: 'productForm' }));
  filters.productState.forEach((v) => chips.push({ label: v, key: 'productState' }));
  filters.orientation.forEach((v) => chips.push({ label: v, key: 'orientation' }));
  filters.licenseType.forEach((v) => chips.push({ label: v, key: 'licenseType' }));
  filters.faoArea.forEach((v) => chips.push({ label: v, key: 'faoArea' }));

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
      {chips.map((chip, i) => (
        <button
          key={`chip-${chip.key}-${i}`}
          onClick={() => onClearFilter(chip.key)}
          className="filter-chip-active inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 hover:opacity-80"
        >
          {chip.label}
          <X size={10} />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-coral-500 transition-colors duration-150 underline underline-offset-2 ml-1"
      >
        Clear all
      </button>
    </div>
  );
}