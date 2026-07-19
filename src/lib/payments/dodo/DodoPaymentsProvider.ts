// ============================================================
// SEAFOOD VISION — DodoPaymentsProvider
// Official Dodo Payments TypeScript SDK integration.
// Server-side only. Never expose API key to frontend.
//
// VARIABLE MAPPING (server-side):
//   DODO_PAYMENTS_API_KEY        → bearerToken (FOUND/MISSING)
//   DODO_PAYMENTS_WEBHOOK_SECRET → webhookKey  (FOUND/MISSING)
//   DODO_PAYMENTS_ENVIRONMENT    → environment (FOUND, defaults to 'test')
// ============================================================

import DodoPayments from 'dodopayments';
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

function createDodoClient(): DodoPayments {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const env = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
  // The Dodo SDK constructor accepts webhookKey for signature verification.
  // We read DODO_PAYMENTS_WEBHOOK_SECRET (our env var name) and pass it as webhookKey.
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  return new DodoPayments({
    bearerToken: apiKey,
    environment: env === 'production' ? 'live_mode' : 'test_mode',
    ...(webhookKey ? { webhookKey } : {}),
  });
}

export class DodoPaymentsProvider implements PaymentProvider {
  getConfig(): PaymentProviderConfig {
    return getDodoConfig();
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const config = getDodoConfig();
    // Checkout only requires the API key (isCheckoutReady), NOT the webhook secret.
    if (!config.isCheckoutReady) {
      throw new Error(
        'Dodo Payments is not configured for checkout. Set DODO_PAYMENTS_API_KEY and ensure NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=true.'
      );
    }

    const client = createDodoClient();

    // Dodo Payments API uses return_url (not success_url) and cancel_url.
    // The response contains checkout_url and session_id.
    const session = await client.checkoutSessions.create({
      product_cart: [
        {
          product_id: params.metadata?.dodoProductId as string ?? params.orderId,
          quantity: 1,
        },
      ],
      customer: {
        email: params.userEmail,
      },
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        order_id: params.orderId,
        user_id: params.userId,
        ...(params.metadata ?? {}),
      },
    });

    const checkoutUrl = session.checkout_url ?? '';
    if (!checkoutUrl) {
      throw new Error('Dodo Payments did not return a checkout_url. Check your API key and product ID.');
    }

    return {
      checkoutUrl,
      externalCheckoutId: session.session_id,
    };
  }

  async createSubscriptionCheckout(
    params: CreateSubscriptionCheckoutParams
  ): Promise<SubscriptionCheckoutResult> {
    const config = getDodoConfig();
    // Checkout only requires the API key (isCheckoutReady), NOT the webhook secret.
    if (!config.isCheckoutReady) {
      throw new Error(
        'Dodo Payments is not configured for checkout. Set DODO_PAYMENTS_API_KEY and ensure NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=true.'
      );
    }

    const client = createDodoClient();

    // Subscription checkout: use product_id (Dodo Product ID from payment_product_mappings).
    // Dodo API uses return_url (not success_url).
    const session = await client.checkoutSessions.create({
      product_cart: [
        {
          product_id: params.dodoPriceId,
          quantity: 1,
        },
      ],
      customer: {
        email: params.userEmail,
      },
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        order_id: params.orderId,
        user_id: params.userId,
        plan_id: params.planId,
        billing_cycle: params.billingCycle,
      },
    });

    const checkoutUrl = session.checkout_url ?? '';
    if (!checkoutUrl) {
      throw new Error('Dodo Payments did not return a checkout_url. Check your API key and product ID.');
    }

    return {
      checkoutUrl,
      externalCheckoutId: session.session_id,
    };
  }

  async getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult> {
    const client = createDodoClient();
    const payment = await client.payments.retrieve(externalPaymentId);
    const status = (payment as unknown as { status: string }).status ?? 'unknown';

    return {
      externalPaymentId,
      status: mapDodoPaymentStatus(status),
      rawStatus: status,
    };
  }

  async getSubscriptionDetails(externalSubscriptionId: string): Promise<SubscriptionDetails> {
    const client = createDodoClient();
    const sub = await client.subscriptions.retrieve(externalSubscriptionId);
    const s = sub as unknown as Record<string, unknown>;

    return {
      externalSubscriptionId,
      status: mapDodoSubscriptionStatus(String(s.status ?? '')),
      currentPeriodStart: s.current_period_start ? new Date(s.current_period_start as string) : null,
      currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end as string) : null,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end ?? false),
    };
  }

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const client = createDodoClient();
    await client.subscriptions.update(params.externalSubscriptionId, {
      cancel_at_next_billing_date: params.cancelAtPeriodEnd,
      ...(params.cancelAtPeriodEnd ? {} : { status: 'cancelled' as const }),
      cancel_reason: 'cancelled_by_customer',
    });
  }

  async verifyWebhookSignature(
    rawBody: string,
    _signature: string,
    headers?: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    if (!webhookKey) {
      throw new Error('DODO_PAYMENTS_WEBHOOK_SECRET is not set');
    }

    // Create a client with the webhook key for signature verification.
    // The SDK's webhooks.unwrap() uses the webhookKey passed to the constructor.
    const client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') === 'production' ? 'live_mode' : 'test_mode',
      webhookKey,
    });

    try {
      const unwrapped = client.webhooks.unwrap(rawBody, {
        headers: {
          'webhook-id': headers?.['webhook-id'] ?? '',
          'webhook-signature': headers?.['webhook-signature'] ?? '',
          'webhook-timestamp': headers?.['webhook-timestamp'] ?? '',
        },
      });

      const u = unwrapped as unknown as Record<string, unknown>;
      const eventType = String(u.type ?? u.event_type ?? 'unknown');
      const externalEventId = headers?.['webhook-id'] ?? String(u.id ?? `evt-${Date.now()}`);

      return {
        isValid: true,
        payload: u as Record<string, unknown>,
        eventType,
        externalEventId,
      };
    } catch {
      return {
        isValid: false,
        payload: {},
        eventType: 'unknown',
        externalEventId: 'invalid',
      };
    }
  }
}

function mapDodoPaymentStatus(status: string): 'pending' | 'succeeded' | 'failed' | 'refunded' | 'cancelled' {
  switch (status.toLowerCase()) {
    case 'succeeded': case 'paid': case 'completed': return 'succeeded';
    case 'failed': case 'declined': return 'failed';
    case 'refunded': return 'refunded';
    case 'cancelled': case 'canceled': return 'cancelled';
    default: return 'pending';
  }
}

function mapDodoSubscriptionStatus(status: string): 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired' | 'pending' {
  switch (status.toLowerCase()) {
    case 'active': return 'active';
    case 'trialing': case 'trial': return 'trialing';
    case 'past_due': case 'on_hold': return 'past_due';
    case 'cancelled': case 'canceled': return 'cancelled';
    case 'expired': return 'expired';
    default: return 'pending';
  }
}
