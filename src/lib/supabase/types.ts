// ============================================================
// SEAFOODVISION — Supabase Database Types
// Generated from actual schema — do not add fictional fields
// ============================================================

export type UserRole =
  | 'visitor' |'member' |'customer' |'reviewer' |'administrator' |'super_admin';

export type AssetMediaType = 'photo' | 'video' | 'document' | 'illustration';

export type AssetReviewStatus =
  | 'draft' |'imported' |'under_review' |'approved' |'preview_only' |'editorial' |'commercial' |'restricted' |'rejected' |'archived';

export type FileLevel = 'original' | 'preview' | 'thumbnail';

export type LicenseType = 'web' | 'editorial' | 'commercial' | 'extended' | 'enterprise';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial' | 'paused';

export type ReviewTaskStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export type ImportBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type KnowledgeClaimStatus = 'proposed' | 'verified' | 'disputed' | 'deprecated';

// ---- Profiles ----
export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  company: string | null;
  country: string | null;
  role: UserRole;
  terms_accepted_at: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Company Profiles ----
export interface CompanyProfile {
  id: string;
  name: string;
  legal_name: string | null;
  country: string | null;
  vat_number: string | null;
  website: string | null;
  industry: string | null;
  size_range: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: Record<string, unknown> | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Categories ----
export interface Category {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ---- Species ----
export interface Species {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  family: string | null;
  category: string | null;
  fao_areas: string[] | null;
  description: string | null;
  multilingual_names: Record<string, string> | null;
  is_validated: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Assets ----
export interface Asset {
  id: string;
  public_asset_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  media_type: AssetMediaType;
  category: string | null;
  species_id: string | null;
  product_form: string | null;
  product_state: string | null;
  freezing_method: string | null;
  packaging: string | null;
  country: string | null;
  fao_area: string | null;
  orientation: string | null;
  width_px: number | null;
  height_px: number | null;
  file_format: string | null;
  file_size_bytes: number | null;
  color_space: string | null;
  capture_period: string | null;
  license_type: string | null;
  commercial_use: boolean;
  editorial_use: boolean;
  rights_info: string | null;
  restrictions: string | null;
  is_real_photo: boolean;
  is_verified: boolean;
  review_status: AssetReviewStatus;
  publication_status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  species?: Pick<Species, 'id' | 'slug' | 'common_name' | 'scientific_name' | 'family' | 'category'> | null;
  asset_keywords?: { keywords: { term: string } }[];
}

// ---- Asset Files ----
export interface AssetFile {
  id: string;
  asset_id: string;
  file_level: FileLevel;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

// ---- Keywords ----
export interface Keyword {
  id: string;
  term: string;
  created_at: string;
}

// ---- Favorites ----
export interface Favorite {
  id: string;
  user_id: string;
  asset_id: string;
  created_at: string;
  // Joined
  assets?: Pick<Asset, 'id' | 'slug' | 'title' | 'category' | 'is_verified' | 'is_real_photo' | 'is_demo' | 'media_type'> & {
    species?: Pick<Species, 'common_name' | 'scientific_name'> | null;
  };
}

// ---- Collections ----
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  item_count?: number;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  asset_id: string;
  added_at: string;
  assets?: Pick<Asset, 'id' | 'slug' | 'title' | 'category' | 'is_verified' | 'is_real_photo' | 'is_demo'> & {
    species?: Pick<Species, 'common_name' | 'scientific_name'> | null;
  };
}

// ---- Review Tasks ----
export interface ReviewTask {
  id: string;
  asset_id: string;
  assigned_to: string | null;
  status: ReviewTaskStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  assets?: Pick<Asset, 'id' | 'slug' | 'title' | 'review_status'>;
}

// ---- Asset Status History ----
export interface AssetStatusHistory {
  id: string;
  asset_id: string;
  changed_by: string | null;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_at: string;
}

// ---- Audit Logs ----
export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ---- Import Batches ----
export interface ImportBatch {
  id: string;
  created_by: string | null;
  source_name: string | null;
  total_rows: number;
  processed_rows: number;
  rejected_rows: number;
  status: ImportBatchStatus;
  rejection_reasons: unknown[];
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

// ---- Knowledge Engine ----
export interface KnowledgeEntity {
  id: string;
  entity_type: string;
  label: string;
  slug: string;
  description: string | null;
  metadata: Record<string, unknown>;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRelation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  weight: number;
  created_at: string;
}

export interface KnowledgeClaim {
  id: string;
  entity_id: string;
  claim_text: string;
  claim_status: KnowledgeClaimStatus;
  confidence_score: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  claim_id: string;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

export interface KnowledgeVersion {
  id: string;
  entity_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

// ---- Catalog Stats ----
export interface CatalogStats {
  totalAssets: number;
  verifiedAssets: number;
  speciesCount: number;
  categoryCount: number;
  videoCount: number;
  photoCount: number;
  loading: boolean;
  error: string | null;
}

// ---- CSV Import Validation ----
export const ALLOWED_CSV_COLUMNS = [
  'public_asset_id',
  'media_type',
  'title',
  'category',
  'species_common_name',
  'scientific_name',
  'product_form',
  'fresh_or_frozen',
  'freezing_method',
  'packaging',
  'keywords',
  'orientation',
  'width',
  'height',
  'review_status',
  'rights_status',
  'publication_status',
  'confidence_score',
  'technical_score',
  'commercial_score',
  'description',
] as const;

export type AllowedCsvColumn = (typeof ALLOWED_CSV_COLUMNS)[number];

export interface CsvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview: Record<string, string>[];
  totalRows: number;
  rejectedRows: number;
}

// ---- Extended Catalog Stats (real vs demo) ----
export interface ExtendedCatalogStats extends CatalogStats {
  realAssets: number;
  demoAssets: number;
  realSpecies: number;
  demoSpecies: number;
}

// ============================================================
// SEAFOODVISION — Phase 4.4 Types
// Workflow, Certification, Commercial Readiness, Licensing
// ============================================================

export type WorkflowStatus =
  | 'imported' |'metadata_review' |'species_validation' |'technical_review' |'rights_review' |'commercial_review' |'certified' |'published' |'commercial_license_ready';

export type CommentType = 'comment' | 'suggestion' | 'correction';

export type BadgeType =
  | 'imported' |'under_review' |'metadata_complete' |'species_verified' |'technical_verified' |'rights_verified' |'certified' |'commercial_ready' |'editorial_ready' |'premium_asset' |'featured';

export interface AssetWorkflow {
  id: string;
  asset_id: string;
  workflow_status: WorkflowStatus;
  previous_status: WorkflowStatus | null;
  changed_by: string | null;
  changed_at: string;
  comment: string | null;
  // Joined
  profiles?: Pick<Profile, 'id' | 'display_name' | 'email' | 'role'> | null;
}

export interface AssetReadiness {
  id: string;
  asset_id: string;
  species_validated: boolean;
  technical_quality: boolean;
  rights_verified: boolean;
  metadata_completed: boolean;
  packaging_completed: boolean;
  keywords_completed: boolean;
  preview_available: boolean;
  thumbnail_available: boolean;
  original_available: boolean;
  license_ready: boolean;
  publication_ready: boolean;
  commercial_score: number;
  technical_score: number;
  completion_pct: number;
  updated_by: string | null;
  updated_at: string;
}

export interface AssetBadge {
  id: string;
  asset_id: string;
  badge: BadgeType;
  granted_by: string | null;
  granted_at: string;
}

export interface AssetReviewComment {
  id: string;
  asset_id: string;
  reviewer_id: string;
  comment_type: CommentType;
  content: string;
  created_at: string;
  updated_at: string;
  // Joined
  profiles?: Pick<Profile, 'id' | 'display_name' | 'email' | 'role'> | null;
}

export interface LicenseDefinition {
  id: string;
  license_type: LicenseType;
  display_name: string;
  description: string | null;
  rights: string | null;
  restrictions: string | null;
  indicative_price_eur: number | null;
  is_active: boolean;
  coming_soon: boolean;
  created_at: string;
  updated_at: string;
}

// Workflow step metadata
export const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; description: string; requiredRole: string }[] = [
  { status: 'imported', label: 'Imported', description: 'Asset has been imported into the system', requiredRole: 'reviewer' },
  { status: 'metadata_review', label: 'Metadata Review', description: 'Reviewing title, description, and metadata fields', requiredRole: 'reviewer' },
  { status: 'species_validation', label: 'Species Validation', description: 'Validating species identification and scientific name', requiredRole: 'reviewer' },
  { status: 'technical_review', label: 'Technical Review', description: 'Checking resolution, format, and technical quality', requiredRole: 'reviewer' },
  { status: 'rights_review', label: 'Rights Review', description: 'Verifying copyright, usage rights, and restrictions', requiredRole: 'reviewer' },
  { status: 'commercial_review', label: 'Commercial Review', description: 'Assessing commercial viability and market readiness', requiredRole: 'reviewer' },
  { status: 'certified', label: 'Certified', description: 'Asset has been certified by an administrator', requiredRole: 'administrator' },
  { status: 'published', label: 'Published', description: 'Asset is published and publicly visible', requiredRole: 'super_admin' },
  { status: 'commercial_license_ready', label: 'Commercial License Ready', description: 'Asset is ready for commercial licensing', requiredRole: 'super_admin' },
];

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  imported: 'bg-slate-100 text-slate-700 border-slate-200',
  metadata_review: 'bg-blue-100 text-blue-700 border-blue-200',
  species_validation: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  technical_review: 'bg-violet-100 text-violet-700 border-violet-200',
  rights_review: 'bg-orange-100 text-orange-700 border-orange-200',
  commercial_review: 'bg-amber-100 text-amber-700 border-amber-200',
  certified: 'bg-green-100 text-green-700 border-green-200',
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  commercial_license_ready: 'bg-teal-100 text-teal-700 border-teal-200',
};

export const BADGE_COLORS: Record<BadgeType, string> = {
  imported: 'bg-slate-100 text-slate-600',
  under_review: 'bg-blue-100 text-blue-700',
  metadata_complete: 'bg-indigo-100 text-indigo-700',
  species_verified: 'bg-cyan-100 text-cyan-700',
  technical_verified: 'bg-violet-100 text-violet-700',
  rights_verified: 'bg-orange-100 text-orange-700',
  certified: 'bg-green-100 text-green-700',
  commercial_ready: 'bg-teal-100 text-teal-700',
  editorial_ready: 'bg-sky-100 text-sky-700',
  premium_asset: 'bg-amber-100 text-amber-700',
  featured: 'bg-rose-100 text-rose-700',
};
