// ============================================================
// SEAFOOD VISION — DodoPaymentsProvider
// Official Dodo Payments TypeScript SDK integration.
// Server-side only. Never expose API key to frontend.
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
    if (!config.isEnabled || !config.isConfigured) {
      throw new Error('Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_WEBHOOK_SECRET.');
    }

    const client = createDodoClient();

    // Dodo Payments uses product_cart with product_id from payment_product_mappings
    // For one-time payments we need a product_id mapped in the Dodo dashboard
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
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        order_id: params.orderId,
        user_id: params.userId,
        ...(params.metadata ?? {}),
      },
    });

    return {
      checkoutUrl: (session as unknown as { url: string }).url ?? (session as unknown as { checkout_url: string }).checkout_url,
      externalCheckoutId: session.session_id,
    };
  }

  async createSubscriptionCheckout(
    params: CreateSubscriptionCheckoutParams
  ): Promise<SubscriptionCheckoutResult> {
    const config = getDodoConfig();
    if (!config.isEnabled || !config.isConfigured) {
      throw new Error('Dodo Payments is not configured.');
    }

    const client = createDodoClient();

    // Subscription checkout uses a price_id (recurring price) from Dodo dashboard
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
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        order_id: params.orderId,
        user_id: params.userId,
        plan_id: params.planId,
        billing_cycle: params.billingCycle,
      },
    });

    return {
      checkoutUrl: (session as unknown as { url: string }).url ?? (session as unknown as { checkout_url: string }).checkout_url,
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
      status: 'cancelled',
    } as Parameters<typeof client.subscriptions.update>[1]);
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

    const client = createDodoClient();

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
