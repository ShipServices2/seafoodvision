'use client';

import React from 'react';
import { Fish } from 'lucide-react';
import Link from 'next/link';
import type { EncSpecies } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  relatedSpecies: EncSpecies[];
  currentSpeciesId: string;
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

export default function HubSimilarSpecies({ relatedSpecies, currentSpeciesId }: Props) {
  const filtered = relatedSpecies.filter((s) => s.id !== currentSpeciesId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Fish size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Similar Species</h3>
        {filtered.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{filtered.length}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Fish size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No similar species found in the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const color = SPECIES_COLORS[s.category || ''] || 'from-slate-100 to-slate-50';
            const emoji = SPECIES_EMOJI[s.category || ''] || '🐠';
            return (
              <Link
                key={s.id}
                href={`/species/${s.slug}`}
                className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm hover:-translate-y-0.5 transition-all group"
              >
                <div className={`h-16 bg-gradient-to-br ${color} flex items-center justify-center`}>
                  <span className="text-3xl group-hover:scale-110 transition-transform">{emoji}</span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-foreground truncate">{s.common_name}</p>
                  <p className="text-xs font-mono text-muted-foreground italic truncate">{s.scientific_name}</p>
                  {s.family && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.family}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-700">
            ⚠️ Species similarity is based on taxonomy. Commercial substitution requires professional verification.
          </p>
        </div>
      )}
    </div>
  );
}
