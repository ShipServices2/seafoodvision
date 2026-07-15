// ============================================================
// SEAFOOD VISION — PaymentProvider Interface
// Provider-agnostic contract. Dodo Payments will implement this.
// ============================================================

import type {
  CreateCheckoutParams,
  CheckoutResult,
  CreateSubscriptionCheckoutParams,
  SubscriptionCheckoutResult,
  CancelSubscriptionParams,
  SubscriptionDetails,
  WebhookVerificationResult,
  PaymentStatusResult,
  PaymentProviderConfig,
} from './types';

/**
 * PaymentProvider — the single interface all payment providers must implement.
 * Currently: Dodo Payments (stub — methods are TODO).
 * Never implement Stripe.
 */
export interface PaymentProvider {
  /**
   * Returns the current configuration state of the provider.
   * Used to detect: disabled, test mode, missing config, valid config.
   */
  getConfig(): PaymentProviderConfig;

  /**
   * Create a one-time payment checkout session.
   * Returns a checkout URL to redirect the user to.
   * The browser NEVER calls the provider directly.
   */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;

  /**
   * Create a subscription checkout session.
   * Returns a checkout URL for the subscription flow.
   */
  createSubscriptionCheckout(
    params: CreateSubscriptionCheckoutParams
  ): Promise<SubscriptionCheckoutResult>;

  /**
   * Retrieve the current status of a payment by its external ID.
   * Used server-side to verify payment before granting entitlements.
   */
  getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult>;

  /**
   * Retrieve the current state of a subscription by its external ID.
   */
  getSubscriptionDetails(externalSubscriptionId: string): Promise<SubscriptionDetails>;

  /**
   * Cancel a subscription (immediately or at period end).
   */
  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;

  /**
   * Verify the signature of an incoming webhook request.
   * Returns the parsed event if valid, or isValid=false if tampered.
   * The raw body must be passed as-is (not parsed JSON).
   */
  verifyWebhookSignature(
    rawBody: string,
    signature: string
  ): Promise<WebhookVerificationResult>;
}
