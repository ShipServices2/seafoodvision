import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

// Standard Webhooks (used by Dodo Payments): signature = base64(HMAC-SHA256(secret bytes, `${id}.${timestamp}.${body}`)), header "v1,<signature>".
const SECRET_BYTES = Buffer.from('0123456789abcdef0123456789abcdef');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

const sign = (id: string, timestamp: string, body: string, secret = SECRET_BYTES) =>
  `v1,${createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64')}`;

const calls = {
  recordWebhookEvent: jest.fn(async (_event: unknown, _raw: string) => ({ isDuplicate: false, webhookEventId: 'evt-row-1' })),
  markWebhookProcessing: jest.fn(async (..._args: unknown[]) => undefined),
  markWebhookProcessed: jest.fn(async (..._args: unknown[]) => undefined),
  markWebhookFailed: jest.fn(async (..._args: unknown[]) => undefined),
  handlePaymentSucceeded: jest.fn(async (_payload: unknown) => ({ orderId: 'order-1' })),
  handleCreditPurchaseSucceeded: jest.fn(async () => ({ orderId: 'order-1' })),
  handleSubscriptionActivated: jest.fn(async () => ({ subscriptionId: 'sub-1' })),
  handleSubscriptionStatusChanged: jest.fn(async () => ({ subscriptionId: 'sub-1' })),
  handlePaymentFailed: jest.fn(async () => undefined),
  handleRefundIssued: jest.fn(async () => undefined),
};
jest.mock('@/lib/payments/WebhookService', () => calls);

const saved = { ...process.env };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadRoute = () => require('@/app/api/webhooks/dodo-payments/route') as typeof import('@/app/api/webhooks/dodo-payments/route');

const body = JSON.stringify({
  type: 'payment.succeeded',
  data: { payment_id: 'pay_1', metadata: { order_id: 'order-1' }, status: 'succeeded' },
});

function request(opts: { id?: string; timestamp?: string; signature?: string; payload?: string; omit?: Array<'webhook-id' | 'webhook-signature' | 'webhook-timestamp'> } = {}) {
  const id = opts.id ?? 'msg_1';
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const payload = opts.payload ?? body;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': opts.signature ?? sign(id, timestamp, body), // signed over the ORIGINAL body unless overridden
  };
  for (const h of opts.omit ?? []) delete headers[h];
  return new NextRequest('http://localhost/api/webhooks/dodo-payments', { method: 'POST', headers, body: payload });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DODO_PAYMENTS_WEBHOOK_SECRET = SECRET;
  process.env.DODO_PAYMENTS_API_KEY = 'test_api_key_not_real';
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test';
  calls.recordWebhookEvent.mockResolvedValue({ isDuplicate: false, webhookEventId: 'evt-row-1' });
});
afterAll(() => { process.env = saved; });

const nothingProcessed = () => {
  expect(calls.recordWebhookEvent).not.toHaveBeenCalled();
  expect(calls.handlePaymentSucceeded).not.toHaveBeenCalled();
};

describe('POST /api/webhooks/dodo-payments: signature verification', () => {
  test('a valid signature is accepted and the payment is fulfilled once', async () => {
    const { POST } = loadRoute();
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(calls.recordWebhookEvent).toHaveBeenCalledTimes(1);
    expect(calls.handlePaymentSucceeded).toHaveBeenCalledTimes(1);
    expect(calls.markWebhookProcessed).toHaveBeenCalledWith('evt-row-1', 'order-1', undefined);
  });

  test('an invalid signature is rejected with 401 and nothing is recorded or fulfilled', async () => {
    const { POST } = loadRoute();
    const res = await POST(request({ signature: sign('msg_1', String(Math.floor(Date.now() / 1000)), body, Buffer.from('another-secret-another-secret-123')) }));
    expect(res.status).toBe(401);
    nothingProcessed();
  });

  test('a garbage signature is rejected', async () => {
    const { POST } = loadRoute();
    expect((await POST(request({ signature: 'v1,not-a-real-signature' }))).status).toBe(401);
    nothingProcessed();
  });

  test('a body altered after signing is rejected', async () => {
    const { POST } = loadRoute();
    const tampered = body.replace('pay_1', 'pay_EVIL');
    expect((await POST(request({ payload: tampered }))).status).toBe(401);
    nothingProcessed();
  });

  test.each(['webhook-id', 'webhook-signature', 'webhook-timestamp'] as const)('a missing %s header is rejected', async (header) => {
    const { POST } = loadRoute();
    expect((await POST(request({ omit: [header] }))).status).toBe(401);
    nothingProcessed();
  });

  test('a valid signature on a stale timestamp (replay) is rejected', async () => {
    const { POST } = loadRoute();
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect((await POST(request({ timestamp: old, signature: sign('msg_1', old, body) }))).status).toBe(401);
    nothingProcessed();
  });

  test('the same event delivered twice is acknowledged but fulfilled only once', async () => {
    const { POST } = loadRoute();
    expect((await POST(request({ id: 'msg_dup' }))).status).toBe(200);
    calls.recordWebhookEvent.mockResolvedValueOnce({ isDuplicate: true, webhookEventId: 'evt-row-1' });
    const second = await POST(request({ id: 'msg_dup' }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, status: 'duplicate_ignored' });
    expect(calls.handlePaymentSucceeded).toHaveBeenCalledTimes(1);
  });

  test('without a configured secret the endpoint refuses everything (503)', async () => {
    delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    const { POST } = loadRoute();
    expect((await POST(request())).status).toBe(503);
    nothingProcessed();
  });

  test('a processing failure answers 500 so that Dodo retries', async () => {
    calls.handlePaymentSucceeded.mockRejectedValueOnce(new Error('boom'));
    const { POST } = loadRoute();
    expect((await POST(request({ id: 'msg_fail' }))).status).toBe(500);
    expect(calls.markWebhookFailed).toHaveBeenCalledWith('evt-row-1', 'boom');
  });
});
