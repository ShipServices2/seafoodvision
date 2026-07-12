import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AssetDetailContent from '@/app/asset-detail/components/AssetDetailContent';

export default function AssetDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <AssetDetailContent />
      </main>
      <Footer />
    </div>
  );
}