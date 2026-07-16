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

  const webhookSecretConfigured = !!(
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET &&
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET.length > 0
  );

  // 1. Verify webhook signature
  let verificationResult;
  try {
    verificationResult = await provider.verifyWebhookSignature(rawBody, '', webhookHeaders);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification error';
    console.error('[webhook/dodo] Signature verification threw:', msg);

    // STRICT: if webhook secret is configured, ALWAYS reject invalid signatures
    if (webhookSecretConfigured) {
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 401 }
      );
    }

    // Only allow unsigned events in test mode WITHOUT a secret configured (local dev only)
    const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
    if (environment === 'test' && !webhookSecretConfigured) {
      try {
        const parsed = JSON.parse(rawBody);
        verificationResult = {
          isValid: true,
          payload: parsed as Record<string, unknown>,
          eventType: String(parsed.type ?? parsed.event_type ?? 'unknown'),
          externalEventId:
            webhookHeaders['webhook-id'] ||
            String(parsed.id ?? `test-${Date.now()}`),
        };
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 401 }
      );
    }
  }

  if (!verificationResult || !verificationResult.isValid) {
    console.error('[webhook/dodo] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { payload, eventType, externalEventId } = verificationResult;

  if (!payload || !eventType || !externalEventId) {
    return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
  }

  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as PaymentEnvironment;

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
      case 'subscription.cancelled': case'subscription.expired': case'subscription.on_hold': case'subscription.plan_changed': case'subscription.updated': case'subscription.failed':
        console.log(`[webhook/dodo] Subscription lifecycle event: ${eventType}`, payload);
        break;

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

    // Return 200 to prevent Dodo from retrying events we've already recorded
    return NextResponse.json({ received: true, error: message });
  }
}
