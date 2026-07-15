// ============================================================
// SEAFOOD VISION — /api/ai/similar (Phase 8)
// Find similar images from the validated catalog
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/roleAuth';

export async function GET(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const assetId = searchParams.get('assetId');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20);

    if (!jobId && !assetId) {
      return NextResponse.json({ error: 'jobId or assetId required' }, { status: 400 });
    }

    const supabase = await createClient();

    if (jobId) {
      // Return stored similar images for this job
      const { data } = await supabase
        .from('ai_similar_images')
        .select(`
          *,
          similar_asset:assets(id, title, category, thumbnail_url, public_asset_id)
        `)
        .eq('job_id', jobId)
        .order('rank', { ascending: true })
        .limit(limit);

      return NextResponse.json({ similar: data ?? [] });
    }

    // Compute similarity against validated catalog (simplified — category-based matching)
    const { data: asset } = await supabase
      .from('assets')
      .select('id, title, category, species_id')
      .eq('id', assetId!)
      .single();

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Find similar assets by category and species
    const conditions: string[] = [];
    if (asset.category) conditions.push(`category.eq.${asset.category}`);
    if (asset.species_id) conditions.push(`species_id.eq.${asset.species_id}`);

    let query = supabase
      .from('assets')
      .select('id, title, category, thumbnail_url, public_asset_id, species_id')
      .eq('review_status', 'approved')
      .neq('id', assetId!)
      .limit(limit);

    if (asset.species_id) {
      query = query.eq('species_id', asset.species_id);
    } else if (asset.category) {
      query = query.eq('category', asset.category);
    }

    const { data: similar } = await query;

    const results = (similar ?? []).map((s, idx) => ({
      rank: idx + 1,
      similarAssetId: s.id,
      similarityScore: Math.max(10, 90 - idx * 8), // Simulated score
      speciesName: s.title,
      categoryName: s.category,
      asset: s,
    }));

    return NextResponse.json({ similar: results });
  } catch (err) {
    console.error('[/api/ai/similar]', err);
    return NextResponse.json({ error: 'Failed to find similar images' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, similarAssets } = body as {
      jobId: string;
      similarAssets: Array<{
        assetId: string;
        similarityScore: number;
        rank: number;
        speciesName?: string;
        familyName?: string;
        categoryName?: string;
      }>;
    };

    if (!jobId || !similarAssets?.length) {
      return NextResponse.json({ error: 'jobId and similarAssets required' }, { status: 400 });
    }

    const supabase = await createClient();

    await supabase.from('ai_similar_images').delete().eq('job_id', jobId);
    await supabase.from('ai_similar_images').insert(
      similarAssets.map((s) => ({
        job_id: jobId,
        similar_asset_id: s.assetId,
        similarity_score: s.similarityScore,
        rank: s.rank,
        species_name: s.speciesName,
        family_name: s.familyName,
        category_name: s.categoryName,
      }))
    );

    return NextResponse.json({ success: true, stored: similarAssets.length });
  } catch (err) {
    console.error('[/api/ai/similar POST]', err);
    return NextResponse.json({ error: 'Failed to store similar images' }, { status: 500 });
  }
}
