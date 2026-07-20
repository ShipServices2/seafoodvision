/**
 * Tests for Supabase client initialization strategy.
 *
 * Verifies:
 *  - Importing client/server modules never throws.
 *  - createClient() throws SupabaseConfigurationError when env vars are absent.
 *  - getSupabaseServerClient() throws SupabaseServerConfigurationError when env vars are absent.
 *  - isSupabaseConfigured() / isSupabaseServerConfigured() return false when vars are absent.
 *  - No silent empty result is returned as if a query succeeded.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- require() is intentional here so isolateModules reloads each module with the test-specific environment. */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clearSupabaseEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function setSupabasePlaceholderEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-key';
}

// ── 1. Module import never throws ────────────────────────────────────────────

describe('Module import — never throws', () => {
  test('importing client module does not throw', () => {
    expect(() => {
      // Dynamic require so we can test import-time behaviour
      jest.isolateModules(() => {
        require('../supabase/client');
      });
    }).not.toThrow();
  });

  test('importing server module does not throw', () => {
    expect(() => {
      jest.isolateModules(() => {
        // Mock next/headers so it doesn't crash outside Next.js runtime
        jest.mock('next/headers', () => ({
          cookies: () => ({ getAll: () => [], set: () => {} }),
        }));
        require('../supabase/server');
      });
    }).not.toThrow();
  });
});

// ── 2. isSupabaseConfigured() ─────────────────────────────────────────────────

describe('isSupabaseConfigured()', () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  test('returns false when env vars are absent', () => {
    clearSupabaseEnv();
    // Re-import to pick up cleared env
    jest.isolateModules(() => {
      const { isSupabaseConfigured } = require('../supabase/client');
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  test('returns false when URL contains "placeholder"', () => {
    setSupabasePlaceholderEnv();
    jest.isolateModules(() => {
      const { isSupabaseConfigured } = require('../supabase/client');
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  test('returns true when real values are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://real-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real';
    jest.isolateModules(() => {
      const { isSupabaseConfigured } = require('../supabase/client');
      expect(isSupabaseConfigured()).toBe(true);
    });
  });
});

// ── 3. createClient() throws when unconfigured ────────────────────────────────

describe('createClient() — throws SupabaseConfigurationError when unconfigured', () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    clearSupabaseEnv();
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  test('throws SupabaseConfigurationError — not a silent empty result', () => {
    jest.isolateModules(() => {
      const { createClient, SupabaseConfigurationError } = require('../supabase/client');
      expect(() => createClient()).toThrow(SupabaseConfigurationError);
    });
  });

  test('error message mentions env var names', () => {
    jest.isolateModules(() => {
      const { createClient } = require('../supabase/client');
      let message = '';
      try {
        createClient();
      } catch (e: unknown) {
        message = (e as Error).message;
      }
      expect(message).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });
  });

  test('error name is SupabaseConfigurationError', () => {
    jest.isolateModules(() => {
      const { createClient } = require('../supabase/client');
      let name = '';
      try {
        createClient();
      } catch (e: unknown) {
        name = (e as Error).name;
      }
      expect(name).toBe('SupabaseConfigurationError');
    });
  });

  test('does NOT return an object with empty data (no silent no-op)', () => {
    jest.isolateModules(() => {
      const { createClient } = require('../supabase/client');
      let result: unknown = 'not-thrown';
      try {
        result = createClient();
      } catch {
        result = 'thrown';
      }
      expect(result).toBe('thrown');
    });
  });
});

// ── 4. getSupabaseServerClient() throws when unconfigured ────────────────────

describe('getSupabaseServerClient() — throws when unconfigured', () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    clearSupabaseEnv();
    jest.mock('next/headers', () => ({
      cookies: () => ({ getAll: () => [], set: () => {} }),
    }));
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  test('throws SupabaseServerConfigurationError — not null', async () => {
    await jest.isolateModulesAsync(async () => {
      const { getSupabaseServerClient, SupabaseServerConfigurationError } =
        require('../supabase/server');
      await expect(getSupabaseServerClient()).rejects.toThrow(
        SupabaseServerConfigurationError
      );
    });
  });

  test('does NOT return null (no silent null return)', async () => {
    await jest.isolateModulesAsync(async () => {
      const { getSupabaseServerClient } = require('../supabase/server');
      let result: unknown = 'not-thrown';
      try {
        result = await getSupabaseServerClient();
      } catch {
        result = 'thrown';
      }
      expect(result).toBe('thrown');
      expect(result).not.toBeNull();
    });
  });
});

// ── 5. isSupabaseServerConfigured() ──────────────────────────────────────────

describe('isSupabaseServerConfigured()', () => {
  test('returns false when env vars are absent', () => {
    const saved = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
    clearSupabaseEnv();
    jest.isolateModules(() => {
      jest.mock('next/headers', () => ({
        cookies: () => ({ getAll: () => [], set: () => {} }),
      }));
      const { isSupabaseServerConfigured } = require('../supabase/server');
      expect(isSupabaseServerConfigured()).toBe(false);
    });
    if (saved.url) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
  });
});

// ── 6. No fake empty results ──────────────────────────────────────────────────

describe('No fake empty results — silent no-op is forbidden', () => {
  test('createClient() never returns an object with a .from() method when unconfigured', () => {
    const saved = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
    clearSupabaseEnv();

    jest.isolateModules(() => {
      const { createClient } = require('../supabase/client');
      let client: unknown = null;
      try {
        client = createClient();
      } catch {
        client = null;
      }
      // Must not have returned a proxy with .from()
      expect(client).toBeNull();
    });

    if (saved.url) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
  });
});
