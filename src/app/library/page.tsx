import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LibraryContent from '@/app/library/components/LibraryContent';

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <LibraryContent />
      </main>
      <Footer />
    </div>
  );
}