'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchAssetBySlug, getAssetPreviewFile } from '@/lib/supabase/assetService';
import type { AssetRow } from '@/lib/supabase/assetService';
import Link from 'next/link';
import { ChevronRight, Heart, Plus, Share2, ShieldCheck, Camera, CheckCircle2, AlertCircle, Globe2, Hash, Layers, Thermometer, Ruler, ShoppingCart, Lock, Info, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import AssetPreview from '@/app/asset-detail/components/AssetPreview';
import SimilarAssets from '@/app/asset-detail/components/SimilarAssets';
import CollectionModal from '@/app/asset-detail/components/CollectionModal';
import { useAuth } from '@/contexts/AuthContext';
import AddToCartButton from '@/components/AddToCartButton';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDimensions(w: number | null, h: number | null): string {
  if (!w || !h) return '—';
  return `${w.toLocaleString()} × ${h.toLocaleString()} px`;
}

// License options shown when asset is commercially available
const LICENSE_OPTIONS = [
  {
    code: 'commercial',
    name: 'Commercial License',
    unitProductCode: 'photo_hd',
    description: 'Commercial web, social media, presentations and print use',
    price: '20€',
  },
  {
    code: 'extended',
    name: 'Extended License',
    unitProductCode: 'photo_ultrahd',
    description: 'Unlimited digital use, print, merchandise',
    price: '40€',
  },
];

interface CommercialCriterion {
  key: string;
  label: string;
  passed: boolean;
  value: string;
  required: boolean;
}

function getCommercialCriteria(asset: AssetRow): CommercialCriterion[] {
  const hasOriginalFile = (asset.asset_files ?? []).some((f) => f.file_level === 'original');

  return [
    {
      key: 'asset_approved',
      label: 'Asset approved',
      passed: asset.review_status === 'approved',
      value: asset.review_status ?? 'unknown',
      required: true,
    },
    {
      key: 'species_validated',
      label: 'Species validated',
      passed: !!asset.species_id,
      value: asset.species?.common_name ?? (asset.species_id ? 'linked' : 'not linked'),
      required: false,
    },
    {
      key: 'rights_validated',
      label: 'Rights validated',
      passed: !!(asset.rights_info && asset.rights_info.length > 0),
      value: asset.rights_info ?? 'not set',
      required: false,
    },
    {
      key: 'privacy_cleared',
      label: 'Privacy cleared',
      passed: !asset.restrictions || asset.restrictions.toLowerCase() !== 'privacy',
      value: asset.restrictions ?? 'none',
      required: false,
    },
    {
      key: 'commercial_status',
      label: 'Commercial status',
      passed: asset.license_type !== 'editorial' && !asset.is_demo,
      value: asset.is_demo ? 'demo (not for sale)' : (asset.license_type ?? 'not set'),
      required: true,
    },
    {
      key: 'commercial_use',
      label: 'Commercial use permitted',
      passed: asset.commercial_use === true,
      value: asset.commercial_use ? 'yes' : 'no',
      required: true,
    },
    {
      key: 'original_file',
      label: 'Original file available',
      passed: hasOriginalFile,
      value: hasOriginalFile ? 'yes' : 'not found in asset_files',
      required: true,
    },
    {
      key: 'active_license',
      label: 'Active license type',
      passed: !!asset.license_type && asset.license_type !== 'none',
      value: asset.license_type ?? 'not set',
      required: true,
    },
  ];
}

function isCommerciallyReady(criteria: CommercialCriterion[]): { ok: boolean; blockers: CommercialCriterion[] } {
  const blockers = criteria.filter((c) => c.required && !c.passed);
  return { ok: blockers.length === 0, blockers };
}

export default function AssetSlugPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user } = useAuth();

  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showBlockers, setShowBlockers] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    fetchAssetBySlug(slug).then((data) => {
      if (!data) setNotFound(true);
      else setAsset(data);
      setLoading(false);
    });
  }, [slug]);

  const handleFavorite = () => {
    setFavorited(!favorited);
    toast.success(favorited ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(typeof window !== 'undefined' ? window.location.href : '').catch(() => {});
    }
    toast.success('Link copied to clipboard');
  };

  async function handleBuyLicense() {
    if (!asset || !selectedLicense) return;

    const licenseOption = LICENSE_OPTIONS.find((l) => l.code === selectedLicense);
    if (!licenseOption) return;

    // If not logged in, redirect to sign-in with checkout intent
    if (!user) {
      const intentParams = new URLSearchParams({
        return_to: '/checkout/resume',
        checkout_intent: '1',
        asset_id: asset.id,
        license_type: licenseOption.code,
        unit_product: licenseOption.unitProductCode,
      });
      router.push(`/auth/sign-in?${intentParams.toString()}`);
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/payments/dodo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          licenseTypeCode: licenseOption.code,
          unitProductCode: licenseOption.unitProductCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed');
      }

      const { checkoutUrl } = data as { checkoutUrl: string };

      if (checkoutUrl.startsWith('http')) {
        window.location.href = checkoutUrl;
      } else {
        router.push(checkoutUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start checkout';
      toast.error(msg);
    } finally {
      setCheckoutLoading(false);
    }
  }

  const keywords = asset?.asset_keywords?.map((ak) => ak.keywords?.term).filter(Boolean) || [];
  const speciesName = asset?.species?.common_name || asset?.category || '';
  const scientificName = asset?.species?.scientific_name || '';
  const categoryEmoji: Record<string, string> = {
    Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪',
    'Fillets & Portions': '🍣', 'Frozen Products': '🧊', Packaging: '📦', Aquaculture: '🌊',
  };
  const emoji = categoryEmoji[asset?.category || ''] || '🐠';
  const bgColor = 'from-blue-200 via-blue-100 to-slate-100';

  const criteria = asset ? getCommercialCriteria(asset) : [];
  const { ok: isReady, blockers } = isCommerciallyReady(criteria);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {loading ? (
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
              <div className="aspect-[4/3] bg-muted rounded-2xl animate-pulse" />
              <div className="flex flex-col gap-4">
                <div className="bg-card rounded-xl border border-border p-5 space-y-3 animate-pulse">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          </div>
        ) : notFound || !asset ? (
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-24 text-center">
            <p className="text-5xl mb-4">🐟</p>
            <h1 className="text-2xl font-bold text-foreground mb-2">Asset not found</h1>
            <p className="text-muted-foreground mb-6">This asset may have been removed or the link is incorrect.</p>
            <Link href="/library" className="btn-primary">Browse the library</Link>
          </div>
        ) : (
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight size={12} />
              <Link href="/library" className="hover:text-foreground transition-colors">Library</Link>
              <ChevronRight size={12} />
              {asset.category && (
                <>
                  <Link href={`/library?category=${encodeURIComponent(asset.category)}`} className="hover:text-foreground transition-colors">{asset.category}</Link>
                  <ChevronRight size={12} />
                </>
              )}
              <span className="text-foreground font-medium line-clamp-1 max-w-xs">{asset.title}</span>
            </nav>

            {asset.is_demo && (
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-6">
                <AlertCircle size={15} className="text-purple-600 shrink-0" />
                <p className="text-sm text-purple-700">
                  <span className="font-semibold">Demo asset</span> — This is sample content for platform preview.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px] gap-8 items-start">
              <div className="flex flex-col gap-5">
                <AssetPreview asset={{
                  id: asset.id,
                  slug: asset.slug,
                  title: asset.title,
                  emoji,
                  bgColor,
                  dimensions: asset.width_px && asset.height_px ? `${asset.width_px} × ${asset.height_px} px` : undefined,
                  format: asset.file_format || undefined,
                  previewBucket: getAssetPreviewFile(asset)?.storage_bucket || null,
                  previewPath: getAssetPreviewFile(asset)?.storage_path || null,
                }} />
                {keywords.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Hash size={14} className="text-muted-foreground" />
                      Keywords
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw) => (
                        <Link key={`kw-${kw}`} href={`/library?q=${encodeURIComponent(kw)}`}
                          className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full hover:bg-secondary/10 hover:text-secondary transition-colors">
                          {kw}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {asset.is_real_photo && (
                      <span className="inline-flex items-center gap-1 badge-real-photo text-xs px-2 py-0.5 rounded-full font-medium">
                        <Camera size={10} />Real Photo
                      </span>
                    )}
                    {asset.is_verified && (
                      <span className="inline-flex items-center gap-1 badge-verified text-xs px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 size={10} />Verified
                      </span>
                    )}
                    {asset.license_type && <Badge variant={asset.license_type as 'commercial' | 'editorial'} size="sm" />}
                    <span className="text-xs font-mono-data text-muted-foreground ml-auto">
                      #{asset.public_asset_id || asset.id.slice(0, 8)}
                    </span>
                  </div>
                  <h1 className="text-lg font-bold text-foreground leading-snug mb-1">{asset.title}</h1>
                  {scientificName && <p className="text-sm font-mono-data text-muted-foreground italic">{scientificName}</p>}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      { icon: Layers, label: 'Form', value: asset.product_form || '—' },
                      { icon: Thermometer, label: 'State', value: asset.product_state || '—' },
                      { icon: Globe2, label: 'FAO Area', value: asset.fao_area || '—' },
                      { icon: Ruler, label: 'Dimensions', value: asset.width_px && asset.height_px ? `${asset.width_px} × ${asset.height_px}` : '—' },
                    ].map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={`quick-${item.label}`} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
                          <ItemIcon size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-xs font-semibold text-foreground font-mono-data line-clamp-1">{item.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* License / Purchase panel */}
                <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3">
                  {isReady ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart size={15} className="text-secondary" />
                        <h2 className="text-sm font-semibold text-foreground">License this image</h2>
                      </div>

                      {/* License selector */}
                      <div className="flex flex-col gap-2">
                        {LICENSE_OPTIONS.map((opt) => (
                          <button
                            key={opt.code}
                            onClick={() => setSelectedLicense(opt.code)}
                            className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${
                              selectedLicense === opt.code
                                ? 'border-secondary bg-secondary/5 ring-1 ring-secondary/20' :'border-border hover:border-secondary/40 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-semibold text-foreground">{opt.name}</span>
                              <span className="text-sm font-bold text-secondary font-mono-data">{opt.price}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleBuyLicense}
                        disabled={!selectedLicense || checkoutLoading}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 ${
                          selectedLicense && !checkoutLoading
                            ? 'bg-secondary text-white hover:bg-secondary/90' :'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {checkoutLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating order…
                          </>
                        ) : (
                          <>
                            {user ? <ShoppingCart size={15} /> : <Lock size={15} />}
                            {user ? 'Buy License' : 'Sign in to Buy'}
                          </>
                        )}
                      </button>

                      {selectedLicense && (() => {
                        const option = LICENSE_OPTIONS.find((entry) => entry.code === selectedLicense);
                        return option ? (
                          <AddToCartButton
                            item={{
                              itemType: 'asset_license',
                              assetId: asset.id,
                              licenseTypeCode: option.code,
                              unitProductCode: option.unitProductCode,
                              quantity: 1,
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-secondary px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary/5 disabled:opacity-50"
                          />
                        ) : null;
                      })()}

                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Secure checkout via Dodo Payments. License terms apply.{' '}
                        <Link href="/licensing" className="text-secondary hover:underline">View terms</Link>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Info size={15} className="text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Licensing</h2>
                      </div>

                      {/* Commercial readiness blockers panel */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-600 shrink-0" />
                          <span className="text-xs font-semibold text-amber-700">Commercial readiness blockers</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {blockers.map((b) => (
                            <div key={b.key} className="flex items-start gap-2">
                              <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
                              <span className="text-xs text-amber-800">
                                <span className="font-medium">{b.label}:</span>{' '}
                                <span className="font-mono">{b.value}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Full criteria toggle */}
                      <button
                        onClick={() => setShowBlockers(!showBlockers)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-1"
                      >
                        <Info size={11} />
                        {showBlockers ? 'Hide' : 'Show'} full readiness checklist
                      </button>

                      {showBlockers && (
                        <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1.5">
                          {criteria.map((c) => (
                            <div key={c.key} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {c.passed ? (
                                  <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                ) : (
                                  <XCircle size={12} className={`shrink-0 ${c.required ? 'text-red-400' : 'text-amber-400'}`} />
                                )}
                                <span className="text-xs text-foreground truncate">{c.label}</span>
                                {c.required && !c.passed && (
                                  <span className="text-xs text-red-500 shrink-0">*</span>
                                )}
                              </div>
                              <span className="text-xs font-mono text-muted-foreground shrink-0 max-w-[120px] truncate text-right">{c.value}</span>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground mt-1">* Required for purchase</p>
                        </div>
                      )}

                      {/* Disabled buy button */}
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                      >
                        <Lock size={15} />
                        Buy License — not available
                      </button>
                    </>
                  )}

                  <div className="section-divider" />
                  <div className="flex gap-2">
                    <button onClick={handleFavorite}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95 ${favorited ? 'border-red-200 bg-red-50 text-red-600' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <Heart size={14} fill={favorited ? 'currentColor' : 'none'} />
                      {favorited ? 'Favorited' : 'Favorite'}
                    </button>
                    <button onClick={() => setCollectionOpen(true)} className="flex-1 btn-outline justify-center">
                      <Plus size={14} />Collect
                    </button>
                    <button onClick={handleShare} className="w-10 h-10 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted flex items-center justify-center transition-colors">
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>

                {asset.is_verified && (
                  <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <ShieldCheck size={16} className="text-green-verified mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-green-800 mb-1">Verified Real Seafood Image</p>
                      <p className="text-xs text-green-700 leading-relaxed">Manually reviewed and confirmed as a real photograph with accurate metadata.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SimilarAssets currentId={asset.id} category={asset.category} />
            <CollectionModal open={collectionOpen} onClose={() => setCollectionOpen(false)} assetTitle={asset.title} assetId={asset.id} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
