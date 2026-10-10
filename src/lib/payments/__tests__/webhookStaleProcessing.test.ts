import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// Minimal Supabase stand-in: one payment_webhook_events row.
const state: { row: Record<string, unknown> | null; updates: Array<Record<string, unknown>> } = { row: null, updates: [] };

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => {
      const b: Record<string, any> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => ({ data: state.row, error: null });
      b.update = (values: Record<string, unknown>) => { state.updates.push(values); return b; };
      b.insert = () => b;
      b.single = async () => ({ data: { id: 'new-event' }, error: null });
      return b;
    },
  }),
}));

import { STALE_PROCESSING_MS, isWebhookEventDuplicate, markWebhookProcessing, recordWebhookEvent } from '../WebhookService';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const event = { externalEventId: 'evt_1', eventType: 'payment.succeeded', payload: {}, environment: 'test' } as never;

beforeEach(() => { state.row = null; state.updates = []; });

describe('an event stuck in processing is taken over after 5 minutes', () => {
  test('the threshold is 5 minutes', () => expect(STALE_PROCESSING_MS).toBe(5 * 60 * 1000));

  test('processing for less than 5 minutes is still in flight (duplicate)', () => {
    expect(isWebhookEventDuplicate('processing', ago(60_000), NOW)).toBe(true);
    expect(isWebhookEventDuplicate('processing', ago(STALE_PROCESSING_MS), NOW)).toBe(true);
  });

  test('processing for more than 5 minutes is no longer a duplicate', () => {
    expect(isWebhookEventDuplicate('processing', ago(STALE_PROCESSING_MS + 1), NOW)).toBe(false);
    expect(isWebhookEventDuplicate('processing', ago(35 * 60 * 1000), NOW)).toBe(false);
  });

  test('without a usable start time it stays in flight', () => {
    expect(isWebhookEventDuplicate('processing')).toBe(true);
    expect(isWebhookEventDuplicate('processing', null, NOW)).toBe(true);
    expect(isWebhookEventDuplicate('processing', 'not a date', NOW)).toBe(true);
  });

  test('a processed event is a duplicate however old it is', () => {
    expect(isWebhookEventDuplicate('processed', ago(30 * 24 * 3600 * 1000), NOW)).toBe(true);
    expect(isWebhookEventDuplicate('ignored_duplicate', ago(30 * 24 * 3600 * 1000), NOW)).toBe(true);
  });

  test('recordWebhookEvent resumes a stale processing event and keeps its row', async () => {
    state.row = { id: 'evt-row', processing_status: 'processing', received_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() };
    await expect(recordWebhookEvent(event, '{}')).resolves.toEqual({ isDuplicate: false, webhookEventId: 'evt-row' });
  });

  test('recordWebhookEvent still ignores a recent processing event', async () => {
    state.row = { id: 'evt-row', processing_status: 'processing', received_at: new Date(Date.now() - 30_000).toISOString() };
    await expect(recordWebhookEvent(event, '{}')).resolves.toEqual({ isDuplicate: true, webhookEventId: 'evt-row' });
  });

  test('recordWebhookEvent still ignores a processed event', async () => {
    state.row = { id: 'evt-row', processing_status: 'processed', received_at: new Date(Date.now() - 3600_000).toISOString() };
    await expect(recordWebhookEvent(event, '{}')).resolves.toEqual({ isDuplicate: true, webhookEventId: 'evt-row' });
  });

  test('marking an event as processing restarts the 5-minute clock', async () => {
    await markWebhookProcessing('evt-row');
    expect(state.updates[0]).toMatchObject({ processing_status: 'processing' });
    expect(Date.now() - Date.parse(String(state.updates[0].received_at))).toBeLessThan(5_000);
  });
});
