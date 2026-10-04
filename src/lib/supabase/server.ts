import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Thrown when a server-side Supabase call is attempted but env vars are absent.
 * Importing this module never throws — only calling getSupabaseServerClient() does.
 */
export class SupabaseServerConfigurationError extends Error {
  constructor() {
    super(
      'Supabase server client cannot be created: ' + 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. '+ 'Configure these variables in your .env file.'
    );
    this.name = 'SupabaseServerConfigurationError';
  }
}

function runtimeEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Returns true only when both public env vars are present and non-placeholder.
 * Safe to call at module level — never throws.
 */
export function isSupabaseServerConfigured(): boolean {
  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = runtimeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return !!url && !!key && !url.includes('placeholder');
}

/**
 * Creates and returns a Supabase server client for use in Server Components,
 * Server Actions, and API routes.
 *
 * Throws SupabaseServerConfigurationError if env vars are missing.
 * Never returns null — callers can rely on the returned client being real.
 *
 * For pages that are designed to render without data (public static pages),
 * check isSupabaseServerConfigured() before calling this function.
 */
export async function getSupabaseServerClient() {
  if (!isSupabaseServerConfigured()) {
    throw new SupabaseServerConfigurationError();
  }

  const supabaseUrl = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL')!;
  const supabaseAnonKey = runtimeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet?.forEach(({ name, value, options }) =>
            cookieStore?.set(name, value, {
              ...options,
              sameSite: 'none',
              secure: true,
            })
          );
        } catch {
          // Server Component read-only context — expected
        }
      },
    },
  });
}

/**
 * Legacy alias — kept for backward compatibility with existing callers.
 * Prefer getSupabaseServerClient() for new code.
 *
 * Throws SupabaseServerConfigurationError if env vars are missing.
 */
export async function createClient() {
  return getSupabaseServerClient();
}

/**
 * Server-only client for trusted commerce and webhook mutations that must bypass
 * user-facing RLS. Callers must authenticate the user or verify the provider
 * webhook before using it.
 */
export function createServiceClient() {
  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');

  const KNOWN_PLACEHOLDERS = [
    'your-service-role-key-here',
    'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE',
    'placeholder',
    '',
  ];

  if (!url || !serviceRoleKey || KNOWN_PLACEHOLDERS.includes(serviceRoleKey.trim())) {
    throw new Error('Supabase service role is not configured for server-side commerce operations');
  }

  // Supabase service role keys are JWTs — they must start with "eyJ".
  // A common misconfiguration is using the anon key or a truncated value.
  if (!serviceRoleKey.trim().startsWith('eyJ')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY appears to be invalid (must be a JWT starting with "eyJ"). ' +
      'Copy the service_role key from Supabase → Settings → API and update your .env file.'
    );
  }

  return createSupabaseClient(url, serviceRoleKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
