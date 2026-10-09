import { notFound } from 'next/navigation';
import { isPublicSpeciesSlug } from '@/lib/supabase/publicSpecies';
import SpeciesDetailClient from './SpeciesDetailClient';

export const dynamic = 'force-dynamic';

// Hidden or unknown species must answer with a real HTTP 404 (noindex is added by Next).
export default async function SpeciesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await isPublicSpeciesSlug(slug))) notFound();
  return <SpeciesDetailClient />;
}
