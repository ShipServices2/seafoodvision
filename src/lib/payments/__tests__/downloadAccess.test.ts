import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  DEFAULT_DOWNLOAD_SIGNED_URL_SECONDS,
  deliveredFileLevel,
  downloadSignedUrlDuration,
} from '@/lib/downloads/fileSelection';

type Row = Record<string, unknown>;
const state: {
  tables: Record<string, Row[]>;
  signedCalls: Array<{ bucket: string; path: string; seconds: number; options?: unknown }>;
  user: { id: string } | null;
} = { tables: {}, signedCalls: [], user: { id: 'buyer-1' } };

function fakeService() {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let mode: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      const matching = () => (state.tables[table] ?? []).filter((row) => filters.every(([k, v]) => row[k] === v));
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (k: string, v: unknown) => { filters.push([k, v]); return builder; };
      for (const m of ['in', 'is', 'order', 'limit']) builder[m] = () => builder;
      builder.update = (p: Row) => { mode = 'update'; patch = p; return builder; };
      builder.insert = () => { mode = 'insert'; return builder; };
      const one = async () => {
        const rows = matching();
        if (mode === 'update') { rows.forEach((r) => Object.assign(r, patch)); return { data: rows[0] ? { id: rows[0].id } : null, error: null }; }
        return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } };
      };
      builder.single = one;
      builder.maybeSingle = one;
      builder.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok, ko);
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, seconds: number, options?: unknown) => {
          state.signedCalls.push({ bucket, path, seconds, options });
          return { data: { signedUrl: `https://signed.example/${bucket}/${path}?t=${seconds}` }, error: null };
        },
      }),
    },
  };
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
  createServiceClient: () => fakeService(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('@/app/api/downloads/[entitlementId]/route') as typeof import('@/app/api/downloads/[entitlementId]/route');

const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/downloads/${id}`), { params: Promise.resolve({ entitlementId: id }) });

const entitlement = (resolution: string): Row => ({
  id: 'ent-1', user_id: 'buyer-1', asset_id: 'asset-1', status: 'active', valid_until: null,
  downloads_used: 0, download_count: 0, max_downloads: 1, purchased_license_id: 'lic-1',
  allowed_resolution: resolution, resolution_allowed: resolution,
});

const webFile: Row = { asset_id: 'asset-1', file_level: 'web', storage_bucket: 'asset-originals', storage_path: 'web/ab/abc.jpg', mime_type: 'image/jpeg' };
const originalFile: Row = { asset_id: 'asset-1', file_level: 'original', storage_bucket: 'asset-originals', storage_path: 'originals/ab/abc.jpg', mime_type: 'image/jpeg' };

beforeEach(() => {
  state.user = { id: 'buyer-1' };
  state.signedCalls = [];
  state.tables = {
    purchased_licenses: [{ id: 'lic-1', status: 'active' }],
    assets: [{ id: 'asset-1', public_asset_id: 'SV-IMP-0042' }],
    download_events: [],
  };
});

describe('which file a purchase receives', () => {
  test.each([
    ['web', 'web'], ['WEB', 'web'], ['hd', 'original'], ['HD', 'original'], ['ultrahd', 'original'],
    ['full', 'original'], ['original', 'original'],
    // unknown / missing: least privilege, never the original
    ['', 'web'], ['something-else', 'web'], [null, 'web'], [undefined, 'web'],
  ])('allowed_resolution %p -> %s file', (resolution, level) => {
    expect(deliveredFileLevel(resolution as string | null | undefined)).toBe(level);
  });

  test('signed URL duration: 300 s by default, configurable, bounded', () => {
    expect(DEFAULT_DOWNLOAD_SIGNED_URL_SECONDS).toBe(300);
    expect(downloadSignedUrlDuration(undefined)).toBe(300);
    expect(downloadSignedUrlDuration('')).toBe(300);
    expect(downloadSignedUrlDuration('abc')).toBe(300);
    expect(downloadSignedUrlDuration('-5')).toBe(300);
    expect(downloadSignedUrlDuration('120')).toBe(120);
    expect(downloadSignedUrlDuration('999999')).toBe(3600);
  });
});

describe('GET /api/downloads/[entitlementId]: a Web purchase is never the original', () => {
  test('Photo Web gets the web file, with a 300 s signed URL', async () => {
    state.tables.download_entitlements = [entitlement('web')];
    state.tables.asset_files = [originalFile, webFile];
    const res = await call('ent-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileLevel).toBe('web');
    expect(body.expiresIn).toBe(300);
    expect(body.fileName).toBe('SV-IMP-0042-web.jpg');
    expect(state.signedCalls).toHaveLength(1);
    expect(state.signedCalls[0].path).toBe('web/ab/abc.jpg');
    expect(state.signedCalls[0].path).not.toContain('originals/');
    expect(state.signedCalls[0].seconds).toBe(300);
  });

  test('Photo Web without a generated web file is refused: it does NOT fall back to the original', async () => {
    state.tables.download_entitlements = [entitlement('web')];
    state.tables.asset_files = [originalFile]; // no web file
    const res = await call('ent-1');
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('WEB_FILE_NOT_AVAILABLE');
    expect(state.signedCalls).toHaveLength(0);
    expect(state.tables.download_entitlements[0].downloads_used).toBe(0); // no quota consumed
  });

  test('Photo HD gets the original', async () => {
    state.tables.download_entitlements = [entitlement('hd')];
    state.tables.asset_files = [originalFile, webFile];
    const res = await call('ent-1');
    expect(res.status).toBe(200);
    expect((await res.json()).fileLevel).toBe('original');
    expect(state.signedCalls[0].path).toBe('originals/ab/abc.jpg');
  });

  test('a missing allowed_resolution is treated as web, not as HD', async () => {
    const ent = entitlement('web');
    ent.allowed_resolution = null;
    ent.resolution_allowed = null;
    state.tables.download_entitlements = [ent];
    state.tables.asset_files = [originalFile, webFile];
    const res = await call('ent-1');
    expect(res.status).toBe(200);
    expect(state.signedCalls[0].path).toBe('web/ab/abc.jpg');
  });

  test('another user\'s entitlement is forbidden and anonymous is unauthorised', async () => {
    state.tables.download_entitlements = [{ ...entitlement('hd'), user_id: 'someone-else' }];
    state.tables.asset_files = [originalFile, webFile];
    expect((await call('ent-1')).status).toBe(403);
    state.user = null;
    expect((await call('ent-1')).status).toBe(401);
    expect(state.signedCalls).toHaveLength(0);
  });

  test('an exhausted entitlement gets no URL', async () => {
    state.tables.download_entitlements = [{ ...entitlement('hd'), downloads_used: 1 }];
    state.tables.asset_files = [originalFile, webFile];
    expect((await call('ent-1')).status).toBe(403);
    expect(state.signedCalls).toHaveLength(0);
  });
});
