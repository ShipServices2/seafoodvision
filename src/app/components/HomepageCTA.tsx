import React from 'react';
import Link from 'next/link';
import { ArrowRight, Library } from 'lucide-react';

export default function HomepageCTA() {
  return (
    <section className="py-20 bg-primary">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-4">
            Start exploring
          </p>
          <h2 className="text-3xl xl:text-4xl font-bold text-white mb-5 leading-tight">
            The seafood visual library your work deserves
          </h2>
          <p className="text-white/65 text-base leading-relaxed mb-8">
            Browse the library, preview assets, and create a free account to save favorites and build collections. Licensing is coming — join early to follow the launch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/library" className="btn-secondary w-full sm:w-auto">
              <Library size={16} />
              Browse the library
            </Link>
            <Link href="/auth" className="btn-outline border-white/20 text-white hover:bg-white/10 w-full sm:w-auto">
              Create free account
              <ArrowRight size={14} />
            </Link>
          </div>
          <p className="text-xs text-white/35 mt-6">
            Preview platform — commercial licensing terms subject to review before launch.
          </p>
        </div>
      </div>
    </section>
  );
}