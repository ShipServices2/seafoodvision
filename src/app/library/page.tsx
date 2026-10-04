import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LibraryContent from '@/app/library/components/LibraryContent';

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <Suspense fallback={<div className="flex items-center justify-center py-24"><span className="text-muted-foreground text-sm">Loading library…</span></div>}>
          <LibraryContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}