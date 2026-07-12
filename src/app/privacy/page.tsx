import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-3xl prose prose-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3 not-prose">Privacy Policy</p>
          <h1 className="text-4xl font-bold text-foreground mb-2 not-prose">Privacy Policy</h1>
          <p className="text-muted-foreground mb-10 not-prose">Last updated: July 2026</p>

          <div className="space-y-8 not-prose">
            {[
              {
                title: '1. Data we collect',
                content: 'When you create an account, we collect your email address, display name, and optionally your company and country. We also collect usage data such as pages visited and assets viewed, to improve the platform.',
              },
              {
                title: '2. How we use your data',
                content: 'Your data is used to provide the SeafoodVision service, manage your account, send transactional emails (account confirmation, password reset), and improve the platform. We do not sell your personal data to third parties.',
              },
              {
                title: '3. Authentication',
                content: 'Authentication is handled by Supabase Auth. Passwords are never stored in plain text. Session tokens are managed securely via encrypted cookies.',
              },
              {
                title: '4. Data storage',
                content: 'Your data is stored in Supabase (PostgreSQL) hosted in the European Union. Row-level security policies ensure that users can only access their own data.',
              },
              {
                title: '5. Cookies',
                content: 'We use session cookies for authentication purposes only. We do not use advertising or tracking cookies.',
              },
              {
                title: '6. Your rights',
                content: 'You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at the address below.',
              },
              {
                title: '7. Contact',
                content: 'For privacy-related questions, contact us via the contact page.',
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
