// ============================================================
// PHASE 5.4 — AI KNOWLEDGE ASSISTANT — Types
// ============================================================

export type AssistantConfidenceLevel = 'high' | 'moderate' | 'limited' | 'none';
export type AssistantMessageRole = 'user' | 'assistant' | 'system';
export type AssistantProviderMode = 'retrieval_only' | 'llm_assisted';
export type AssistantFeedbackType =
  | 'helpful' |'not_helpful' |'incorrect' |'missing_information' |'outdated_information' |'citation_problem' |'other';

export interface AssistantSource {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string;
  source_url?: string;
  relevance_score?: number;
  citation_order?: number;
}

export interface AssistantRelatedEntity {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  slug?: string;
  href?: string;
  cover_image?: string;
  status?: string;
}

export interface AssistantRelatedMedia {
  id: string;
  slug: string;
  title: string;
  thumbnail_url?: string;
  category?: string;
  href: string;
}

export interface AssistantStructuredContent {
  answer: string;
  answer_type:
    | 'species' |'product' |'packaging' |'market' |'certification' |'document' |'media' |'comparison' |'general' |'no_data';
  confidence_level: AssistantConfidenceLevel;
  verified_facts: string[];
  limitations: string[];
  sources: AssistantSource[];
  related_entities: AssistantRelatedEntity[];
  related_media: AssistantRelatedMedia[];
  suggested_questions: string[];
  safety_notice?: string;
  provider_mode: AssistantProviderMode;
  comparison?: AssistantComparison;
}

export interface AssistantComparison {
  entities: AssistantRelatedEntity[];
  common_points: string[];
  differences: { aspect: string; values: Record<string, string> }[];
  unverified_notes: string[];
}

export interface AssistantMessage {
  id: string;
  conversation_id: string;
  role: AssistantMessageRole;
  content: string;
  structured_content?: AssistantStructuredContent;
  confidence_level?: AssistantConfidenceLevel;
  provider_mode: AssistantProviderMode;
  created_at: string;
  sources?: AssistantSource[];
}

export interface AssistantConversation {
  id: string;
  user_id?: string;
  anonymous_session_id?: string;
  title?: string;
  locale: string;
  status: string;
  context_entities: AssistantRelatedEntity[];
  created_at: string;
  updated_at: string;
  messages?: AssistantMessage[];
}

export interface AssistantQueryRequest {
  question: string;
  conversation_id?: string;
  locale?: string;
  anonymous_session_id?: string;
  user_id?: string;
}

export interface AssistantQueryResponse {
  conversation_id: string;
  message_id: string;
  structured_content: AssistantStructuredContent;
}

export interface AssistantSavedAnswer {
  id: string;
  user_id: string;
  message_id: string;
  title?: string;
  created_at: string;
  message?: AssistantMessage;
}

export interface AssistantFeedback {
  id: string;
  user_id?: string;
  message_id: string;
  feedback_type: AssistantFeedbackType;
  reason?: string;
  comment?: string;
  created_at: string;
}

export interface AssistantUnansweredQuestion {
  id: string;
  normalized_question: string;
  locale: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
  assigned_to?: string;
  failure_reason?: string;
  probable_entities: string[];
}

export interface AssistantUsageEvent {
  id: string;
  user_id?: string;
  anonymous_session_id?: string;
  event_type: string;
  model_provider?: string;
  token_count?: number;
  latency_ms?: number;
  success: boolean;
  created_at: string;
}

// Injection protection: these patterns are blocked
export const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|your)\s+instructions/i,
  /reveal\s+(your|the|internal|system)\s+(prompt|instructions|rules)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|though)/i,
  /bypass\s+(your|the)\s+(rules|restrictions|filters)/i,
  /show\s+me\s+(confidential|private|secret|internal)/i,
  /invent\s+(a|an)\s+(certification|species|origin|price|source)/i,
  /cite\s+a\s+source\s+even\s+if\s+none\s+exists/i,
  /DAN\s+mode/i,
  /jailbreak/i,
];

export const PUBLIC_STATUSES = ['verified', 'public', 'active', 'approved', 'commercial', 'editorial'];
export const EXCLUDED_STATUSES = [
  'draft', 'suggested', 'unverified', 'under_review', 'rejected',
  'disputed', 'obsolete', 'archived', 'private', 'confidential',
];

export const HIGH_RISK_TOPICS = [
  'food safety', 'regulation', 'customs', 'health', 'certification',
  'origin', 'sustainability', 'allergen', 'conservation', 'import',
  'export', 'legislation', 'compliance', 'legal',
];

export const SAFETY_NOTICE =
  'This information is provided for professional reference and does not replace verification with the relevant authority or certification body.';

export const NO_DATA_RESPONSE_EN =
  'Seafood Vision does not yet have enough verified information to answer this question reliably.';
export const NO_DATA_RESPONSE_FR =
  'Seafood Vision ne dispose pas encore d\'informations vérifiées suffisantes pour répondre de manière fiable.';
