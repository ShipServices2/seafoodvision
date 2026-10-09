import { createClient } from '@supabase/supabase-js';

// Anonymous, cookie-free client for server-side public reads (RLS applies).
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function isPublicSpeciesSlug(slug: string): Promise<boolean> {
  const supabase = anonClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('species')
    .select('slug')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  if (error) { console.error('isPublicSpeciesSlug error:', error.message); return false; }
  return !!data;
}

export async function listPublicSpeciesSlugs(): Promise<{ slug: string; updated_at: string | null }[]> {
  const supabase = anonClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('species')
    .select('slug, updated_at')
    .eq('is_public', true)
    .order('slug');
  if (error) { console.error('listPublicSpeciesSlugs error:', error.message); return []; }
  return data ?? [];
}
