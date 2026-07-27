'use client';

import React from 'react';
import { CircleCheck as CheckCircle, Fish, MapPin, Anchor, Leaf, Scale, FlaskConical } from 'lucide-react';
import type { EncSpecies } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  species: EncSpecies;
}

const SPECIES_COLORS: Record<string, string> = {
  Fish: 'from-blue-200 to-blue-50',
  Crustaceans: 'from-orange-200 to-orange-50',
  Cephalopods: 'from-purple-200 to-purple-50',
  Molluscs: 'from-teal-200 to-teal-50',
  Aquaculture: 'from-green-200 to-green-50',
};
const SPECIES_EMOJI: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪', Aquaculture: '🌊',
};

function InfoRow({ label, value, mono = false, italic = false }: { label: string; value: string; mono?: boolean; italic?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''} ${italic ? 'italic' : ''}`}>{value}</span>
    </div>
  );
}

export default function HubSpeciesIdentity({ species }: Props) {
  const color = SPECIES_COLORS[species.category || ''] || 'from-slate-200 to-slate-50';
  const emoji = SPECIES_EMOJI[species.category || ''] || '🐠';
  const nutrition = species.nutritional_values as Record<string, string | number> | null;
  const sizeInfo = species.size_info as Record<string, string | number> | null;
  const seasonality = species.seasonality as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${color} h-36 flex items-center justify-center`}>
        <span className="text-8xl">{emoji}</span>
        <div className="absolute top-3 left-3 flex gap-2">
          {species.is_validated && (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold">
              <CheckCircle size={10} /> Verified
            </span>
          )}
          {species.category && (
            <span className="text-xs bg-white/80 text-foreground border border-border px-2.5 py-1 rounded-full font-medium">
              {species.category}
            </span>
          )}
        </div>
      </div>

      {/* Core identity */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-xl font-bold text-foreground mb-0.5">{species.common_name}</h2>
        <p className="text-sm italic text-muted-foreground mb-4">{species.scientific_name}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Family" value={species.family || '—'} />
          <InfoRow label="Order" value={species.order_name || '—'} />
          <InfoRow label="Genus" value={species.genus || '—'} mono italic />
          <InfoRow label="FAO Alpha-3" value={species.fao_alpha3_code || '—'} mono />
          <InfoRow label="Taxonomic Status" value={species.taxonomic_status || '—'} />
          <InfoRow label="Validation" value={species.validation_status?.replace('_', ' ') || '—'} />
        </div>
      </div>

      {/* Description */}
      {species.description && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{species.description}</p>
        </div>
      )}

      {/* Habitat */}
      {(species.habitat || species.world_distribution || species.habitat_depth) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="text-secondary" />
            <h3 className="text-sm font-semibold text-foreground">Habitat & Distribution</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {species.habitat && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Habitat</p>
                <p className="text-sm text-foreground">{species.habitat}</p>
              </div>
            )}
            {species.habitat_depth && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Depth Range</p>
                <p className="text-sm text-foreground">{species.habitat_depth}</p>
              </div>
            )}
            {species.world_distribution && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">World Distribution</p>
                <p className="text-sm text-foreground">{species.world_distribution}</p>
              </div>
            )}
            {species.fao_areas && species.fao_areas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">FAO Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {species.fao_areas.map((a) => (
                    <span key={a} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fishing methods */}
      {((species.fishing_methods && species.fishing_methods.length > 0) ||
        (species.aquaculture_methods && species.aquaculture_methods.length > 0)) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Anchor size={15} className="text-secondary" />
            <h3 className="text-sm font-semibold text-foreground">Fishing & Aquaculture</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {species.fishing_methods && species.fishing_methods.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Fishing Methods</p>
                <div className="flex flex-wrap gap-1.5">
                  {species.fishing_methods.map((m) => <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m}</span>)}
                </div>
              </div>
            )}
            {species.aquaculture_methods && species.aquaculture_methods.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Aquaculture Methods</p>
                <div className="flex flex-wrap gap-1.5">
                  {species.aquaculture_methods.map((m) => <span key={m} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{m}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seasonality */}
      {seasonality && Object.keys(seasonality).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Leaf size={15} className="text-secondary" />
            <h3 className="text-sm font-semibold text-foreground">Seasonality</h3>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month) => {
              const key = month.toLowerCase();
              const val = (seasonality as Record<string, unknown>)[key];
              const available = val === true || val === 'peak' || val === 'available';
              const peak = val === 'peak';
              return (
                <div key={month} className={`text-center py-1.5 rounded-lg text-xs font-medium ${
                  peak ? 'bg-secondary text-white' : available ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'
                }`}>
                  {month.slice(0, 1)}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-secondary inline-block" />Peak</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-secondary/10 inline-block" />Available</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded bg-muted inline-block" />Off-season</span>
          </div>
        </div>
      )}

      {/* Size & Nutritional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sizeInfo && Object.keys(sizeInfo).length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Scale size={15} className="text-secondary" />
              <h3 className="text-sm font-semibold text-foreground">Sizes & Weights</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(sizeInfo).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-semibold text-foreground font-mono">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {nutrition && Object.keys(nutrition).length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical size={15} className="text-secondary" />
              <h3 className="text-sm font-semibold text-foreground">Nutritional Values <span className="text-xs font-normal text-muted-foreground">per 100g</span></h3>
            </div>
            <div className="space-y-2">
              {Object.entries(nutrition).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-semibold text-foreground font-mono">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
