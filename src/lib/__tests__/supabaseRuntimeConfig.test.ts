/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, describe, expect, jest, test } from '@jest/globals';

describe('createServiceClient runtime normalization', () => {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  afterEach(() => {
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.serviceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.serviceRole;
  });

  test('rejects a whitespace-only service role key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ' https://runtime-project.supabase.co ';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '   ';
    jest.isolateModules(() => {
      jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: () => {} }) }));
      const { createServiceClient } = require('../supabase/server');
      expect(() => createServiceClient()).toThrow(
        'Supabase service role is not configured for server-side commerce operations'
      );
    });
  });

  test('accepts trimmed runtime server credentials', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ' https://runtime-project.supabase.co ';
    process.env.SUPABASE_SERVICE_ROLE_KEY = ' runtime-service-role-key ';
    jest.isolateModules(() => {
      jest.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: () => {} }) }));
      const { createServiceClient } = require('../supabase/server');
      expect(() => createServiceClient()).not.toThrow();
    });
  });
});
