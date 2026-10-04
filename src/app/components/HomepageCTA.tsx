import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Library } from 'lucide-react';

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
            Explore verified real photographs, browse the species index, and license the images you need. Looking for a larger volume? Ask us for a quote.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/library" className="btn-secondary w-full sm:w-auto">
              <Library size={16} />
              Explore the library
            </Link>
            <Link href="/species" className="btn-secondary w-full sm:w-auto">
              <BookOpen size={16} />
              View species
            </Link>
            <Link href="/enterprise" className="btn-secondary w-full sm:w-auto">
              Request a quote
              <ArrowRight size={14} />
            </Link>
          </div>
          <p className="text-xs text-white/35 mt-6">
            Licences are issued per asset. Enterprise volumes and custom terms on request.
          </p>
        </div>
      </div>
    </section>
  );
}