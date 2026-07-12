import React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Newspaper, FlaskConical, Utensils } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const audiences = [
  {
    id: 'audience-industry',
    icon: Building2,
    iconColor: 'text-secondary',
    iconBg: 'bg-sky-50',
    title: 'Food Industry Professionals',
    description:
      'Buyers, category managers, and product developers sourcing verified visual documentation of seafood products for procurement, quality control, and product development workflows.',
    useCases: [
      'Supplier product verification',
      'Category catalogue illustration',
      'Internal training materials',
      'Product development reference',
    ],
    cta: 'Explore commercial licensing',
    ctaHref: '/licensing',
  },
  {
    id: 'audience-editorial',
    icon: Newspaper,
    iconColor: 'text-accent',
    iconBg: 'bg-amber-50',
    title: 'Editorial & Media',
    description:
      'Journalists, publishers, and designers needing scientifically accurate seafood imagery for articles, reports, packaging design, and educational publications.',
    useCases: [
      'Press and magazine illustration',
      'Educational publication design',
      'Packaging and label design',
      'Annual report photography',
    ],
    cta: 'View editorial licensing',
    ctaHref: '/licensing',
  },
  {
    id: 'audience-research',
    icon: FlaskConical,
    iconColor: 'text-green-verified',
    iconBg: 'bg-green-50',
    title: 'Research & Academia',
    description:
      'Marine biologists, fisheries scientists, and academic institutions requiring high-quality reference imagery with validated scientific nomenclature and geographic data.',
    useCases: [
      'Species identification reference',
      'Fisheries documentation',
      'Academic publication figures',
      'Morphological comparison studies',
    ],
    cta: 'Learn about research access',
    ctaHref: '/pricing',
  },
  {
    id: 'audience-food',
    icon: Utensils,
    iconColor: 'text-coral-500',
    iconBg: 'bg-red-50',
    title: 'Food Service & Gastronomy',
    description:
      'Chefs, restaurateurs, and culinary professionals requiring authentic product photography for menus, promotional materials, and culinary documentation.',
    useCases: [
      'Menu design and illustration',
      'Chef and restaurant promotion',
      'Recipe and culinary documentation',
      'Food tourism content',
    ],
    cta: 'See all use cases',
    ctaHref: '/licensing',
  },
];

export default function AudienceSection() {
  return (
    <section className="py-20 bg-card border-y border-border">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Who uses SeafoodVision
          </p>
          <h2 className="section-title">Built for every seafood professional</h2>
          <p className="section-subtitle mt-3 max-w-2xl mx-auto">
            From industrial buyers to marine biologists, the platform serves any professional who needs accurate, licensed seafood imagery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {audiences?.map((audience) => {
            const Icon = audience?.icon;
            return (
              <div
                key={audience?.id}
                className="bg-background rounded-2xl border border-border p-6 flex flex-col gap-4 hover:shadow-card-hover transition-shadow duration-200"
              >
                <div className={`w-10 h-10 rounded-xl ${audience?.iconBg} flex items-center justify-center`}>
                  <Icon size={20} className={audience?.iconColor} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base mb-2">
                    {audience?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {audience?.description}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5 my-1">
                  {audience?.useCases?.map((uc) => (
                    <li key={`uc-${uc}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1 h-1 rounded-full bg-secondary shrink-0" />
                      {uc}
                    </li>
                  ))}
                </ul>
                <Link
                  href={audience?.ctaHref}
                  className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
                >
                  {audience?.cta}
                  <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}