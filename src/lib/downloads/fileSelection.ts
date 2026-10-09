// Which stored file a download entitlement may receive.
// Photo Web (allowed_resolution = 'web') is delivered the 1920 px 'web' file and NEVER the original;
// HD purchases (hd / ultrahd / extended licence) are delivered the original.
// Anything unknown or missing falls back to the least privileged file (web).

export type DeliveredFileLevel = 'web' | 'original';

const ORIGINAL_RESOLUTIONS = new Set(['hd', 'ultrahd', 'full', 'original']);

export function deliveredFileLevel(resolution: string | null | undefined): DeliveredFileLevel {
  return ORIGINAL_RESOLUTIONS.has((resolution ?? '').trim().toLowerCase()) ? 'original' : 'web';
}

export const DEFAULT_DOWNLOAD_SIGNED_URL_SECONDS = 300;
const MAX_DOWNLOAD_SIGNED_URL_SECONDS = 3600;

/** DOWNLOAD_SIGNED_URL_DURATION in seconds; invalid or non-positive values fall back to 300 s, never above one hour. */
export function downloadSignedUrlDuration(raw: string | undefined = process.env.DOWNLOAD_SIGNED_URL_DURATION): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DOWNLOAD_SIGNED_URL_SECONDS;
  return Math.min(value, MAX_DOWNLOAD_SIGNED_URL_SECONDS);
}
