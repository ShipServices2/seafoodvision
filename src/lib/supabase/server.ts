import { createServerClient } from '@supabase/ssr';
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

/**
 * Returns true only when both public env vars are present and non-placeholder.
 * Safe to call at module level — never throws.
 */
export function isSupabaseServerConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.length > 0 && key.length > 0 && !url.includes('placeholder');
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
