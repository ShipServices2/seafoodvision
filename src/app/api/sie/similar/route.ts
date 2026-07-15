import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const limit = parseInt(searchParams.get('limit') ?? '10');

    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    // Get the job's candidates to find species names for similarity
    const { data: candidates } = await supabase
      .from('sie_species_candidates')
      .select('scientific_name, family, common_name')
      .eq('job_id', jobId)
      .order('rank')
      .limit(1);

    const topCandidate = candidates?.[0];

    // Find similar assets from catalog
    let query = supabase
      .from('assets')
      .select('id, public_asset_id, title, file_name, category, thumbnail_url, species_id')
      .limit(limit);

    if (topCandidate?.common_name) {
      query = query.ilike('title', `%${topCandidate.common_name.split(' ')[0]}%`);
    }

    const { data: similarAssets } = await query;

    // Store similarity results
    if (similarAssets && similarAssets.length > 0) {
      const simRows = similarAssets.map((asset, i) => ({
        job_id: jobId,
        similar_asset_id: asset.id,
        similar_public_asset_id: asset.public_asset_id,
        similarity_score: Math.max(10, 85 - i * 8),
        species: topCandidate?.common_name ?? null,
        family: topCandidate?.family ?? null,
        category: asset.category,
        image_url: asset.thumbnail_url,
        rank: i + 1,
      }));
      await supabase.from('sie_similarity_results').upsert(simRows, { onConflict: 'id' });
    }

    return NextResponse.json({
      jobId,
      topCandidate,
      similarAssets: similarAssets ?? [],
      count: similarAssets?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
