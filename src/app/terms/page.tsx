import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Use</h1>
          <p className="text-muted-foreground mb-10">Last updated: July 2026</p>

          <div className="space-y-6">
            {[
              {
                title: '1. Acceptance of terms',
                content: 'By accessing or using SeafoodVision, you agree to be bound by these Terms of Use. If you do not agree, do not use the platform.',
              },
              {
                title: '2. Platform status',
                content: 'SeafoodVision is currently in preview. Features, pricing, and terms are subject to change before the commercial launch. Demo content is provided for illustration purposes only.',
              },
              {
                title: '3. Account registration',
                content: 'You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.',
              },
              {
                title: '4. Permitted use',
                content: 'You may browse the catalog, save favorites, and create collections. Downloading or using assets for commercial or editorial purposes requires a valid license.',
              },
              {
                title: '5. Prohibited use',
                content: 'You may not scrape the platform, attempt to access other users\' data, reverse-engineer the platform, or use assets without a valid license.',
              },
              {
                title: '6. Intellectual property',
                content: 'All visual assets on SeafoodVision are protected by copyright. Licenses are granted per asset and per use case. No ownership is transferred.',
              },
              {
                title: '7. Limitation of liability',
                content: 'SeafoodVision is provided "as is". We do not guarantee uninterrupted availability. We are not liable for any indirect or consequential damages.',
              },
              {
                title: '8. Governing law',
                content: 'These terms are governed by applicable law. Disputes shall be resolved in the competent courts.',
              },
            ]?.map((section) => (
              <div key={section?.title} className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-base font-bold text-foreground mb-2">{section?.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section?.content}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
