import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIProviderRegistry, AIIdentificationRequest } from '@/lib/ai/providers';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { jobId, assetId, imageUrl, imageBase64, contextHints } = body;

    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    // Update job status to processing
    await supabase.from('sie_jobs').update({
      job_status: 'analyzing',
      progress_step: 'analyzing',
      progress_pct: 10,
    }).eq('id', jobId);

    // Run AI identification
    const registry = new AIProviderRegistry();
    const provider = registry.getDefaultProvider();

    const request: AIIdentificationRequest = {
      jobId,
      assetId,
      imageUrl,
      imageBase64,
      contextHints: contextHints ?? {},
    };

    await supabase.from('sie_jobs').update({ progress_step: 'vision_processing', progress_pct: 30 }).eq('id', jobId);
    const result = await provider.identify(request);

    await supabase.from('sie_jobs').update({ progress_step: 'taxonomy_search', progress_pct: 55 }).eq('id', jobId);
    await new Promise((r) => setTimeout(r, 200));

    await supabase.from('sie_jobs').update({ progress_step: 'building_metadata', progress_pct: 75 }).eq('id', jobId);

    // Store Top 5 candidates
    const candidateRows = result.candidates.map((c) => ({
      job_id: jobId,
      rank: c.rank,
      common_name: c.commonName,
      scientific_name: c.scientificName,
      family: c.family,
      genus: c.genus,
      ai_score: c.confidence,
      similarity_score: c.similarity,
      main_reasons: c.mainReasons,
      product_form: c.productForm ?? null,
      source_provider: c.sourceProvider,
    }));

    await supabase.from('sie_species_candidates').insert(candidateRows);

    // Calculate confidence scores
    const topScore = result.candidates[0]?.confidence ?? 0;
    const globalConfidence = Math.round(topScore * 0.7 + (result.candidates[1]?.confidence ?? 0) * 0.3);

    // Update job to proposals_ready
    await supabase.from('sie_jobs').update({
      job_status: 'proposals_ready',
      progress_step: 'proposals_ready',
      progress_pct: 100,
      ai_provider: result.provider,
      ai_model: result.model,
      processing_time_ms: result.processingTimeMs,
      ambiguity_detected: result.ambiguityDetected,
      vision_confidence: Math.round(topScore * 0.9),
      species_confidence: topScore,
      commercial_confidence: Math.round(topScore * 0.6),
      metadata_confidence: Math.round(topScore * 0.5),
      documentation_confidence: Math.round(topScore * 0.4),
      global_confidence: globalConfidence,
    }).eq('id', jobId);

    return NextResponse.json({
      success: true,
      jobId,
      candidatesCount: result.candidates.length,
      provider: result.provider,
      model: result.model,
      ambiguityDetected: result.ambiguityDetected,
      globalConfidence,
      message: 'Top 5 candidates ready for human review. No automatic publishing.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const { data: job } = await supabase.from('sie_jobs').select('*').eq('id', jobId).single();
    const { data: candidates } = await supabase.from('sie_species_candidates').select('*').eq('job_id', jobId).order('rank');

    return NextResponse.json({ job, candidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
