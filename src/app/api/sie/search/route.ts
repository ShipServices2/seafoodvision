import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? '';
    const limit = parseInt(searchParams.get('limit') ?? '10');

    if (!q) return NextResponse.json({ error: 'q (query) required' }, { status: 400 });

    // Search across species, multilingual names, biological data
    const [speciesRes, multilingualRes, biologicalRes] = await Promise.all([
      supabase.from('species').select('id, name, scientific_name, family, genus').ilike('name', `%${q}%`).limit(limit),
      supabase.from('sie_multilingual_names').select('*').or(`names_en.cs.{${q}},names_fr.cs.{${q}},commercial_name_primary.ilike.%${q}%`).limit(limit),
      supabase.from('sie_biological_data').select('*').or(`scientific_name.ilike.%${q}%,common_name.ilike.%${q}%,family.ilike.%${q}%`).limit(limit),
    ]);

    return NextResponse.json({
      query: q,
      species: speciesRes.data ?? [],
      multilingualNames: multilingualRes.data ?? [],
      biologicalData: biologicalRes.data ?? [],
      total: (speciesRes.data?.length ?? 0) + (multilingualRes.data?.length ?? 0) + (biologicalRes.data?.length ?? 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
