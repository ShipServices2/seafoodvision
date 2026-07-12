import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-foreground mb-2">Copyright Notice</h1>
          <p className="text-muted-foreground mb-10">Last updated: July 2026</p>

          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-base font-bold text-foreground mb-2">Ownership</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All visual assets published on SeafoodVision are protected by copyright. The rights are held by SeafoodVision or by the original photographers and rights holders who have granted SeafoodVision the right to distribute their work.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-base font-bold text-foreground mb-2">No AI-generated content</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SeafoodVision does not publish AI-generated images. Every asset is a real photograph taken by a human photographer. This is a core commitment of the platform.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-base font-bold text-foreground mb-2">Unauthorized use</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Downloading, reproducing, distributing, or using any asset from SeafoodVision without a valid license is strictly prohibited and constitutes copyright infringement. We actively monitor for unauthorized use.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-base font-bold text-foreground mb-2">DMCA / Copyright claims</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you believe that content on SeafoodVision infringes your copyright, please contact us with a detailed description of the alleged infringement. We will investigate and respond promptly.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-base font-bold text-foreground mb-2">Demo content</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Assets marked as "Demo" are sample content for platform preview purposes only. They are not available for licensing or commercial use.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
