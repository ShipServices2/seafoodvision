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

const provider = new DodoPaymentsProvider();

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  const signature = request.headers.get('dodo-signature') ?? '';

  // 1. Verify webhook signature
  let verificationResult;
  try {
    verificationResult = await provider.verifyWebhookSignature(rawBody, signature);
  } catch {
    // Provider not yet implemented — in test mode, accept unsigned events
    const config = provider.getConfig();
    if (config.environment === 'test' && !config.isConfigured) {
      // Parse body manually for test mode
      try {
        const parsed = JSON.parse(rawBody);
        verificationResult = {
          isValid: true,
          payload: parsed,
          eventType: parsed.type ?? parsed.event_type ?? 'unknown',
          externalEventId: parsed.id ?? parsed.event_id ?? `test-${Date.now()}`,
        };
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 401 });
    }
  }

  if (!verificationResult.isValid) {
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
      return NextResponse.json({ received: true, status: 'duplicate_ignored' });
    }
    webhookEventId = evtId;
  } catch (err) {
    console.error('[webhook/dodo] Failed to record event:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  // 3. Process event
  if (webhookEventId) {
    await markWebhookProcessing(webhookEventId);
  }

  let relatedOrderId: string | undefined;
  let relatedSubscriptionId: string | undefined;

  try {
    // TODO: Replace these event type strings with the actual Dodo Payments event names
    // from the official Dodo Payments webhook documentation.
    // These are placeholder names — update when API docs are confirmed.
    switch (eventType) {
      case 'payment.succeeded': case'checkout.completed': {
        const result = await handlePaymentSucceeded(payload);
        relatedOrderId = result.orderId;
        break;
      }

      case 'credit_pack.payment.succeeded': {
        const result = await handleCreditPurchaseSucceeded(payload);
        relatedOrderId = result.orderId;
        break;
      }

      case 'subscription.activated': case'subscription.renewed': {
        const result = await handleSubscriptionActivated(payload);
        relatedSubscriptionId = result.subscriptionId;
        break;
      }

      case 'payment.failed': case'checkout.expired': {
        await handlePaymentFailed(payload);
        break;
      }

      case 'refund.issued': case'payment.refunded': {
        await handleRefundIssued(payload);
        break;
      }

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
