/**
 * Server-side role authorization utility for Seafood Vision.
 * All role checks are performed against the database — never hardcoded in frontend.
 * Used by middleware, API routes, and server components.
 */

import { createClient } from '@/lib/supabase/server';

export type AppRole = 'visitor' | 'member' | 'customer' | 'reviewer' | 'administrator' | 'super_admin';

export const ADMIN_ROLES: AppRole[] = ['administrator', 'super_admin'];
export const REVIEWER_ROLES: AppRole[] = ['reviewer', 'administrator', 'super_admin'];

/**
 * Admin-only routes — only super_admin and administrator may access.
 */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/admin/imports',
  '/admin/dashboard',
  '/admin/catalog',
  '/admin/species',
  '/admin/batches',
  '/admin/users',
  '/admin/settings',
  '/admin/assets',
  '/admin/categories',
  '/admin/knowledge',
  '/admin/identification',
  '/admin/reviews',
  '/admin/reviewer-dashboard',
  '/admin/assistant',
];

/**
 * Routes accessible to reviewers and above (reviewer, administrator, super_admin).
 * Reviewers may only validate assets and species.
 */
export const REVIEWER_ROUTES = [
  '/admin/reviews',
  '/admin/reviewer-dashboard',
  '/admin/species',
  '/admin/assets',
];

/**
 * Fetch the role of the currently authenticated user from the database.
 * Returns null if not authenticated or profile not found.
 */
export async function getCurrentUserRole(): Promise<AppRole | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return data.role as AppRole;
  } catch {
    return null;
  }
}

/**
 * Check if the current user has admin access (administrator or super_admin).
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role !== null && ADMIN_ROLES.includes(role);
}

/**
 * Check if the current user is a super_admin.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === 'super_admin';
}

/**
 * Check if the current user is reviewer or above.
 */
export async function isReviewerOrAbove(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role !== null && REVIEWER_ROLES.includes(role);
}

/**
 * Determine if a given role is allowed to access an admin route.
 * Reviewers are only allowed on REVIEWER_ROUTES, not full admin.
 */
export function canAccessAdminRoute(role: AppRole | null, pathname: string): boolean {
  if (!role) return false;

  // super_admin and administrator: full admin access
  if (ADMIN_ROLES.includes(role)) return true;

  // reviewer: only specific review/validation routes
  if (role === 'reviewer') {
    return REVIEWER_ROUTES.some((r) => pathname.startsWith(r));
  }

  // member, customer, visitor: no admin access
  return false;
}

/**
 * Fetch role for a specific user ID (used in API routes with service context).
 */
export async function getUserRoleById(userId: string): Promise<AppRole | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return data.role as AppRole;
  } catch {
    return null;
  }
}
