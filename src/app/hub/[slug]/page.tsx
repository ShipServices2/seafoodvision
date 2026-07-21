'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, AlertCircle, Coins, Crown, User,
  Fish, Image as ImageIcon, Package, Scale, Package2,
  Award, Globe, FileText, Bot, Layers, Briefcase
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEncSpeciesBySlug, fetchSpeciesProducts, fetchSpeciesCertifications, fetchSpeciesMarkets, fetchSpeciesDocuments, fetchRelatedSpecies, type EncSpecies, type EncProduct, type EncCertification, type EncMarket, type EncDocument,  } from '@/lib/supabase/encyclopediaQueries';
import { fetchSpeciesAssets } from '@/lib/supabase/queries';
import type { Asset } from '@/lib/supabase/types';

import HubSpeciesIdentity from '../components/HubSpeciesIdentity';
import HubMediaLibrary from '../components/HubMediaLibrary';
import HubProductForms from '../components/HubProductForms';
import HubSizeGrades from '../components/HubSizeGrades';
import HubPackagingLibrary from '../components/HubPackagingLibrary';
import HubCertifications from '../components/HubCertifications';
import HubGlobalAvailability from '../components/HubGlobalAvailability';
import HubDocumentCenter from '../components/HubDocumentCenter';
import HubAIAdvisor from '../components/HubAIAdvisor';
import HubSimilarSpecies from '../components/HubSimilarSpecies';
import HubBusinessServices from '../components/HubBusinessServices';

// ---- Types ----
type AccessTier = 'free' | 'subscription' | 'credits';

type HubModule =
  | 'identity' |'media' |'products' |'sizes' |'packaging' |'certifications' |'availability' |'documents' |'ai_advisor' |'similar' |'business';

interface ModuleConfig {
  key: HubModule;
  label: string;
  icon: React.ElementType;
  tier: AccessTier;
  description: string;
}

const MODULES: ModuleConfig[] = [
  { key: 'identity', label: 'Species Identity', icon: Fish, tier: 'free', description: 'Taxonomy, biology, habitat' },
  { key: 'media', label: 'Media Library', icon: ImageIcon, tier: 'subscription', description: 'Professional photos & videos' },
  { key: 'products', label: 'Product Forms', icon: Package, tier: 'subscription', description: 'Commercial product forms' },
  { key: 'sizes', label: 'Size Grades', icon: Scale, tier: 'subscription', description: 'Size grades & presentations' },
  { key: 'packaging', label: 'Packaging', icon: Package2, tier: 'subscription', description: 'Packaging configurations' },
  { key: 'certifications', label: 'Certifications', icon: Award, tier: 'free', description: 'Sustainability & quality certs' },
  { key: 'availability', label: 'Global Availability', icon: Globe, tier: 'free', description: 'Markets & distribution' },
  { key: 'documents', label: 'Document Center', icon: FileText, tier: 'credits', description: 'Spec sheets, reports' },
  { key: 'ai_advisor', label: 'AI Advisor', icon: Bot, tier: 'credits', description: 'AI-powered species intelligence' },
  { key: 'similar', label: 'Similar Species', icon: Layers, tier: 'free', description: 'Related & substitute species' },
  { key: 'business', label: 'Business Services', icon: Briefcase, tier: 'free', description: 'Sourcing & consulting' },
];

const TIER_BADGE: Record<AccessTier, { label: string; color: string; icon: React.ElementType }> = {
  free: { label: 'Free', color: 'bg-green-100 text-green-700', icon: User },
  subscription: { label: 'Pro', color: 'bg-blue-100 text-blue-700', icon: Crown },
  credits: { label: 'Credits', color: 'bg-amber-100 text-amber-700', icon: Coins },
};

export default function SeafoodIntelligenceHubPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const fromIdentify = searchParams?.get('from') === 'identify';
  const identifyId = searchParams?.get('identify_id');

  const { user, profile } = useAuth();
  const [activeModule, setActiveModule] = useState<HubModule>('identity');
  const [species, setSpecies] = useState<EncSpecies | null>(null);
  const [products, setProducts] = useState<EncProduct[]>([]);
  const [certifications, setCertifications] = useState<EncCertification[]>([]);
  const [markets, setMarkets] = useState<EncMarket[]>([]);
  const [documents, setDocuments] = useState<EncDocument[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [related, setRelated] = useState<EncSpecies[]>([]);
  const [packaging, setPackaging] = useState<any[]>([]);
  const [businessServices, setBusinessServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Determine access tier
  const isAdmin = profile?.role === 'administrator' || profile?.role === 'super_admin';

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const sp = await fetchEncSpeciesBySlug(slug);
      if (!sp) { setNotFound(true); setLoading(false); return; }
      setSpecies(sp);

      const [p, c, m, d, a, r] = await Promise.all([
        fetchSpeciesProducts(sp.id),
        fetchSpeciesCertifications(sp.id),
        fetchSpeciesMarkets(sp.id),
        fetchSpeciesDocuments(sp.id),
        fetchSpeciesAssets(sp.id, 24),
        fetchRelatedSpecies(sp.id, 6),
      ]);
      setProducts(p); setCertifications(c); setMarkets(m);
      setDocuments(d); setAssets(a); setRelated(r);

      // Load packaging
      const supabase = createClient();
      const { data: pkgData } = await supabase
        .from('packaging_configurations')
        .select('*, packaging_types(name, description)')
        .limit(20);
      setPackaging(pkgData || []);

      // Load business services
      const { data: bsData } = await supabase
        .from('hub_business_services')
        .select('*')
        .eq('species_id', sp.id)
        .eq('is_active', true)
        .order('sort_order');
      setBusinessServices(bsData || []);

      setLoading(false);
    };

    load();
  }, [slug]);

  // Load user credits and subscription
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    // Get credit balance
    supabase.rpc('get_user_credit_balance', { p_user_id: user.id })
      .then(({ data }) => setUserCredits(data || 0));

    // Check subscription
    supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .limit(1)
      .then(({ data }) => setHasSubscription((data?.length || 0) > 0));
  }, [user]);

  const handleUseCredits = useCallback(async (feature: string, credits: number): Promise<boolean> => {
    if (!user) return false;
    if (userCredits < credits) return false;

    const supabase = createClient();
    const { error } = await supabase.from('credit_ledger').insert({
      user_id: user.id,
      movement_type: 'usage',
      amount: -credits,
      description: `Hub: ${feature}`,
      reference_type: 'hub_feature',
      reference_id: feature,
    });

    if (!error) {
      setUserCredits((prev) => prev - credits);
      return true;
    }
    return false;
  }, [user, userCredits]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-secondary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading Seafood Intelligence Hub…</p>
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
          <AlertCircle size={40} className="text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Species not found</h1>
          <Link href="/species" className="text-secondary hover:underline text-sm">Browse all species</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const activeConfig = MODULES.find((m) => m.key === activeModule)!;
  const effectiveSubscription = hasSubscription || isAdmin;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          {fromIdentify && identifyId ? (
            <Link href={`/identify/${identifyId}/results`} className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft size={12} /> Identification results
            </Link>
          ) : (
            <Link href={`/species/${slug}`} className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft size={12} /> Species page
            </Link>
          )}
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground font-medium">Intelligence Hub</span>
        </nav>

        {/* Hub header */}
        <div className="bg-gradient-to-r from-ocean-900 to-ocean-700 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">🧠 Seafood Intelligence Hub</span>
                {fromIdentify && (
                  <span className="text-xs bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-full">From Identification</span>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-0.5">{species.common_name}</h1>
              <p className="text-ocean-200 text-sm italic">{species.scientific_name}</p>
            </div>
            <div className="text-right shrink-0">
              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Coins size={14} className="text-amber-300" />
                    <span className="text-sm font-semibold">{userCredits} credits</span>
                  </div>
                  {effectiveSubscription && (
                    <div className="flex items-center gap-1.5 justify-end">
                      <Crown size={12} className="text-blue-300" />
                      <span className="text-xs text-blue-200">Professional</span>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/auth/sign-in" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
                  Sign in for full access
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar navigation */}
          <aside className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-2">Modules</p>
            {MODULES.map((mod) => {
              const ModIcon = mod.icon;
              const tierInfo = TIER_BADGE[mod.tier];
              const TierIcon = tierInfo.icon;
              const isActive = activeModule === mod.key;

              return (
                <button
                  key={mod.key}
                  onClick={() => setActiveModule(mod.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <ModIcon size={15} className={isActive ? 'text-white' : 'text-muted-foreground'} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-foreground'}`}>
                      {mod.label}
                    </p>
                    <p className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {mod.description}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 ${
                    isActive ? 'bg-white/20 text-white' : tierInfo.color
                  }`}>
                    <TierIcon size={9} />
                    {tierInfo.label}
                  </span>
                </button>
              );
            })}

            {/* Access tier legend */}
            <div className="mt-4 p-3 bg-muted/50 rounded-xl space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Access Tiers</p>
              {Object.entries(TIER_BADGE).map(([tier, info]) => {
                const TierIcon = info.icon;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${info.color}`}>
                      <TierIcon size={9} />
                      {info.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tier === 'free' ? 'Always available' : tier === 'subscription' ? 'Pro plan required' : 'Credits required'}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Module content */}
          <div className="min-w-0">
            {/* Module header */}
            <div className="flex items-center gap-3 mb-5">
              {React.createElement(activeConfig.icon, { size: 18, className: 'text-secondary' })}
              <h2 className="text-lg font-bold text-foreground">{activeConfig.label}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_BADGE[activeConfig.tier].color}`}>
                {TIER_BADGE[activeConfig.tier].label}
              </span>
            </div>

            {/* Render active module */}
            {activeModule === 'identity' && (
              <HubSpeciesIdentity species={species} />
            )}

            {activeModule === 'media' && (
              <HubMediaLibrary
                assets={assets}
                speciesSlug={slug}
                speciesName={species.common_name}
                hasSubscription={effectiveSubscription}
              />
            )}

            {activeModule === 'products' && (
              <HubProductForms
                products={products}
                hasSubscription={effectiveSubscription}
              />
            )}

            {activeModule === 'sizes' && (
              <HubSizeGrades
                species={species}
                hasSubscription={effectiveSubscription}
              />
            )}

            {activeModule === 'packaging' && (
              <HubPackagingLibrary
                packaging={packaging}
                packagingNotes={species.packaging_notes}
                conservationMethods={species.conservation_methods}
                hasSubscription={effectiveSubscription}
              />
            )}

            {activeModule === 'certifications' && (
              <HubCertifications
                certifications={certifications}
                possibleCertifications={species.possible_certifications}
              />
            )}

            {activeModule === 'availability' && (
              <HubGlobalAvailability
                markets={markets}
                faoAreas={species.fao_areas}
                worldDistribution={species.world_distribution}
                hasSubscription={effectiveSubscription}
                userCredits={userCredits}
                onUseCredits={handleUseCredits}
              />
            )}

            {activeModule === 'documents' && (
              <HubDocumentCenter
                documents={documents}
                hasSubscription={effectiveSubscription}
                userCredits={userCredits}
                onUseCredits={handleUseCredits}
              />
            )}

            {activeModule === 'ai_advisor' && (
              <HubAIAdvisor
                speciesId={species.id}
                speciesName={species.common_name}
                hasSubscription={effectiveSubscription}
                userCredits={userCredits}
                userId={user?.id || null}
                onUseCredits={handleUseCredits}
              />
            )}

            {activeModule === 'similar' && (
              <HubSimilarSpecies
                relatedSpecies={related}
                currentSpeciesId={species.id}
              />
            )}

            {activeModule === 'business' && (
              <HubBusinessServices
                services={businessServices}
                speciesName={species.common_name}
              />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
