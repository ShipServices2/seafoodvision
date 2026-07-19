// ============================================================
// SEAFOOD VISION — Payment Provider Types
// Provider-agnostic interfaces for Dodo Payments integration
// ============================================================

export type PaymentEnvironment = 'test' | 'production';
export type OrderStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'disputed';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'disputed';
export type SubscriptionStatus = 'pending' | 'active' | 'trialing' | 'past_due' | 'paused' | 'cancelled' | 'expired';
export type WebhookProcessingStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored_duplicate';
export type CreditMovementType = 'purchase' | 'grant' | 'usage' | 'refund' | 'expiration' | 'admin_adjustment';
export type BillingCycle = 'monthly' | 'annual';
export type InternalProductType = 'subscription_plan' | 'one_time_asset_license' | 'credit_pack' | 'image_pack' | 'enterprise_custom';

// ─── Checkout ────────────────────────────────────────────────

export interface CreateCheckoutParams {
  orderId: string;
  userId: string;
  userEmail: string;
  amount: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  externalCheckoutId: string;
  externalPaymentId?: string;
}

// ─── Subscription ────────────────────────────────────────────

export interface CreateSubscriptionCheckoutParams {
  orderId: string;
  userId: string;
  userEmail: string;
  planId: string;
  dodoPriceId: string;
  billingCycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface SubscriptionCheckoutResult {
  checkoutUrl: string;
  externalCheckoutId: string;
}

export interface CancelSubscriptionParams {
  externalSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionDetails {
  externalSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

// ─── Webhook ─────────────────────────────────────────────────

export interface WebhookVerificationResult {
  isValid: boolean;
  payload?: Record<string, unknown>;
  eventType?: string;
  externalEventId?: string;
}

export interface WebhookEvent {
  externalEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  environment: PaymentEnvironment;
}

// ─── Payment Status ──────────────────────────────────────────

export interface PaymentStatusResult {
  externalPaymentId: string;
  status: PaymentStatus;
  rawStatus: string;
  amount?: number;
  currency?: string;
}

// ─── Provider Config ─────────────────────────────────────────

export interface PaymentProviderConfig {
  isEnabled: boolean;
  environment: PaymentEnvironment;
  isConfigured: boolean;
  missingKeys: string[];
  /** True when API key is present and provider is enabled — checkout can proceed */
  isCheckoutReady?: boolean;
  /** True when webhook secret is configured — webhook verification can proceed */
  isWebhookReady?: boolean;
  /** Alias for isWebhookReady — for diagnostic display */
  webhookSecretConfigured?: boolean;
}

// ─── Order ───────────────────────────────────────────────────

export interface CreateOrderParams {
  userId: string;
  orderType: string;
  currency: string;
  items: OrderItemInput[];
  metadata?: Record<string, unknown>;
  checkoutKey?: string;
}

export interface OrderItemInput {
  itemType: string;
  internalProductId?: string;
  assetId?: string;
  licenseTypeId?: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  orderType: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  externalCheckoutId?: string;
  externalPaymentId?: string;
  environment: PaymentEnvironment;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  cancelledAt?: string;
  checkoutUrl?: string;
  reused?: boolean;
}
