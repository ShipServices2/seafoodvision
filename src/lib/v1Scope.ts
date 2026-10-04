// V1 scope switch. When NEXT_PUBLIC_V1_SCOPE=true the site is centred on the photo
// library, species, collections and licence purchase. Nothing is deleted: out-of-scope
// routes and products are hidden (404 from the middleware, no links in the navigation).

/** Routes hidden when the V1 scope is active (the route itself and everything below it). */
export const V1_HIDDEN_ROUTES: readonly string[] = [
  // public pages
  '/identify',
  '/assistant',
  '/knowledge',
  '/api-access',
  '/mvp-report',
  '/marketing-kit',
  '/account/credits',
  // admin pages
  '/admin/ai-identification',
  '/admin/ai-studio',
  '/admin/assistant',
  '/admin/knowledge',
  '/admin/identification',
  '/admin/reviewer-dashboard',
  // Seafood Intelligence Hub (AI advisor, credits): added beyond the initial list
  '/hub',
  '/admin/hub',
  // API routes
  '/api/ai',
  '/api/sie',
  '/api/assistant',
  '/api/identification',
  '/api/payments/dodo/credit-checkout',
  '/api/hub',
];

/** Unit products that are not sold in V1 (pricing, cart and asset pages). */
export const V1_HIDDEN_UNIT_PRODUCTS: readonly string[] = ['photo_ultrahd', 'video', 'view_360'];

export function isV1ScopeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_V1_SCOPE === 'true';
}

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** True when the V1 scope is active and the path (or href) belongs to a hidden route. */
export function isV1HiddenPath(pathname: string): boolean {
  if (!isV1ScopeEnabled()) return false;
  const path = pathname.split('?')[0].split('#')[0];
  return V1_HIDDEN_ROUTES.some((route) => matchesRoute(path, route));
}

export function isV1HiddenUnitProduct(code: string): boolean {
  return isV1ScopeEnabled() && V1_HIDDEN_UNIT_PRODUCTS.includes(code);
}

const V1_HIDDEN_OFFER_PATTERN = /credit|video|360|ultra\s?hd|\bAI\b|\bAPI\b|marketing kit/i;

/** True when a pricing label or FAQ text refers to an offer that is not sold in V1. */
export function isV1HiddenOfferText(text: string): boolean {
  return isV1ScopeEnabled() && V1_HIDDEN_OFFER_PATTERN.test(text);
}
