'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Heart, Plus, Share2, Download, ShieldCheck, Camera, CheckCircle2, AlertCircle, Info, Tag, Globe2, FileImage, Hash, MapPin, Layers, Thermometer, Ruler,  } from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import AssetPreview from './AssetPreview';
import SimilarAssets from './SimilarAssets';
import CollectionModal from './CollectionModal';
import Icon from '@/components/ui/AppIcon';


// Backend integration point: replace with API call to /api/assets/:slug
const assetData = {
  id: 'asset-demo-001',
  slug: 'atlantic-mackerel-whole-fresh-sv001',
  title: 'Atlantic Mackerel — Whole, Fresh, Ungutted',
  description:
    'High-resolution photograph of Atlantic Mackerel (Scomber scombrus) in whole, ungutted presentation. Captured at a commercial fishing port in Brittany, France. The specimen displays characteristic iridescent blue-green dorsal coloration with distinctive dark wavy markings. Product is in fresh, unfrozen state at time of capture.',
  species: 'Atlantic Mackerel',
  scientificName: 'Scomber scombrus',
  family: 'Scombridae',
  category: 'Fish',
  productForm: 'Whole, ungutted',
  productState: 'Fresh',
  freezingMethod: 'N/A',
  packaging: 'None — loose presentation',
  orientation: 'Landscape',
  dimensions: '5184 × 3456 px',
  resolution: '300 dpi',
  format: 'JPEG',
  fileSize: '14.2 MB',
  colorSpace: 'sRGB',
  country: 'France',
  faoArea: 'FAO 27 — Northeast Atlantic',
  captureDate: 'Q4 2023',
  licenseType: 'commercial',
  commercialUse: true,
  editorialUse: true,
  isVerified: true,
  isRealPhoto: true,
  status: 'commercial',
  rightsInfo: 'All rights reserved — SeafoodVision. License required for any use.',
  restrictions: 'No redistribution. No sub-licensing. Single-use license per purchase.',
  keywords: [
    'mackerel',
    'atlantic mackerel',
    'scomber scombrus',
    'scombridae',
    'whole fish',
    'ungutted',
    'fresh fish',
    'pelagic fish',
    'FAO 27',
    'northeast atlantic',
    'france',
    'commercial fish',
    'blue fish',
    'oily fish',
  ],
  isDemo: true,
  emoji: '🐟',
  bgColor: 'from-blue-200 via-blue-100 to-slate-100',
};

const metadataGroups = [
  {
    id: 'meta-group-species',
    title: 'Species & Biology',
    icon: Info,
    rows: [
      { label: 'Common Name', value: assetData.species, mono: false },
      { label: 'Scientific Name', value: assetData.scientificName, mono: true, italic: true },
      { label: 'Family', value: assetData.family, mono: false },
      { label: 'Category', value: assetData.category, mono: false },
    ],
  },
  {
    id: 'meta-group-product',
    title: 'Product Details',
    icon: Layers,
    rows: [
      { label: 'Product Form', value: assetData.productForm, mono: false },
      { label: 'Product State', value: assetData.productState, mono: false },
      { label: 'Freezing Method', value: assetData.freezingMethod, mono: false },
      { label: 'Packaging', value: assetData.packaging, mono: false },
    ],
  },
  {
    id: 'meta-group-geo',
    title: 'Geographic Data',
    icon: MapPin,
    rows: [
      { label: 'Country of Origin', value: assetData.country, mono: false },
      { label: 'FAO Area', value: assetData.faoArea, mono: true },
      { label: 'Capture Period', value: assetData.captureDate, mono: true },
    ],
  },
  {
    id: 'meta-group-technical',
    title: 'Technical Specs',
    icon: FileImage,
    rows: [
      { label: 'Dimensions', value: assetData.dimensions, mono: true },
      { label: 'Resolution', value: assetData.resolution, mono: true },
      { label: 'Format', value: assetData.format, mono: true },
      { label: 'File Size', value: assetData.fileSize, mono: true },
      { label: 'Color Space', value: assetData.colorSpace, mono: true },
      { label: 'Orientation', value: assetData.orientation, mono: false },
    ],
  },
  {
    id: 'meta-group-license',
    title: 'Licensing & Rights',
    icon: Tag,
    rows: [
      { label: 'License Type', value: assetData.licenseType.charAt(0).toUpperCase() + assetData.licenseType.slice(1), mono: false },
      { label: 'Commercial Use', value: assetData.commercialUse ? 'Permitted (license required)' : 'Not permitted', mono: false },
      { label: 'Editorial Use', value: assetData.editorialUse ? 'Permitted (license required)' : 'Not permitted', mono: false },
      { label: 'Rights', value: assetData.rightsInfo, mono: false },
      { label: 'Restrictions', value: assetData.restrictions, mono: false },
    ],
  },
];

export default function AssetDetailContent() {
  const [favorited, setFavorited] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const handleFavorite = () => {
    setFavorited(!favorited);
    toast.success(favorited ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleShare = () => {
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link href="/library" className="hover:text-foreground transition-colors">Library</Link>
        <ChevronRight size={12} />
        <Link href="/library?category=Fish" className="hover:text-foreground transition-colors">Fish</Link>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium line-clamp-1 max-w-xs">{assetData.title}</span>
      </nav>

      {/* Demo banner */}
      {assetData.isDemo && (
        <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={15} className="text-purple-600 shrink-0" />
          <p className="text-sm text-purple-700">
            <span className="font-semibold">Demo asset</span> — This is sample content for platform preview. Metadata is illustrative.
          </p>
        </div>
      )}

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px] 2xl:grid-cols-[1fr_500px] gap-8 items-start">
        {/* Left: Preview */}
        <div className="flex flex-col gap-5">
          <AssetPreview asset={assetData} />

          {/* Description */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Info size={14} className="text-muted-foreground" />
              Asset Description
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {assetData.description}
            </p>
          </div>

          {/* Keywords */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Hash size={14} className="text-muted-foreground" />
              Keywords
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {assetData.keywords.map((kw) => (
                <Link
                  key={`kw-${kw}`}
                  href={`/library?q=${encodeURIComponent(kw)}`}
                  className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full hover:bg-secondary/10 hover:text-secondary transition-colors duration-150"
                >
                  {kw}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Metadata panel */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          {/* Title + status */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {assetData.isRealPhoto && (
                <span className="inline-flex items-center gap-1 badge-real-photo text-xs px-2 py-0.5 rounded-full font-medium">
                  <Camera size={10} />
                  Real Photo
                </span>
              )}
              {assetData.isVerified && (
                <span className="inline-flex items-center gap-1 badge-verified text-xs px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 size={10} />
                  Verified
                </span>
              )}
              <Badge
                variant={assetData.licenseType as 'commercial' | 'editorial'}
                size="sm"
              />
              <span className="text-xs font-mono-data text-muted-foreground ml-auto">
                #{assetData.id}
              </span>
            </div>

            <h1 className="text-lg font-bold text-foreground leading-snug mb-1">
              {assetData.title}
            </h1>
            <p className="text-sm font-mono-data text-muted-foreground italic">
              {assetData.scientificName}
            </p>

            {/* Quick info row */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { icon: Layers, label: 'Form', value: assetData.productForm },
                { icon: Thermometer, label: 'State', value: assetData.productState },
                { icon: Globe2, label: 'FAO Area', value: 'FAO 27' },
                { icon: Ruler, label: 'Dimensions', value: '5184 × 3456' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={`quick-${item.label}`} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
                    <Icon size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-semibold text-foreground font-mono-data line-clamp-1">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3">
            {/* License CTA */}
            <div className="relative">
              <button
                disabled
                className="w-full btn-primary opacity-60 cursor-not-allowed justify-center"
                aria-label="License this image — coming soon"
              >
                <Download size={15} />
                License this image
              </button>
              <div className="absolute -top-2 right-2">
                <Badge variant="coming-soon" label="Coming Soon" size="sm" showIcon={false} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Commercial licensing is not yet active. This is a preview platform — final license terms will be published before commercial launch.
            </p>

            <div className="section-divider" />

            {/* Secondary actions */}
            <div className="flex gap-2">
              <button
                onClick={handleFavorite}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95 ${
                  favorited
                    ? 'border-red-200 bg-red-50 text-red-600' :'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={14} fill={favorited ? 'currentColor' : 'none'} />
                {favorited ? 'Favorited' : 'Favorite'}
              </button>
              <button
                onClick={() => setCollectionOpen(true)}
                className="flex-1 btn-outline justify-center"
                aria-label="Add to collection"
              >
                <Plus size={14} />
                Collect
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted flex items-center justify-center transition-colors duration-150"
                aria-label="Share asset"
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>

          {/* Metadata accordion */}
          {metadataGroups.map((group) => (
            <MetadataGroup key={group.id} group={group} />
          ))}

          {/* Verification note */}
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <ShieldCheck size={16} className="text-green-verified mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-800 mb-1">
                Verified Real Seafood Image
              </p>
              <p className="text-xs text-green-700 leading-relaxed">
                This asset has been manually reviewed by a seafood professional and confirmed as a real photograph with accurate species identification and metadata.
              </p>
            </div>
          </div>

          {/* Legal note */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-semibold">Preview only.</span> All displayed content is protected. Final license terms must be reviewed before commercial use. No download or use rights are granted at this stage.
            </p>
          </div>
        </div>
      </div>

      {/* Similar assets */}
      <SimilarAssets currentId={assetData.id} category={assetData.category} />

      {/* Collection modal */}
      <CollectionModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        assetTitle={assetData.title}
      />
    </div>
  );
}

interface MetadataGroupProps {
  group: typeof metadataGroups[0];
}

function MetadataGroup({ group }: MetadataGroupProps) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors duration-150"
        aria-expanded={open}
      >
        <Icon size={14} className="text-muted-foreground" />
        {group.title}
        <ChevronRight
          size={13}
          className={`ml-auto text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col divide-y divide-border">
          {group.rows.map((row) => (
            <div key={`meta-row-${row.label}`} className="metadata-row">
              <span className="metadata-label">{row.label}</span>
              <span className={`metadata-value ${row.mono ? 'font-mono-data text-xs' : ''} ${(row as { italic?: boolean }).italic ? 'italic' : ''}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}