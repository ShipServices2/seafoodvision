import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessAdminRoute, type AppRole } from '@/lib/supabase/roleAuth';

/**
 * Routes that are fully public and require no Supabase check.
 * Static assets are already excluded by the matcher pattern below.
 */
const PUBLIC_PREFIXES = [
  '/auth',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/copyright',
  '/how-it-works',
  '/licensing',
  '/licensing-center',
  '/pricing',
  '/species',
  '/products',
  '/knowledge',
  '/discover',
  '/identify',
  '/assistant',
  '/library',
  '/asset',
  '/asset-detail',
  '/marketing-kit',
  '/api-access',
  '/enterprise',
  '/mvp-report',
  '/checkout',
  '/api/payments',
  '/api/webhooks',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Evaluated at request time (not module load time) so that NEXT_PUBLIC_*
 * env vars are always read from the current process environment.
 */
function getSupabaseConfig(): { url: string; anonKey: string; configured: boolean } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const configured =
    url.length > 0 &&
    anonKey.length > 0 &&
    !url.includes('placeholder') &&
    !url.includes('your-project');
  return { url, anonKey, configured };
}

function getProjectRef(url: string): string {
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest, url: string): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef(url)}-auth-token`, token);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Public routes: never need Supabase ──────────────────────────────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next({ request });
  }

  // ── Read config at request time (not frozen at build time) ───────────────
  const { url: supabaseUrl, anonKey: supabaseAnonKey, configured: isSupabaseConfigured } = getSupabaseConfig();

  // ── Protected routes without Supabase configured → explicit 500 ─────────
  if (!isSupabaseConfigured) {
    // /account and /admin require authentication — refuse clearly
    if (pathname.startsWith('/account') || pathname.startsWith('/admin')) {
      return new NextResponse(
        JSON.stringify({
          error: 'configuration_error',
          message:
            'Authentication service is not configured. ' + 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // API routes that require auth also get a 500
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/payments') && !pathname.startsWith('/api/webhooks')) {
      return new NextResponse(
        JSON.stringify({
          error: 'configuration_error',
          message: 'Authentication service is not configured.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // All other routes (homepage, etc.) pass through
    return NextResponse.next({ request });
  }

  // ── Supabase is configured — normal auth flow ────────────────────────────
  injectTokenFromHeader(request, supabaseUrl);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Protect /account routes ──────────────────────────────────────────────
  if (pathname.startsWith('/account')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Protect /admin routes — server-side role check ───────────────────────
  if (pathname.startsWith('/admin')) {
    // Not authenticated → redirect to auth
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // Authenticated — fetch role from DB (never trust frontend state)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    const role = (profileData?.role ?? null) as AppRole | null;

    // Use canAccessAdminRoute to enforce role-based access
    if (!canAccessAdminRoute(role, pathname)) {
      // Members, customers, visitors → redirect to /account
      const url = request.nextUrl.clone();
      url.pathname = '/account';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
