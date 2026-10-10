import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertAbsoluteReturnUrls, getDodoCancelUrl, getDodoReturnUrl, requestOrigin, resolveSiteBase } from '../dodo/config';
import { DodoPaymentsProvider } from '../dodo/DodoPaymentsProvider';

// Dodo answers 400 "return_url: must be a valid URL" to any relative return/cancel URL.
const VARS = ['NEXT_PUBLIC_SITE_URL', 'DODO_PAYMENTS_RETURN_URL', 'DODO_PAYMENTS_CANCEL_URL'] as const;
const saved: Record<string, string | undefined> = {};
const isAbsolute = (value: string) => /^https?:\/\/[^/\s]+/.test(value);

beforeEach(() => { for (const name of VARS) { saved[name] = process.env[name]; delete process.env[name]; } });
afterEach(() => { for (const name of VARS) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; } });

describe('Dodo return and cancel URLs are always absolute', () => {
  test('all variables empty: the request origin is the base', () => {
    expect(getDodoReturnUrl('http://localhost:4028')).toBe('http://localhost:4028/checkout/success');
    expect(getDodoCancelUrl('http://localhost:4028')).toBe('http://localhost:4028/checkout/cancel');
  });

  test('NEXT_PUBLIC_SITE_URL wins over the request origin; a trailing slash is dropped', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example.com/';
    expect(getDodoReturnUrl('http://localhost:4028')).toBe('https://shop.example.com/checkout/success');
    expect(getDodoCancelUrl()).toBe('https://shop.example.com/checkout/cancel');
  });

  test('a relative or blank dedicated variable falls back to the base instead of being sent as is', () => {
    process.env.DODO_PAYMENTS_RETURN_URL = '/checkout/success';
    process.env.DODO_PAYMENTS_CANCEL_URL = '   ';
    const success = getDodoReturnUrl('http://localhost:4028');
    const cancel = getDodoCancelUrl('http://localhost:4028');
    expect(success).toBe('http://localhost:4028/checkout/success');
    expect(cancel).toBe('http://localhost:4028/checkout/cancel');
    expect(isAbsolute(success) && isAbsolute(cancel)).toBe(true);
  });

  test('an absolute dedicated variable is honoured', () => {
    process.env.DODO_PAYMENTS_RETURN_URL = 'https://shop.example.com/merci';
    expect(getDodoReturnUrl('http://localhost:4028')).toBe('https://shop.example.com/merci');
  });

  test('a relative NEXT_PUBLIC_SITE_URL is ignored in favour of the request origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '/';
    expect(resolveSiteBase('https://tunnel.example.com')).toBe('https://tunnel.example.com');
  });

  test('without any absolute base it fails loudly instead of sending a relative URL', () => {
    expect(() => getDodoReturnUrl()).toThrow('absolute');
    expect(() => getDodoCancelUrl('')).toThrow('absolute');
    expect(() => getDodoReturnUrl('not-a-url')).toThrow('absolute');
  });

  test('the guard refuses relative URLs and accepts absolute ones', () => {
    expect(() => assertAbsoluteReturnUrls({ successUrl: '/checkout/success?order=1', cancelUrl: 'http://localhost:4028/c' })).toThrow('absolute');
    expect(() => assertAbsoluteReturnUrls({ successUrl: 'http://localhost:4028/s', cancelUrl: '/checkout/cancel' })).toThrow('absolute');
    expect(() => assertAbsoluteReturnUrls({ successUrl: 'http://localhost:4028/s?order=1', cancelUrl: 'https://x.test/c' })).not.toThrow();
  });
});

// The dev server listens on 0.0.0.0, so nextUrl.origin is http://0.0.0.0:4028: unreachable from the browser.
const req = (headers: Record<string, string>, origin = 'http://0.0.0.0:4028') => ({
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  nextUrl: { origin },
});

describe('0.0.0.0 and other unroutable hosts are never used', () => {
  test.each(['http://0.0.0.0:4028', 'http://[::]:4028', 'http://169.254.10.1', 'http://255.255.255.255'])('%s is not a usable base', (origin) => {
    expect(() => resolveSiteBase(origin)).toThrow('absolute');
    expect(() => getDodoReturnUrl(origin)).toThrow('absolute');
  });

  test('NEXT_PUBLIC_SITE_URL on 0.0.0.0 is ignored in favour of a routable origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://0.0.0.0:4028';
    expect(getDodoReturnUrl('http://localhost:4028')).toBe('http://localhost:4028/checkout/success');
  });

  test('a dedicated variable on 0.0.0.0 falls back to the base', () => {
    process.env.DODO_PAYMENTS_RETURN_URL = 'http://0.0.0.0:4028/checkout/success';
    expect(getDodoReturnUrl('http://localhost:4028')).toBe('http://localhost:4028/checkout/success');
  });

  test('the guard refuses 0.0.0.0 return URLs', () => {
    expect(() => assertAbsoluteReturnUrls({ successUrl: 'http://0.0.0.0:4028/checkout/success', cancelUrl: 'http://localhost:4028/c' })).toThrow('absolute');
  });

  test('loopback names stay allowed (local development)', () => {
    expect(resolveSiteBase('http://localhost:4028')).toBe('http://localhost:4028');
    expect(resolveSiteBase('http://127.0.0.1:4028')).toBe('http://127.0.0.1:4028');
  });
});

describe('requestOrigin prefers the forwarded host and the Host header over nextUrl.origin', () => {
  test('Host header beats the 0.0.0.0 nextUrl.origin', () => {
    expect(requestOrigin(req({ host: 'localhost:4028' }))).toBe('http://localhost:4028');
  });

  test('x-forwarded-host and x-forwarded-proto beat Host (tunnel)', () => {
    expect(requestOrigin(req({ host: 'localhost:4028', 'x-forwarded-host': 'abc.trycloudflare.com', 'x-forwarded-proto': 'https' })))
      .toBe('https://abc.trycloudflare.com');
  });

  test('a comma-separated forwarded list uses its first entry', () => {
    expect(requestOrigin(req({ 'x-forwarded-host': 'shop.example.com, internal:3000', 'x-forwarded-proto': 'https, http' })))
      .toBe('https://shop.example.com');
  });

  test('a Host of 0.0.0.0 is skipped; without any usable header, a routable nextUrl.origin is the fallback', () => {
    expect(requestOrigin(req({ host: '0.0.0.0:4028' }, 'http://localhost:4028'))).toBe('http://localhost:4028');
  });

  test('nothing usable gives null, never 0.0.0.0', () => {
    expect(requestOrigin(req({ host: '0.0.0.0:4028' }))).toBeNull();
    expect(requestOrigin(req({}))).toBeNull();
  });

  test('the origin it returns builds absolute, routable return URLs', () => {
    const origin = requestOrigin(req({ host: 'localhost:4028' }));
    expect(getDodoReturnUrl(origin)).toBe('http://localhost:4028/checkout/success');
    expect(getDodoCancelUrl(origin)).toBe('http://localhost:4028/checkout/cancel');
  });
});

describe('the Dodo provider never sends a relative return URL', () => {
  const provider = new DodoPaymentsProvider();
  const base = { orderId: 'o1', userId: 'u1', userEmail: 'a@b.test', amount: 5, currency: 'EUR', productName: 'x' };

  test('createCheckout refuses relative URLs before calling Dodo', async () => {
    await expect(provider.createCheckout({ ...base, successUrl: '/checkout/success?order=o1', cancelUrl: '/checkout/cancel?order=o1' }))
      .rejects.toThrow('absolute');
  });

  test('createSubscriptionCheckout refuses relative URLs before calling Dodo', async () => {
    await expect(provider.createSubscriptionCheckout({
      ...base, planId: 'p', planName: 'P', billingCycle: 'monthly', dodoPriceId: 'pdt_x',
      successUrl: '/checkout/success', cancelUrl: '/checkout/cancel',
    } as never)).rejects.toThrow('absolute');
  });
});

describe('every checkout passes the request origin when it builds return URLs', () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  test.each(['src/lib/payments/CartService.ts', 'src/lib/payments/CheckoutService.ts'])('%s', (path) => {
    const code = source(path);
    expect(code).not.toMatch(/getDodo(Return|Cancel)Url\(\)/);
    expect(code).toMatch(/getDodoReturnUrl\(params\.origin\)/);
  });
  test.each([
    'src/app/api/cart/checkout/route.ts',
    'src/app/api/payments/dodo/checkout/route.ts',
    'src/app/api/payments/dodo/credit-checkout/route.ts',
    'src/app/api/payments/dodo/subscription-checkout/route.ts',
  ])('%s forwards requestOrigin(request), never nextUrl.origin directly', (path) => {
    expect(source(path)).toContain('origin: requestOrigin(request)');
    expect(source(path)).not.toContain('request.nextUrl.origin');
  });
});
