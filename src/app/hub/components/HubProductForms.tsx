'use client';

import React from 'react';
import { Package, Lock } from 'lucide-react';
import Link from 'next/link';
import type { EncProduct } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  products: EncProduct[];
  hasSubscription: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  under_review: 'bg-amber-100 text-amber-700 border-amber-200',
  suggested: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function HubProductForms({ products, hasSubscription }: Props) {
  const visibleProducts = hasSubscription ? products : products.slice(0, 2);
  const lockedCount = products.length - visibleProducts.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Commercial Product Forms</h3>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{products.length}</span>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Package size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No commercial products documented yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleProducts.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="block bg-card rounded-xl border border-border p-4 hover:border-secondary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{p.public_name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[p.status] || STATUS_BADGE.suggested}`}>
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {p.product_forms?.label && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{p.product_forms.label}</span>
                  )}
                  {p.processing_methods?.label && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.processing_methods.label}</span>
                  )}
                  {p.preservation_methods?.label && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.preservation_methods.label}</span>
                  )}
                  {p.freezing_methods?.label && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.freezing_methods.label}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {!hasSubscription && lockedCount > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
              <Lock size={18} className="text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">{lockedCount} more product forms locked</p>
              <p className="text-xs text-muted-foreground mb-3">Subscribe to access all commercial product forms and presentations.</p>
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
