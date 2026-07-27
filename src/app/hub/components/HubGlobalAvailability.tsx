'use client';

import React, { useState } from 'react';
import { Globe, MapPin, Lock, Coins } from 'lucide-react';
import Link from 'next/link';
import type { EncMarket } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  markets: EncMarket[];
  faoAreas: string[] | null;
  worldDistribution: string | null;
  hasSubscription: boolean;
  userCredits: number;
  onUseCredits: (feature: string, credits: number) => Promise<boolean>;
}

const MARKET_TYPE_COLOR: Record<string, string> = {
  export: 'bg-blue-50 text-blue-700',
  import: 'bg-purple-50 text-purple-700',
  domestic: 'bg-green-50 text-green-700',
  wholesale: 'bg-amber-50 text-amber-700',
  retail: 'bg-teal-50 text-teal-700',
};

// Simplified world map regions for visual display
const WORLD_REGIONS = [
  { id: 'north_america', label: 'North America', x: 15, y: 30 },
  { id: 'south_america', label: 'South America', x: 25, y: 60 },
  { id: 'europe', label: 'Europe', x: 47, y: 25 },
  { id: 'africa', label: 'Africa', x: 47, y: 55 },
  { id: 'asia', label: 'Asia', x: 68, y: 30 },
  { id: 'oceania', label: 'Oceania', x: 78, y: 65 },
];

export default function HubGlobalAvailability({ markets, faoAreas, worldDistribution, hasSubscription, userCredits, onUseCredits }: Props) {
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const handleUnlockAdvancedMap = async () => {
    setUnlocking(true);
    const success = await onUseCredits('global_map_advanced', 1);
    if (success) setAdvancedUnlocked(true);
    setUnlocking(false);
  };

  const visibleMarkets = hasSubscription ? markets : markets.slice(0, 3);
  const lockedCount = markets.length - visibleMarkets.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Global Availability</h3>
        {markets.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{markets.length} markets</span>
        )}
      </div>

      {/* Distribution summary — free */}
      {worldDistribution && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-secondary" />
            <p className="text-xs font-semibold text-foreground">World Distribution</p>
          </div>
          <p className="text-sm text-muted-foreground">{worldDistribution}</p>
        </div>
      )}

      {/* FAO Areas */}
      {faoAreas && faoAreas.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">FAO Fishing Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {faoAreas.map((a) => (
              <span key={a} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-mono">{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Simple visual map placeholder */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Availability Map</p>
          {!advancedUnlocked && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Coins size={11} /> 1 credit for advanced view
            </span>
          )}
        </div>
        <div className="relative bg-gradient-to-br from-blue-50 to-teal-50 h-40 flex items-center justify-center">
          {/* Simple dot map */}
          <div className="relative w-full h-full">
            {WORLD_REGIONS.map((region) => (
              <div
                key={region.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${region.x}%`, top: `${region.y}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-secondary/60 border-2 border-secondary" title={region.label} />
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-muted-foreground bg-white/80 px-3 py-1.5 rounded-full">
                🌍 Global distribution overview
              </p>
            </div>
          </div>
          {!advancedUnlocked && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
              <button
                onClick={handleUnlockAdvancedMap}
                disabled={unlocking || userCredits < 1}
                className="flex items-center gap-2 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-50"
              >
                <Coins size={12} />
                {unlocking ? 'Unlocking…' : userCredits < 1 ? 'Need 1 credit' : 'View advanced map (1 credit)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Markets list */}
      {markets.length > 0 && (
        <>
          <div className="space-y-2">
            {visibleMarkets.map((m) => (
              <div key={m.id} className="bg-card rounded-xl border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  {m.region && <p className="text-xs text-muted-foreground">{m.region}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${MARKET_TYPE_COLOR[m.market_type] || 'bg-muted text-muted-foreground'}`}>
                  {m.market_type}
                </span>
              </div>
            ))}
          </div>

          {!hasSubscription && lockedCount > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Lock size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">{lockedCount} more markets locked</p>
                <p className="text-xs text-muted-foreground mb-2">Access all global market data with a Professional subscription.</p>
                <Link href="/pricing" className="text-xs text-secondary font-medium hover:underline">Upgrade →</Link>
              </div>
            </div>
          )}
        </>
      )}

      {markets.length === 0 && !worldDistribution && (!faoAreas || faoAreas.length === 0) && (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Globe size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No global availability data for this species.</p>
        </div>
      )}
    </div>
  );
}
