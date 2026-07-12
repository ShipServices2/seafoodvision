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
