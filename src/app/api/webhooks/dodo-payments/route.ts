import { NextRequest, NextResponse } from 'next/server';
import { DodoPaymentsProvider } from '@/lib/payments/dodo/DodoPaymentsProvider';
import {
  recordWebhookEvent,
  markWebhookProcessing,
  markWebhookProcessed,
  markWebhookFailed,
  handlePaymentSucceeded,
  handleCreditPurchaseSucceeded,
  handleSubscriptionActivated,
  handleSubscriptionStatusChanged,
  handlePaymentFailed,
  handleRefundIssued,
} from '@/lib/payments/WebhookService';
import type { PaymentEnvironment } from '@/lib/payments/types';

// Disable body parsing — we need the raw body for signature verification
export const dynamic = 'force-dynamic';

const provider = new DodoPaymentsProvider();

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // Extract Standard Webhooks headers used by Dodo Payments
  const webhookHeaders: Record<string, string> = {
    'webhook-id': request.headers.get('webhook-id') ?? '',
    'webhook-signature': request.headers.get('webhook-signature') ?? '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
  };

  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  const webhookSecretConfigured = !!(webhookSecret && webhookSecret.length > 0);
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as PaymentEnvironment;

  // 1. Verify webhook signature
  let verificationResult: {
    isValid: boolean;
    payload: Record<string, unknown>;
    eventType: string;
    externalEventId: string;
  } | null = null;

  if (webhookSecretConfigured) {
    // STRICT: webhook secret is configured — always verify signature
    try {
      const result = await provider.verifyWebhookSignature(rawBody, '', webhookHeaders);
      if (!result.isValid) {
        console.error('[webhook/dodo] Invalid signature');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      verificationResult = {
        isValid: true,
        payload: result.payload ?? {},
        eventType: result.eventType ?? 'unknown',
        externalEventId: result.externalEventId ?? `evt-${Date.now()}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification error';
      console.error('[webhook/dodo] Signature verification failed:', msg);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 401 });
    }
  } else if (environment === 'test') {
    // TEST MODE only: accept raw JSON when no webhook secret is configured.
    // Production always rejects unsigned events.
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const eventType = String(parsed.type ?? parsed.event_type ?? 'unknown');
      const externalEventId = webhookHeaders['webhook-id'] || String(parsed.id ?? `test-${Date.now()}`);
      verificationResult = {
        isValid: true,
        payload: parsed,
        eventType,
        externalEventId,
      };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  } else {
    // Production mode without secret — reject
    console.error('[webhook/dodo] DODO_PAYMENTS_WEBHOOK_SECRET is not configured in production mode');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  if (!verificationResult || !verificationResult.isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { payload, eventType, externalEventId } = verificationResult;

  if (!payload || !eventType || !externalEventId) {
    return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
  }

  // 2. Record event and check for duplicates (idempotency)
  let webhookEventId: string | undefined;
  try {
    const { isDuplicate, webhookEventId: evtId } = await recordWebhookEvent(
      { externalEventId, eventType, payload, environment },
      rawBody
    );

    if (isDuplicate) {
      console.log(`[webhook/dodo] Duplicate event ignored: ${externalEventId}`);
      return NextResponse.json({ received: true, status: 'duplicate_ignored' });
    }
    webhookEventId = evtId;
  } catch (err) {
    console.error('[webhook/dodo] Failed to record event:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  // 3. Mark as processing
  if (webhookEventId) {
    await markWebhookProcessing(webhookEventId);
  }

  let relatedOrderId: string | undefined;
  let relatedSubscriptionId: string | undefined;

  try {
    // Official Dodo Payments event types (from documentation)
    switch (eventType) {
      // One-time payment events
      case 'payment.succeeded': {
        const result = await handlePaymentSucceeded(payload);
        relatedOrderId = result.orderId;
        break;
      }

      // Credit pack purchases (one-time payment with credit metadata)
      case 'payment.succeeded.credit_pack': {
        const result = await handleCreditPurchaseSucceeded(payload);
        relatedOrderId = result.orderId;
        break;
      }

      // Subscription events — status active means subscription is live
      case 'subscription.active': case'subscription.renewed': {
        const result = await handleSubscriptionActivated(payload);
        relatedSubscriptionId = result.subscriptionId;
        break;
      }

      // Payment failure events
      case 'payment.failed': case'payment.cancelled': {
        await handlePaymentFailed(payload);
        break;
      }

      // Refund events
      case 'refund.succeeded': case'payment.refunded': {
        await handleRefundIssued(payload);
        break;
      }

      // Subscription lifecycle events (log only)
      case 'subscription.cancelled': case'subscription.expired': case'subscription.on_hold': case'subscription.plan_changed': case'subscription.updated': case'subscription.failed': case'subscription.paused': {
        const result = await handleSubscriptionStatusChanged(payload, eventType);
        relatedSubscriptionId = result.subscriptionId;
        break;
      }

      // License key events
      case 'license_key.created':
        console.log(`[webhook/dodo] License key created`, payload);
        break;

      default:
        console.log(`[webhook/dodo] Unhandled event type: ${eventType}`);
    }

    if (webhookEventId) {
      await markWebhookProcessed(webhookEventId, relatedOrderId, relatedSubscriptionId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing error';
    console.error(`[webhook/dodo] Processing failed for ${eventType}:`, message);

    if (webhookEventId) {
      await markWebhookFailed(webhookEventId, message);
    }

    // A non-2xx response is intentional: Dodo must retry until all local
    // fulfillment records have been created successfully.
    return NextResponse.json({ received: false, error: message }, { status: 500 });
  }
}
