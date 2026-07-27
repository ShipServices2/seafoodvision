'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import { CircleCheck as CheckCircle, Globe, Award, FileText, Layers, ChevronRight, Fish, ShoppingBag, MapPin, Leaf, Scale, Package, FlaskConical, Anchor, Zap } from 'lucide-react';
import {
  fetchEncSpeciesBySlug,
  fetchSpeciesNames,
  fetchSpeciesProducts,
  fetchSpeciesCertifications,
  fetchSpeciesMarkets,
  fetchSpeciesDocuments,
  fetchRelatedSpecies,
  type EncSpecies,
  type EncSpeciesName,
  type EncProduct,
  type EncCertification,
  type EncMarket,
  type EncDocument,
} from '@/lib/supabase/encyclopediaQueries';
import { fetchSpeciesAssets } from '@/lib/supabase/queries';
import { getAssetThumbnailFile } from '@/lib/supabase/assetService';
import type { Asset } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

import SpeciesAssetCard from '@/components/SpeciesAssetCard';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://seafoodvis1067.builtwithrocket.new';

const SPECIES_COLORS: Record<string, string> = {
  Fish: 'from-blue-200 to-blue-50',
  Crustaceans: 'from-orange-200 to-orange-50',
  Cephalopods: 'from-purple-200 to-purple-50',
  Molluscs: 'from-teal-200 to-teal-50',
  Aquaculture: 'from-green-200 to-green-50',
};
const SPECIES_EMOJI: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪', Aquaculture: '🌊',
};

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  under_review: 'bg-amber-100 text-amber-700 border-amber-200',
  suggested: 'bg-blue-100 text-blue-700 border-blue-200',
  disputed: 'bg-red-100 text-red-700 border-red-200',
  obsolete: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CERT_STATUS_BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  document_received: 'bg-blue-100 text-blue-700 border-blue-200',
  under_verification: 'bg-amber-100 text-amber-700 border-amber-200',
  claimed: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  disputed: 'bg-red-100 text-red-700 border-red-200',
};

const LANG_LABELS: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese',
  de: 'German', it: 'Italian', nl: 'Dutch', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
};

const NAME_TYPE_LABELS: Record<string, string> = {
  commercial: 'Commercial', common: 'Common', local: 'Local',
  scientific_synonym: 'Scientific Synonym', marketplace: 'Marketplace', historical: 'Historical',
};

type Tab = 'overview' | 'names' | 'products' | 'media' | 'certifications' | 'markets' | 'documents';

// ---- SEO Head Component ----
function SpeciesSEOHead({ species, slug }: { species: EncSpecies; slug: string }) {
  const title = species.seo_title || `${species.common_name} (${species.scientific_name}) — Seafood Vision`;
  const description = species.seo_description ||
    `Complete species profile for ${species.common_name} (${species.scientific_name}). ${species.description ? species.description.slice(0, 120) + '…' : `Family: ${species.family || 'N/A'}. Category: ${species.category || 'N/A'}.`}`;
  const url = `${SITE_URL}/species/${slug}`;
  const keywords = [
    species.common_name,
    species.scientific_name,
    species.family,
    species.category,
    ...(species.seo_keywords || []),
  ].filter(Boolean).join(', ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Knowledge', item: `${SITE_URL}/knowledge` },
        { '@type': 'ListItem', position: 3, name: 'Species', item: `${SITE_URL}/species` },
        { '@type': 'ListItem', position: 4, name: species.common_name, item: url },
      ],
    },
    about: {
      '@type': 'Thing',
      name: species.common_name,
      alternateName: species.scientific_name,
      description,
    },
  };

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={url} />
      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Seafood Vision" />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}

// ---- Info Row ----
function InfoRow({ label, value, mono = false, italic = false }: { label: string; value: string; mono?: boolean; italic?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono-data' : ''} ${italic ? 'italic' : ''}`}>{value}</span>
    </div>
  );
}

// ---- Tag List ----
function TagList({ items, color = 'bg-muted text-muted-foreground' }: { items: string[]; color?: string }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{item}</span>
      ))}
    </div>
  );
}

export default function SpeciesDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [species, setSpecies] = useState<EncSpecies | null>(null);
  const [names, setNames] = useState<EncSpeciesName[]>([]);
  const [products, setProducts] = useState<EncProduct[]>([]);
  const [certifications, setCertifications] = useState<EncCertification[]>([]);
  const [markets, setMarkets] = useState<EncMarket[]>([]);
  const [documents, setDocuments] = useState<EncDocument[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [related, setRelated] = useState<EncSpecies[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!slug) return;
    fetchEncSpeciesBySlug(slug).then(async (sp) => {
      if (!sp) { setNotFound(true); setLoading(false); return; }
      setSpecies(sp);
      const [n, p, c, m, d, a, r] = await Promise.all([
        fetchSpeciesNames(sp.id),
        fetchSpeciesProducts(sp.id),
        fetchSpeciesCertifications(sp.id),
        fetchSpeciesMarkets(sp.id),
        fetchSpeciesDocuments(sp.id),
        fetchSpeciesAssets(sp.id, 12),
        fetchRelatedSpecies(sp.id, 6),
      ]);
      setNames(n); setProducts(p); setCertifications(c);
      setMarkets(m); setDocuments(d); setAssets(a); setRelated(r);
      setLoading(false);
    });
  }, [slug]);

  const color = SPECIES_COLORS[species?.category || ''] || 'from-slate-200 to-slate-50';
  const emoji = SPECIES_EMOJI[species?.category || ''] || '🐠';

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'names', label: 'Names', count: names.length },
    { key: 'products', label: 'Products', count: products.length },
    { key: 'media', label: 'Media', count: assets.length },
    { key: 'certifications', label: 'Certifications', count: certifications.length },
    { key: 'markets', label: 'Markets', count: markets.length },
    { key: 'documents', label: 'Documents', count: documents.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-muted rounded w-48" />
            <div className="h-52 bg-muted rounded-2xl" />
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !species) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16 text-center">
          <p className="text-5xl mb-4">🐟</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">Species not found</h1>
          <p className="text-muted-foreground mb-6">This species page does not exist or is not publicly available.</p>
          <Link href="/species" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">View all species</Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Group names by language
  const namesByLang: Record<string, EncSpeciesName[]> = {};
  names.forEach((n) => {
    if (!namesByLang[n.language_code]) namesByLang[n.language_code] = [];
    namesByLang[n.language_code].push(n);
  });

  // Nutritional values helper
  const nutrition = species.nutritional_values as Record<string, string | number> | null;
  const sizeInfo = species.size_info as Record<string, string | number> | null;
  const seasonality = species.seasonality as Record<string, unknown> | null;

  return (
    <>
      {species && <SpeciesSEOHead species={species} slug={slug} />}
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
            <ChevronRight size={12} />
            <Link href="/species" className="hover:text-foreground transition-colors">Species</Link>
            <ChevronRight size={12} />
            <span className="text-foreground font-medium truncate max-w-[200px]">{species.common_name}</span>
          </nav>

          {/* Hero */}
          <div className={`relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br ${color} h-52 flex items-center justify-center`}>
            <span className="text-9xl">{emoji}</span>
            <div className="absolute top-4 left-4 flex gap-2">
              {species.is_validated && (
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold">
                  <CheckCircle size={11} /> Verified
                </span>
              )}
              {species.is_demo && (
                <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-semibold">
                  <Layers size={11} /> Demonstration species data
                </span>
              )}
            </div>
          </div>

          {/* Identity + metadata */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">{species.common_name}</h1>
              <p className="text-lg font-mono-data text-muted-foreground italic mb-4">{species.scientific_name}</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {species.family && <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full">{species.family}</span>}
                {species.order_name && <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full">{species.order_name}</span>}
                {species.category && <span className="text-sm bg-secondary/10 text-secondary px-3 py-1 rounded-full">{species.category}</span>}
                {species.genus && <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full font-mono-data italic">{species.genus}</span>}
                {species.validation_status && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_BADGE[species.validation_status] || STATUS_BADGE.suggested}`}>
                    {species.validation_status.replace('_', ' ')}
                  </span>
                )}
              </div>
              {species.description && (
                <p className="text-muted-foreground leading-relaxed text-sm max-w-2xl">{species.description}</p>
              )}

              {/* Intelligence Hub CTA */}
              <div className="mt-5">
                <Link
                  href={`/hub/${slug}`}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-ocean-800 to-ocean-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:from-ocean-900 hover:to-ocean-700 transition-all shadow-sm text-sm"
                >
                  <Zap size={15} />
                  Open Seafood Intelligence Hub
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-3 h-fit">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Species Data</h3>
              <InfoRow label="Scientific Name" value={species.scientific_name} mono italic />
              <InfoRow label="Genus" value={species.genus || '—'} mono />
              <InfoRow label="Family" value={species.family || '—'} />
              {species.order_name && <InfoRow label="Order" value={species.order_name} />}
              <InfoRow label="Category" value={species.category || '—'} />
              <InfoRow label="FAO Alpha-3" value={species.fao_alpha3_code || '—'} mono />
              <InfoRow label="FAO Areas" value={species.fao_areas?.join(', ') || '—'} mono />
              <InfoRow label="Taxonomic Status" value={species.taxonomic_status || '—'} />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-8 overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Multilingual Names', value: names.length, icon: Globe, onClick: () => setActiveTab('names') },
                  { label: 'Products', value: products.length, icon: ShoppingBag, onClick: () => setActiveTab('products') },
                  { label: 'Media Assets', value: assets.length, icon: Fish, onClick: () => setActiveTab('media') },
                  { label: 'Certifications', value: certifications.length, icon: Award, onClick: () => setActiveTab('certifications') },
                ].map((stat) => {
                  const StatIcon = stat.icon;
                  return (
                    <button
                      key={stat.label}
                      onClick={stat.onClick}
                      className="bg-card rounded-xl border border-border p-4 text-left hover:border-secondary/40 transition-colors"
                    >
                      <StatIcon size={18} className="text-muted-foreground mb-2" />
                      <div className="text-2xl font-bold text-foreground font-mono-data">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Description */}
              {species.description && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{species.description}</p>
                </div>
              )}

              {/* Habitat & Distribution */}
              {(species.habitat || species.world_distribution || species.habitat_depth) && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Habitat & Distribution</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {species.habitat && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Habitat</p>
                        <p className="text-sm text-foreground leading-relaxed">{species.habitat}</p>
                      </div>
                    )}
                    {species.habitat_depth && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Depth Range</p>
                        <p className="text-sm text-foreground">{species.habitat_depth}</p>
                      </div>
                    )}
                    {species.world_distribution && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">World Distribution</p>
                        <p className="text-sm text-foreground leading-relaxed">{species.world_distribution}</p>
                      </div>
                    )}
                    {species.fao_areas && species.fao_areas.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">FAO Fishing Areas</p>
                        <TagList items={species.fao_areas} color="bg-blue-50 text-blue-700" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fishing & Aquaculture */}
              {((species.fishing_methods && species.fishing_methods.length > 0) ||
                (species.aquaculture_methods && species.aquaculture_methods.length > 0)) && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Anchor size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Fishing & Aquaculture</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {species.fishing_methods && species.fishing_methods.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Fishing Methods</p>
                        <TagList items={species.fishing_methods} color="bg-ocean-50 text-ocean-700" />
                      </div>
                    )}
                    {species.aquaculture_methods && species.aquaculture_methods.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Aquaculture Methods</p>
                        <TagList items={species.aquaculture_methods} color="bg-green-50 text-green-700" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seasonality */}
              {seasonality && Object.keys(seasonality).length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Leaf size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Seasonality</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month) => {
                      const key = month.toLowerCase();
                      const val = (seasonality as Record<string, unknown>)[key];
                      const available = val === true || val === 'peak' || val === 'available';
                      const peak = val === 'peak';
                      return (
                        <div key={month} className={`text-center py-2 px-3 rounded-lg text-xs font-medium ${
                          peak ? 'bg-secondary text-white' : available ?'bg-secondary/10 text-secondary': 'bg-muted text-muted-foreground'
                        }`}>
                          {month}
                          {peak && <div className="text-xs opacity-80">Peak</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size & Weight */}
              {sizeInfo && Object.keys(sizeInfo).length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Scale size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Sizes & Weights</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(sizeInfo).map(([key, val]) => (
                      <div key={key} className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-semibold text-foreground">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nutritional Values */}
              {nutrition && Object.keys(nutrition).length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FlaskConical size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Nutritional Values</h3>
                    <span className="text-xs text-muted-foreground">(per 100g)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(nutrition).map(([key, val]) => (
                      <div key={key} className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-bold text-foreground font-mono-data">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commercial Forms & Presentations */}
              {((species.commercial_forms && species.commercial_forms.length > 0) ||
                (species.presentations && species.presentations.length > 0) ||
                (species.conservation_methods && species.conservation_methods.length > 0) ||
                species.packaging_notes) && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Package size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Commercial Information</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {species.commercial_forms && species.commercial_forms.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Commercial Forms</p>
                        <TagList items={species.commercial_forms} color="bg-amber-50 text-amber-700" />
                      </div>
                    )}
                    {species.presentations && species.presentations.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Presentations</p>
                        <TagList items={species.presentations} color="bg-amber-50 text-amber-700" />
                      </div>
                    )}
                    {species.conservation_methods && species.conservation_methods.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Conservation Methods</p>
                        <TagList items={species.conservation_methods} color="bg-teal-50 text-teal-700" />
                      </div>
                    )}
                    {species.packaging_notes && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Packaging Notes</p>
                        <p className="text-sm text-foreground">{species.packaging_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Possible Certifications */}
              {species.possible_certifications && species.possible_certifications.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">Possible Certifications</h3>
                  </div>
                  <TagList items={species.possible_certifications} color="bg-green-50 text-green-700" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'names' && (
            <div>
              {Object.keys(namesByLang).length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Globe size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No multilingual names documented yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(namesByLang).map(([lang, langNames]) => (
                    <div key={lang} className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="px-5 py-3 bg-muted/50 border-b border-border">
                        <span className="text-sm font-semibold text-foreground">{LANG_LABELS[lang] || lang.toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground ml-2 font-mono-data">{lang}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {langNames.map((n) => (
                          <div key={n.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div>
                              <span className="text-sm font-medium text-foreground">{n.name}</span>
                              {n.region && <span className="text-xs text-muted-foreground ml-2">({n.region})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                                {NAME_TYPE_LABELS[n.name_type] || n.name_type}
                              </span>
                              {n.is_preferred && (
                                <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Preferred</span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[n.status] || STATUS_BADGE.suggested}`}>
                                {n.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              {products.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <ShoppingBag size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No verified commercial products linked to this species yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      className="bg-card rounded-xl border border-border p-4 hover:border-secondary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-foreground">{p.public_name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[p.status] || STATUS_BADGE.suggested}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {p.product_forms?.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.product_forms.label}</span>}
                        {p.processing_methods?.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.processing_methods.label}</span>}
                        {p.preservation_methods?.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.preservation_methods.label}</span>}
                        {p.freezing_methods?.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.freezing_methods.label}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div>
              {assets.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Fish size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No approved media assets for this species yet.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {assets.map((asset) => {
                      const thumbFile = getAssetThumbnailFile(asset);
                      return (
                        <SpeciesAssetCard
                          key={asset.id}
                          asset={asset}
                          thumbnailBucket={thumbFile?.storage_bucket || null}
                          thumbnailPath={thumbFile?.storage_path || null}
                          emoji={emoji}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-4 text-center">
                    <Link href={`/library?species=${encodeURIComponent(species.common_name)}`} className="text-sm text-secondary font-medium hover:underline">
                      View all in library →
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'certifications' && (
            <div>
              {certifications.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Award size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No verified certifications linked to this species.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{cert.name}</h4>
                        {cert.issuing_body && <p className="text-xs text-muted-foreground mt-0.5">{cert.issuing_body}</p>}
                        {cert.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cert.description}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{cert.certification_type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CERT_STATUS_BADGE[cert.status] || CERT_STATUS_BADGE.claimed}`}>
                          {cert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'markets' && (
            <div>
              {markets.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Globe size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No verified market links for this species.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {markets.map((m) => (
                    <Link key={m.id} href={`/markets/${m.slug}`} className="bg-card rounded-xl border border-border p-4 hover:border-secondary/40 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{m.name}</h4>
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">{m.market_type}</span>
                      </div>
                      {m.region && <p className="text-xs text-muted-foreground">{m.region}</p>}
                      {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                ⚠️ Market information is for professional reference and may require independent verification.
              </p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {documents.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No public documents linked to this species.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{doc.public_title}</h4>
                        {doc.issuing_body && <p className="text-xs text-muted-foreground mt-0.5">{doc.issuing_body}</p>}
                        {doc.issue_date && <p className="text-xs text-muted-foreground mt-0.5">Issued: {doc.issue_date}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {doc.document_types?.label && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{doc.document_types.label}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[doc.status] || STATUS_BADGE.suggested}`}>{doc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Similar / Related species */}
          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-bold text-foreground mb-4">Similar Species</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {related.map((r) => {
                  const rColor = SPECIES_COLORS[r.category || ''] || 'from-slate-100 to-slate-50';
                  const rEmoji = SPECIES_EMOJI[r.category || ''] || '🐠';
                  return (
                    <Link key={r.id} href={`/species/${r.slug}`} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm hover:-translate-y-0.5 transition-all">
                      <div className={`h-16 bg-gradient-to-br ${rColor} flex items-center justify-center`}>
                        <span className="text-3xl">{rEmoji}</span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold text-foreground truncate">{r.common_name}</p>
                        <p className="text-xs font-mono-data text-muted-foreground italic truncate">{r.scientific_name}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}
