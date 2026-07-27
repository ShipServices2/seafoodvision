import React from 'react';
import { CheckCircle2, BookOpen, Globe2, Shield } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const pillars = [
  {
    id: 'pillar-verified',
    icon: CheckCircle2,
    color: 'text-green-verified',
    bgColor: 'bg-green-50',
    title: 'Verified Real Photographs',
    description:
      'Every image is manually reviewed and confirmed as a real photograph of a real seafood product. No AI generation, no stock photo library composites, no staged studio approximations.',
    highlight: 'Manual verification process — no automation',
  },
  {
    id: 'pillar-scientific',
    icon: BookOpen,
    color: 'text-secondary',
    bgColor: 'bg-sky-50',
    title: 'Scientifically Named',
    description:
      'Assets are indexed with both commercial names and validated scientific names (genus + species). FAO area, product form, and biological family are documented for every asset.',
    highlight: 'Scientific name + FAO area on every asset',
  },
  {
    id: 'pillar-global',
    icon: Globe2,
    color: 'text-accent',
    bgColor: 'bg-amber-50',
    title: 'Global Coverage',
    description:
      'Documentation spans Atlantic, Pacific, Mediterranean, Indian Ocean and more. Species from wild catch and aquaculture, from artisanal boats to industrial processing facilities.',
    highlight: 'All major FAO fishing areas represented',
  },
  {
    id: 'pillar-licensed',
    icon: Shield,
    color: 'text-primary',
    bgColor: 'bg-slate-50',
    title: 'Professional Licensing',
    description:
      'Clear licensing framework for web, editorial, commercial and extended use. Rights information and restrictions documented per asset. No ambiguous "royalty-free" blanket terms.',
    highlight: 'Individual asset rights documentation',
  },
];

export default function ValuePillars() {
  return (
    <section className="py-20 bg-card border-y border-border">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Why SeafoodVision
          </p>
          <h2 className="section-title">Built for professionals who need accuracy</h2>
          <p className="section-subtitle mt-3 max-w-2xl mx-auto">
            The seafood industry deserves better than generic stock photography. Every asset on this platform was produced, reviewed and documented by people who know seafood.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {pillars?.map((pillar) => {
            const Icon = pillar?.icon;
            return (
              <div
                key={pillar?.id}
                className="bg-background rounded-2xl border border-border p-6 flex flex-col gap-4 hover:shadow-card-hover transition-shadow duration-200"
              >
                <div className={`w-10 h-10 rounded-xl ${pillar?.bgColor} flex items-center justify-center`}>
                  <Icon size={20} className={pillar?.color} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base mb-2">
                    {pillar?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar?.description}
                  </p>
                </div>
                <div className="mt-auto pt-3 border-t border-border">
                  <p className="text-xs font-medium text-secondary">
                    {pillar?.highlight}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}