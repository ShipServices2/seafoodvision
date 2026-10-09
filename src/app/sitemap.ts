import type { MetadataRoute } from 'next';
import { listPublicSpeciesSlugs } from '@/lib/supabase/publicSpecies';

export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seafoodvis1067.builtwithrocket.new').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const species = await listPublicSpeciesSlugs();
  return [
    { url: `${SITE_URL}/species` },
    ...species.map((s) => ({
      url: `${SITE_URL}/species/${s.slug}`,
      ...(s.updated_at ? { lastModified: new Date(s.updated_at) } : {}),
    })),
  ];
}
