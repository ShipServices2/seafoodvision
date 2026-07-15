// ============================================================
// SEAFOOD VISION — PRICING ENGINE CONFIGURATION
// All prices and quotas are defined here.
// Modify this file to update pricing without touching UI code.
// ============================================================

export type BillingCycle = 'monthly' | 'annual';
export type PlanId = 'free' | 'explorer' | 'professional' | 'business' | 'enterprise';
export type LicenseId = 'editorial' | 'commercial' | 'extended' | 'exclusive';
export type CreditPackId = 'credits_100' | 'credits_250' | 'credits_500' | 'credits_1000';
export type UnitProductId = 'photo_web' | 'photo_hd' | 'photo_ultrahd' | 'video' | 'view_360' | 'pack_10';

// ─── SUBSCRIPTION PLANS ─────────────────────────────────────

export interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number | null; // null = custom quote
  annualPrice: number | null;  // null = custom quote
  currency: string;
  highlight: boolean;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
  downloads: number | null;    // null = unlimited / custom
  imageQuality: string[];
  aiAccess: boolean;
  apiAccess: boolean;
  privateSpaces: boolean;
  videoAccess: boolean;
  view360Access: boolean;
  features: PlanFeature[];
  dodoMonthlyPriceId?: string; // future Dodo Payments integration
  dodoAnnualPriceId?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Discover the catalog',
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'EUR',
    highlight: false,
    ctaLabel: 'Get started free',
    ctaHref: '/auth/sign-up',
    downloads: 0,
    imageQuality: [],
    aiAccess: false,
    apiAccess: false,
    privateSpaces: false,
    videoAccess: false,
    view360Access: false,
    features: [
      { label: 'Browse full catalog', included: true },
      { label: 'Watermarked previews', included: true },
      { label: 'Limited search (10/day)', included: true },
      { label: 'Limited encyclopedia access', included: true },
      { label: 'Downloads', included: false },
      { label: 'AI features', included: false },
      { label: 'Collections', included: false },
    ],
  },
  {
    id: 'explorer',
    name: 'Explorer',
    tagline: 'For researchers & enthusiasts',
    monthlyPrice: 29,
    annualPrice: 290,
    currency: 'EUR',
    highlight: false,
    ctaLabel: 'Start Explorer',
    ctaHref: '/auth/sign-up?plan=explorer',
    downloads: 30,
    imageQuality: ['web'],
    aiAccess: true,
    apiAccess: false,
    privateSpaces: false,
    videoAccess: false,
    view360Access: false,
    features: [
      { label: '30 downloads/month', included: true },
      { label: 'Full encyclopedia access', included: true },
      { label: 'AI-powered search', included: true },
      { label: 'Collections', included: true },
      { label: 'Web-resolution images', included: true },
      { label: 'HD images', included: false },
      { label: 'Video & 360° views', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For food industry professionals',
    monthlyPrice: 79,
    annualPrice: 790,
    currency: 'EUR',
    highlight: true,
    badge: 'Most popular',
    ctaLabel: 'Start Professional',
    ctaHref: '/auth/sign-up?plan=professional',
    downloads: 150,
    imageQuality: ['web', 'hd'],
    aiAccess: true,
    apiAccess: false,
    privateSpaces: false,
    videoAccess: false,
    view360Access: false,
    features: [
      { label: '150 downloads/month', included: true },
      { label: 'HD images included', included: true },
      { label: 'Full AI suite', included: true },
      { label: 'Seafood Marketing Kit', included: true },
      { label: 'Full encyclopedia access', included: true },
      { label: 'Collections & favorites', included: true },
      { label: 'Video & 360° views', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For agencies & large operations',
    monthlyPrice: 199,
    annualPrice: 1990,
    currency: 'EUR',
    highlight: false,
    ctaLabel: 'Start Business',
    ctaHref: '/auth/sign-up?plan=business',
    downloads: 500,
    imageQuality: ['web', 'hd', 'ultrahd'],
    aiAccess: true,
    apiAccess: true,
    privateSpaces: true,
    videoAccess: true,
    view360Access: true,
    features: [
      { label: '500 downloads/month', included: true },
      { label: 'Ultra HD images', included: true },
      { label: 'Video downloads', included: true },
      { label: '360° view access', included: true },
      { label: 'API access', included: true },
      { label: 'Private spaces', included: true },
      { label: 'Priority support', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom solutions for large teams',
    monthlyPrice: null,
    annualPrice: null,
    currency: 'EUR',
    highlight: false,
    ctaLabel: 'Contact sales',
    ctaHref: '/enterprise',
    downloads: null,
    imageQuality: ['web', 'hd', 'ultrahd'],
    aiAccess: true,
    apiAccess: true,
    privateSpaces: true,
    videoAccess: true,
    view360Access: true,
    features: [
      { label: 'Unlimited downloads', included: true },
      { label: 'Multi-user management', included: true },
      { label: 'ERP/CRM integration (future)', included: true },
      { label: 'Dedicated account manager', included: true },
      { label: 'Custom licensing', included: true },
      { label: 'SLA & priority support', included: true },
      { label: 'Statistics & reporting', included: true },
    ],
  },
];

// ─── UNIT SALES ──────────────────────────────────────────────

export interface UnitProduct {
  id: UnitProductId;
  name: string;
  description: string;
  price: number;
  currency: string;
  dodoProductId?: string; // Dodo Payments product ID (set via admin/commerce/mappings)
}

export const UNIT_PRODUCTS: UnitProduct[] = [
  {
    id: 'photo_web',
    name: 'Photo Web',
    description: 'Web-optimised image (72 dpi, up to 1920px)',
    price: 5,
    currency: 'EUR',
  },
  {
    id: 'photo_hd',
    name: 'Photo HD',
    description: 'High-definition image (300 dpi, up to 4K)',
    price: 20,
    currency: 'EUR',
  },
  {
    id: 'photo_ultrahd',
    name: 'Photo Ultra HD',
    description: 'Ultra HD image (full resolution, up to 8K)',
    price: 40,
    currency: 'EUR',
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Professional video clip (MP4, up to 4K)',
    price: 75,
    currency: 'EUR',
  },
  {
    id: 'view_360',
    name: 'Vue 360°',
    description: 'Interactive 360° product view',
    price: 50,
    currency: 'EUR',
  },
  {
    id: 'pack_10',
    name: 'Pack 10 images',
    description: 'Bundle of 10 web-resolution images',
    price: 150,
    currency: 'EUR',
  },
];

// ─── LICENSE TYPES ───────────────────────────────────────────

export interface LicenseType {
  id: LicenseId;
  name: string;
  badge: string;
  description: string;
  price: number | null; // null = included in plan / negotiated
  currency: string;
  rights: string[];
  restrictions: string[];
  color: string;
}

export const LICENSE_TYPES: LicenseType[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    badge: 'editorial',
    description: 'For news, press, educational and non-commercial publications.',
    price: null,
    currency: 'EUR',
    rights: [
      'News and press articles',
      'Educational materials',
      'Research publications',
      'Non-commercial blogs',
      'Documentary content',
    ],
    restrictions: [
      'No commercial advertising',
      'No product packaging',
      'No resale of original asset',
    ],
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'commercial',
    name: 'Commercial',
    badge: 'commercial',
    description: 'For advertising, packaging, marketing and commercial use.',
    price: null,
    currency: 'EUR',
    rights: [
      'Digital and print advertising',
      'Product packaging and labeling',
      'Corporate websites and presentations',
      'Social media marketing',
      'Trade publications',
    ],
    restrictions: [
      'No resale of original asset',
      'No use in AI training datasets',
      'No sublicensing to third parties',
    ],
    color: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    id: 'extended',
    name: 'Extended',
    badge: 'extended',
    description: 'Broader rights for large-scale commercial and multi-channel use.',
    price: 299,
    currency: 'EUR',
    rights: [
      'All Commercial rights',
      'Unlimited print runs',
      'Broadcast and streaming',
      'Out-of-home advertising',
      'Merchandise and physical products',
    ],
    restrictions: [
      'No exclusive ownership',
      'No resale of original asset',
      'No AI training datasets',
    ],
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'exclusive',
    name: 'Exclusive',
    badge: 'exclusive',
    description: 'Full exclusivity — the asset is removed from the catalog for your use only.',
    price: null, // negotiated
    currency: 'EUR',
    rights: [
      'All Extended rights',
      'Exclusive worldwide use',
      'Asset removed from public catalog',
      'Transferable to subsidiaries',
      'Perpetual license',
    ],
    restrictions: [
      'Subject to availability',
      'Negotiated pricing only',
      'Requires signed agreement',
    ],
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
];

// ─── CREDIT PACKS ────────────────────────────────────────────

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  price: number;
  currency: string;
  pricePerCredit: number;
  popular?: boolean;
  dodoProductId?: string; // Dodo Payments product ID (set via admin/commerce/mappings)
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'credits_100',
    credits: 100,
    price: 9,
    currency: 'EUR',
    pricePerCredit: 0.09,
  },
  {
    id: 'credits_250',
    credits: 250,
    price: 19,
    currency: 'EUR',
    pricePerCredit: 0.076,
    popular: true,
  },
  {
    id: 'credits_500',
    credits: 500,
    price: 35,
    currency: 'EUR',
    pricePerCredit: 0.07,
  },
  {
    id: 'credits_1000',
    credits: 1000,
    price: 59,
    currency: 'EUR',
    pricePerCredit: 0.059,
  },
];

// ─── CREDIT USAGE COSTS ──────────────────────────────────────

export const CREDIT_COSTS = {
  download_web: 1,
  download_hd: 4,
  download_ultrahd: 8,
  download_video: 15,
  download_360: 10,
  ai_identification: 2,
  ai_search: 1,
  ai_generation: 5,
} as const;

// ─── PRODUCT LINES ───────────────────────────────────────────

export const PRODUCT_LINES = [
  {
    id: 'images',
    name: 'Seafood Images',
    description: 'Professional photo bank — web, HD, Ultra HD, video, 360°',
    icon: '🖼️',
    href: '/library',
    color: 'from-ocean-700 to-ocean-900',
  },
  {
    id: 'knowledge',
    name: 'Seafood Knowledge',
    description: 'Premium access to species data, certifications, regulations',
    icon: '📚',
    href: '/knowledge',
    color: 'from-teal-600 to-ocean-700',
  },
  {
    id: 'ai',
    name: 'Seafood AI',
    description: 'Identification, smart search, AI assistant, generator',
    icon: '🤖',
    href: '/identify',
    color: 'from-purple-700 to-ocean-800',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'API, private collections, multi-user, ERP integration',
    icon: '🏢',
    href: '/enterprise',
    color: 'from-gold-500 to-ocean-800',
  },
] as const;

// ─── HELPERS ─────────────────────────────────────────────────

export function formatPrice(price: number | null, currency = 'EUR'): string {
  if (price === null) return 'On quote';
  if (price === 0) return 'Free';
  return `${price} ${currency === 'EUR' ? '€' : currency}`;
}

export function annualSavings(plan: SubscriptionPlan): number | null {
  if (!plan.monthlyPrice || !plan.annualPrice) return null;
  return plan.monthlyPrice * 12 - plan.annualPrice;
}
