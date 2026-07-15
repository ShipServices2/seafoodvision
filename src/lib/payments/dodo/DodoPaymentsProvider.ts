// ============================================================
// SEAFOOD VISION — DodoPaymentsProvider (STUB)
// All methods are TODO — will be implemented with the official
// Dodo Payments API once the infrastructure is validated.
// DO NOT implement Stripe. DO NOT add Stripe references.
// ============================================================

import type { PaymentProvider } from '../PaymentProvider';
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
} from '../types';
import { getDodoConfig } from './config';

export class DodoPaymentsProvider implements PaymentProvider {
  getConfig(): PaymentProviderConfig {
    return getDodoConfig();
  }

  async createCheckout(_params: CreateCheckoutParams): Promise<CheckoutResult> {
    // TODO: Implement with Dodo Payments Checkout API
    // POST https://api.dodopayments.com/v1/checkout (or equivalent endpoint)
    // Use DODO_PAYMENTS_API_KEY (server-side only, never NEXT_PUBLIC_)
    // Return { checkoutUrl, externalCheckoutId }
    throw new Error('DodoPaymentsProvider.createCheckout — not yet implemented');
  }

  async createSubscriptionCheckout(
    _params: CreateSubscriptionCheckoutParams
  ): Promise<SubscriptionCheckoutResult> {
    // TODO: Implement with Dodo Payments Subscription Checkout API
    // Use dodo_price_id from payment_product_mappings
    // Return { checkoutUrl, externalCheckoutId }
    throw new Error('DodoPaymentsProvider.createSubscriptionCheckout — not yet implemented');
  }

  async getPaymentStatus(_externalPaymentId: string): Promise<PaymentStatusResult> {
    // TODO: Implement with Dodo Payments Payment Retrieval API
    // GET https://api.dodopayments.com/v1/payments/{id} (or equivalent)
    // Map Dodo status → internal PaymentStatus
    throw new Error('DodoPaymentsProvider.getPaymentStatus — not yet implemented');
  }

  async getSubscriptionDetails(_externalSubscriptionId: string): Promise<SubscriptionDetails> {
    // TODO: Implement with Dodo Payments Subscription Retrieval API
    // Map Dodo subscription status → internal SubscriptionStatus
    throw new Error('DodoPaymentsProvider.getSubscriptionDetails — not yet implemented');
  }

  async cancelSubscription(_params: CancelSubscriptionParams): Promise<void> {
    // TODO: Implement with Dodo Payments Subscription Cancellation API
    // Support both immediate cancellation and cancel_at_period_end
    throw new Error('DodoPaymentsProvider.cancelSubscription — not yet implemented');
  }

  async verifyWebhookSignature(
    _rawBody: string,
    _signature: string
  ): Promise<WebhookVerificationResult> {
    // TODO: Implement HMAC-SHA256 verification using DODO_PAYMENTS_WEBHOOK_SECRET
    // The raw body must be used as-is (not re-serialized)
    // Return { isValid: false } on any verification failure
    throw new Error('DodoPaymentsProvider.verifyWebhookSignature — not yet implemented');
  }
}
