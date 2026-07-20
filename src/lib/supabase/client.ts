import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';

/**
 * Thrown when createClient() is called but Supabase env vars are not configured.
 * This is an explicit, loud failure — never a silent empty result.
 */
export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'Supabase is not configured. ' + 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
    this.name = 'SupabaseConfigurationError';
  }
}

/**
 * Returns true only when both public env vars are present and non-placeholder.
 * Safe to call at module level — reads process.env, never throws.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.length > 0 && key.length > 0 && !url.includes('placeholder');
}

// ── Cookie / storage helpers ─────────────────────────────────────────────────

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    document.cookie = `${k}=1; Path=/; SameSite=None; Secure; Partitioned`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=None; Secure`;
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined'
    ? []
    : document.cookie
        .split(';')
        .filter(Boolean)
        .map((c) => {
          const trimmed = c.trim();
          const idx = trimmed.indexOf('=');
          const name = idx !== -1 ? trimmed.slice(0, idx) : trimmed;
          const value = idx !== -1 ? decodeURIComponent(trimmed.slice(idx + 1)) : '';
          return { name: name.trim(), value };
        })
        .filter((c) => c.name);

const fromStorage = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch {
    return [];
  }
};

const setCookie = (name: string, value: string, options?: Record<string, unknown>) => {
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; SameSite=None; Secure; Partitioned`;
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires as string).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=None; Secure',
    'Path=/; SameSite=None; Secure; Partitioned',
  ];
  variants.forEach((attrs) => {
    document.cookie = `${name}=; Max-Age=0; ${attrs}`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; Domain=${domain}; ${attrs}`;
    });
  });
};

const getToken = () =>
  (canUseCookies() ? fromCookies() : fromStorage()).find((c) =>
    c.name.includes('auth-token')
  )?.value ?? null;

if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).__sb_patched__) {
  (window as unknown as Record<string, unknown>).__sb_patched__ = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const token = getToken();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;
    if (token && (url.startsWith('/') || url.startsWith(window.location.origin))) {
      init = { ...(init || {}), headers: { ...(init?.headers || {}), 'x-sb-token': token } };
    }
    return orig(input, init);
  };
}

// ── Lazy singleton ────────────────────────────────────────────────────────────

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns the Supabase browser client (lazy singleton).
 *
 * Throws SupabaseConfigurationError if env vars are missing or placeholder.
 * Never returns a no-op proxy — callers must handle the unconfigured case
 * explicitly (e.g. show a "not available" UI, skip the call, etc.).
 */
export function createClient(): ReturnType<typeof createBrowserClient> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigurationError();
  }

  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => (canUseCookies() ? fromCookies() : fromStorage()),
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return;
        if (canUseCookies()) {
          cookiesToSet.forEach(({ name, value, options }) =>
            value
              ? setCookie(name, value, options as Record<string, unknown>)
              : deleteCookie(name)
          );
        } else {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              value
                ? localStorage.setItem(`${PFX}${name}`, value)
                : localStorage.removeItem(`${PFX}${name}`);
            } catch {}
            if (value) setCookie(name, value, options as Record<string, unknown>);
          });
        }
      },
    },
  });

  return _client;
}
