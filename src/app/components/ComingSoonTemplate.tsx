import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowRight } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: string;
  features: string[];
}

function ComingSoonPage({ title, description, icon, features }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-6">{icon}</div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-semibold mb-6">
            Coming Soon
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">{title}</h1>
          <p className="text-muted-foreground leading-relaxed mb-10">{description}</p>

          <div className="bg-card rounded-2xl border border-border p-6 text-left mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Planned features</h2>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-secondary shrink-0 mt-0.5">→</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/library" className="btn-primary">
              Browse the catalog
              <ArrowRight size={14} />
            </Link>
            <Link href="/contact" className="btn-outline">Get notified</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ComingSoonPage;
