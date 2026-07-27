'use client';

import React from 'react';
import { Package2, Lock } from 'lucide-react';
import Link from 'next/link';
import type { EncPackaging } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  packaging: EncPackaging[];
  packagingNotes: string | null;
  conservationMethods: string[] | null;
  hasSubscription: boolean;
}

export default function HubPackagingLibrary({ packaging, packagingNotes, conservationMethods, hasSubscription }: Props) {
  const visiblePackaging = hasSubscription ? packaging : packaging.slice(0, 2);
  const lockedCount = packaging.length - visiblePackaging.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package2 size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Packaging Library</h3>
        {packaging.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{packaging.length}</span>
        )}
      </div>

      {/* Conservation methods — free tier */}
      {conservationMethods && conservationMethods.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Conservation Methods</p>
          <div className="flex flex-wrap gap-1.5">
            {conservationMethods.map((m) => (
              <span key={m} className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full">{m}</span>
            ))}
          </div>
        </div>
      )}

      {packagingNotes && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Packaging Notes</p>
          <p className="text-sm text-foreground">{packagingNotes}</p>
        </div>
      )}

      {packaging.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Package2 size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No packaging configurations documented yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visiblePackaging.map((pkg) => (
              <div key={pkg.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{pkg.name}</h4>
                  {pkg.packaging_types?.name && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">{pkg.packaging_types.name}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {pkg.net_weight && (
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Net Weight</p>
                      <p className="text-xs font-semibold text-foreground">{pkg.net_weight} {pkg.weight_unit || 'kg'}</p>
                    </div>
                  )}
                  {pkg.units_per_package && (
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Units/Pkg</p>
                      <p className="text-xs font-semibold text-foreground">{pkg.units_per_package}</p>
                    </div>
                  )}
                  {pkg.packages_per_carton && (
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Pkgs/Carton</p>
                      <p className="text-xs font-semibold text-foreground">{pkg.packages_per_carton}</p>
                    </div>
                  )}
                  {pkg.cartons_per_pallet && (
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Cartons/Pallet</p>
                      <p className="text-xs font-semibold text-foreground">{pkg.cartons_per_pallet}</p>
                    </div>
                  )}
                </div>
                {pkg.material && (
                  <p className="text-xs text-muted-foreground mt-2">Material: <span className="text-foreground">{pkg.material}</span></p>
                )}
              </div>
            ))}
          </div>

          {!hasSubscription && lockedCount > 0 && (
            <div className="bg-gradient-to-br from-teal-50 to-green-50 border border-teal-200 rounded-xl p-4 text-center">
              <Lock size={18} className="text-teal-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">{lockedCount} more packaging configurations locked</p>
              <p className="text-xs text-muted-foreground mb-3">Access full packaging specs, pallet configurations, and labeling requirements.</p>
              <Link href="/pricing" className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-ocean-800 transition-colors">
                Unlock Professional Access
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
