import React from 'react';
import { Scan, Package, BookOpen, Code2, Star } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/AppIcon';


const features = [
  {
    id: 'feature-identify',
    icon: Scan,
    title: 'Species Identifier',
    description:
      'Upload a photograph and receive an AI-assisted species identification with confidence score, scientific name, and matching library assets.',
    href: '/identify',
    status: 'In development',
  },
  {
    id: 'feature-marketing',
    icon: Package,
    title: 'Marketing Kit',
    description:
      'Download complete brand-ready asset packages for specific species or product categories, formatted for web, print, and social media.',
    href: '/marketing-kit',
    status: 'Planned',
  },
  {
    id: 'feature-knowledge',
    icon: BookOpen,
    title: 'Knowledge Base',
    description:
      'Structured professional documentation on species biology, product forms, processing methods, quality standards, and market nomenclature.',
    href: '/knowledge',
    status: 'Planned',
  },
  {
    id: 'feature-api',
    icon: Code2,
    title: 'API Access',
    description:
      'Programmatic access to the SeafoodVision library and metadata for integration into e-commerce platforms, ERP systems, and custom applications.',
    href: '/api-access',
    status: 'Planned',
  },
];

export default function ComingSoonFeatures() {
  return (
    <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-medium mb-4">
          <Star size={11} />
          Platform Roadmap
        </div>
        <h2 className="section-title">What&apos;s coming next</h2>
        <p className="section-subtitle mt-3 max-w-xl mx-auto">
          The platform is actively expanding. These features are in development and will be announced when ready.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {features?.map((feature) => {
          const Icon = feature?.icon;
          return (
            <div
              key={feature?.id}
              className="relative bg-card rounded-2xl border border-dashed border-border p-6 flex flex-col gap-4 opacity-80"
            >
              {/* Coming soon overlay tag */}
              <div className="absolute top-4 right-4">
                <Badge variant="coming-soon" label={feature?.status} size="sm" showIcon={false} />
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon size={20} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base mb-2 pr-16">
                  {feature?.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature?.description}
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Notify me when available →
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">
        Feature timelines are estimates and subject to change. No commitments made.
      </p>
    </section>
  );
}