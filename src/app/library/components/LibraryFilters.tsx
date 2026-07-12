'use client';

import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { FilterState } from './LibraryContent';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-4 last:border-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-150"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-3 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxOption({ label, checked, onChange }: CheckboxOptionProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-border accent-secondary cursor-pointer"
      />
      <span className="text-sm text-foreground group-hover:text-secondary transition-colors duration-150 flex-1">
        {label}
      </span>
    </label>
  );
}

// Static filter option labels only — no invented counts
const categoryOptions = [
  'Fish', 'Crustaceans', 'Cephalopods', 'Molluscs',
  'Fillets & Portions', 'Frozen Products', 'Packaging', 'Aquaculture',
];

const speciesOptions = [
  'Atlantic Mackerel', 'Common Octopus', 'Giant Tiger Prawn',
  'Yellowfin Tuna', 'European Pilchard', 'Common Cuttlefish', 'European Squid',
];

const productFormOptions = [
  'Whole, ungutted', 'Whole, gutted', 'Whole, uncleaned', 'Whole, cleaned',
  'Whole, fresh', 'Fillet, skin-on', 'Loin, skinless', 'Steak',
  'Headless shell-on', 'Peeled, deveined', 'Cleaned tube',
];

const productStateOptions = ['Fresh', 'Frozen', 'Chilled', 'Smoked', 'Dried'];

const faoAreaOptions = ['FAO 27', 'FAO 34', 'FAO 51', 'FAO 57', 'FAO 61', 'FAO 71', 'FAO 77'];

const orientationOptions = ['Landscape', 'Portrait', 'Square'];

const licenseOptions = ['commercial', 'editorial'];

interface LibraryFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
}

function toggleArrayValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function LibraryFilters({ filters, onFilterChange, onClearAll }: LibraryFiltersProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-5 scrollbar-thin overflow-y-auto max-h-[calc(100vh-160px)] sticky top-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-secondary transition-colors duration-150 flex items-center gap-1"
        >
          <X size={11} />
          Clear all
        </button>
      </div>

      {/* Verified status */}
      <FilterSection title="Quality Status" defaultOpen>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.realPhoto === true}
            onChange={(e) => onFilterChange('realPhoto', e.target.checked ? true : null)}
            className="w-3.5 h-3.5 rounded border-border accent-secondary cursor-pointer"
          />
          <span className="text-sm text-foreground group-hover:text-secondary transition-colors duration-150">
            Real Photo only
          </span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.verified === true}
            onChange={(e) => onFilterChange('verified', e.target.checked ? true : null)}
            className="w-3.5 h-3.5 rounded border-border accent-secondary cursor-pointer"
          />
          <span className="text-sm text-foreground group-hover:text-secondary transition-colors duration-150">
            Verified assets only
          </span>
        </label>
      </FilterSection>

      {/* License type */}
      <FilterSection title="License Type" defaultOpen>
        {licenseOptions.map((opt) => (
          <CheckboxOption
            key={`filter-license-${opt}`}
            label={opt.charAt(0).toUpperCase() + opt.slice(1)}
            checked={filters.licenseType.includes(opt)}
            onChange={() =>
              onFilterChange('licenseType', toggleArrayValue(filters.licenseType, opt))
            }
          />
        ))}
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category" defaultOpen>
        {categoryOptions.map((opt) => (
          <CheckboxOption
            key={`filter-cat-${opt}`}
            label={opt}
            checked={filters.category.includes(opt)}
            onChange={() =>
              onFilterChange('category', toggleArrayValue(filters.category, opt))
            }
          />
        ))}
      </FilterSection>

      {/* Species */}
      <FilterSection title="Species" defaultOpen={false}>
        {speciesOptions.map((opt) => (
          <CheckboxOption
            key={`filter-species-${opt}`}
            label={opt}
            checked={filters.species.includes(opt)}
            onChange={() =>
              onFilterChange('species', toggleArrayValue(filters.species, opt))
            }
          />
        ))}
      </FilterSection>

      {/* Product form */}
      <FilterSection title="Product Form" defaultOpen={false}>
        {productFormOptions.map((opt) => (
          <CheckboxOption
            key={`filter-form-${opt}`}
            label={opt}
            checked={filters.productForm.includes(opt)}
            onChange={() =>
              onFilterChange('productForm', toggleArrayValue(filters.productForm, opt))
            }
          />
        ))}
      </FilterSection>

      {/* Product state */}
      <FilterSection title="Product State" defaultOpen={false}>
        {productStateOptions.map((opt) => (
          <CheckboxOption
            key={`filter-state-${opt}`}
            label={opt}
            checked={filters.productState.includes(opt)}
            onChange={() =>
              onFilterChange('productState', toggleArrayValue(filters.productState, opt))
            }
          />
        ))}
      </FilterSection>

      {/* Orientation */}
      <FilterSection title="Orientation" defaultOpen={false}>
        {orientationOptions.map((opt) => (
          <CheckboxOption
            key={`filter-orient-${opt}`}
            label={opt}
            checked={filters.orientation.includes(opt)}
            onChange={() =>
              onFilterChange('orientation', toggleArrayValue(filters.orientation, opt))
            }
          />
        ))}
      </FilterSection>

      {/* FAO Area */}
      <FilterSection title="FAO Area" defaultOpen={false}>
        {faoAreaOptions.map((opt) => (
          <CheckboxOption
            key={`filter-fao-${opt}`}
            label={opt}
            checked={filters.faoArea.includes(opt)}
            onChange={() =>
              onFilterChange('faoArea', toggleArrayValue(filters.faoArea, opt))
            }
          />
        ))}
      </FilterSection>
    </div>
  );
}