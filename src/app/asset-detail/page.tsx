import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AssetDetailContent from '@/app/asset-detail/components/AssetDetailContent';

export default function AssetDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <Suspense fallback={
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
              <div className="aspect-[4/3] bg-muted rounded-2xl animate-pulse" />
              <div className="flex flex-col gap-4">
                <div className="bg-card rounded-xl border border-border p-5 space-y-3 animate-pulse">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          </div>
        }>
          <AssetDetailContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}