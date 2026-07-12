// ============================================================
// SEAFOOD VISION — Identification Types (Phase 6.1)
// ============================================================

export type IdentificationStatus =
  | 'uploaded' |'validating' |'analyzing' |'candidates_ready' |'human_review_requested' |'human_review_in_progress' |'completed' |'insufficient_quality' |'failed' |'cancelled';

export type QualityStatus =
  | 'pending' |'passed' |'warning' |'failed';

export type ConfidenceLevel =
  | 'strong_candidate' |'possible_candidate' |'limited_evidence' |'insufficient_information';

export type CandidateType =
  | 'species' |'product' |'product_form' |'similar_asset' |'category';

export type ReviewStatus =
  | 'requested' |'queued' |'assigned' |'reviewing' |'clarification_needed' |'completed' |'unable_to_identify';

export type FeedbackType =
  | 'looks_correct' |'incorrect' |'not_sure' |'request_expert_review';

export interface QualityFlag {
  code: string;
  severity: 'warning' | 'error';
  message: string;
}

export interface MatchReason {
  code: string;
  label: string;
  detail?: string;
}

export interface IdentificationRequest {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  uploadPath: string | null;
  originalFilename: string | null;
  mediaType: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  checksum: string | null;
  qualityStatus: QualityStatus;
  qualityFlags: QualityFlag[];
  userCategoryHint: string | null;
  userStateHint: string | null;
  userContextHint: string | null;
  userCountryHint: string | null;
  userNotes: string | null;
  status: IdentificationStatus;
  locale: string;
  consentForRetention: boolean;
  retentionUntil: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IdentificationCandidate {
  id: string;
  requestId: string;
  speciesId: string | null;
  assetId: string | null;
  candidateType: CandidateType;
  rank: number;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number | null;
  matchReasons: MatchReason[];
  sourceType: string;
  modelName: string | null;
  modelVersion: string | null;
  status: string;
  createdAt: string;
  // Joined data
  species?: {
    id: string;
    slug: string;
    commonName: string;
    scientificName: string;
    family: string | null;
    category: string | null;
    description: string | null;
  } | null;
}

export interface IdentificationReview {
  id: string;
  requestId: string;
  reviewerId: string | null;
  reviewStatus: ReviewStatus;
  confirmedSpeciesId: string | null;
  confirmedProductId: string | null;
  confidenceLevel: ConfidenceLevel | null;
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface IdentificationFeedback {
  id: string;
  requestId: string;
  candidateId: string | null;
  userId: string | null;
  feedbackType: FeedbackType;
  comment: string | null;
  createdAt: string;
}

export interface IdentificationEvent {
  id: string;
  requestId: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

// Upload form state
export interface UploadFormState {
  file: File | null;
  previewUrl: string | null;
  qualityFlags: QualityFlag[];
  qualityStatus: QualityStatus;
  // Step 3 hints
  categoryHint: string;
  stateHint: string;
  contextHint: string;
  countryHint: string;
  notes: string;
  consentForRetention: boolean;
  privacyAcknowledged: boolean;
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  strong_candidate: 'Strong candidate',
  possible_candidate: 'Possible candidate',
  limited_evidence: 'Limited evidence',
  insufficient_information: 'Insufficient information',
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  strong_candidate: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  possible_candidate: 'text-blue-700 bg-blue-50 border-blue-200',
  limited_evidence: 'text-amber-700 bg-amber-50 border-amber-200',
  insufficient_information: 'text-gray-600 bg-gray-50 border-gray-200',
};

export const STATUS_LABELS: Record<IdentificationStatus, string> = {
  uploaded: 'Uploaded',
  validating: 'Validating',
  analyzing: 'Analyzing',
  candidates_ready: 'Candidates ready',
  human_review_requested: 'Review requested',
  human_review_in_progress: 'Under review',
  completed: 'Completed',
  insufficient_quality: 'Insufficient quality',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
