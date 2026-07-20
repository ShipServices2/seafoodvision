import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIProviderRegistry, AIIdentificationRequest } from '@/lib/ai/providers';
import { generateEnrichedMockCandidates, MockAssetContext } from '@/lib/ai/mockEngine';

// ─── POST /api/sie/identify ───────────────────────────────────────────────────
// Runs the Mock Engine v2 for a single job, stores Top 5 candidates,
// and pushes the top proposal to metadata_suggestions as pending review.
// Uses full asset metadata (species, keywords, product_form, etc.) for
// contextually relevant proposals — no external AI provider required.
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

    // ── Fetch full asset metadata for enriched Mock Engine ──────────────────
    let assetContext: MockAssetContext = {
      assetId: assetId ?? jobId,
      title: contextHints?.currentName ?? null,
      fileName: null,
      category: contextHints?.currentCategory ?? null,
      productForm: null,
      packaging: null,
      description: null,
      existingSpeciesCommonName: null,
      existingSpeciesScientificName: null,
      existingSpeciesFamily: null,
      existingSpeciesGenus: null,
      keywords: contextHints?.tags ?? [],
      importBatch: contextHints?.importBatch ?? null,
      folderPath: contextHints?.folderPath ?? null,
    };

    if (assetId) {
      // Fetch asset with species join and keywords
      const { data: asset } = await supabase
        .from('assets')
        .select(`
          id, title, file_name, category, product_form, packaging, description,
          species:species_id (
            common_name, scientific_name, family
          ),
          asset_keywords (
            keywords ( term )
          )
        `)
        .eq('id', assetId)
        .single();

      if (asset) {
        const speciesData = asset.species as unknown as { common_name: string; scientific_name: string; family: string } | null;
        const keywordTerms = (asset.asset_keywords as unknown as { keywords: { term: string } | null }[] ?? [])
          .map((ak) => ak.keywords?.term)
          .filter((t): t is string => !!t);

        // Derive genus from scientific name (first word = genus)
        const genus = speciesData?.scientific_name?.split(' ')[0] ?? null;

        assetContext = {
          assetId: asset.id,
          title: asset.title ?? contextHints?.currentName ?? null,
          fileName: asset.file_name ?? null,
          category: asset.category ?? contextHints?.currentCategory ?? null,
          productForm: asset.product_form ?? null,
          packaging: asset.packaging ?? null,
          description: asset.description ?? null,
          existingSpeciesCommonName: speciesData?.common_name ?? null,
          existingSpeciesScientificName: speciesData?.scientific_name ?? null,
          existingSpeciesFamily: speciesData?.family ?? null,
          existingSpeciesGenus: genus,
          keywords: [...keywordTerms, ...(contextHints?.tags ?? [])],
          importBatch: contextHints?.importBatch ?? null,
          folderPath: contextHints?.folderPath ?? null,
        };
      }
    }

    await supabase.from('sie_jobs').update({ progress_step: 'vision_processing', progress_pct: 30 }).eq('id', jobId);

    // ── Check if a real AI provider is available ────────────────────────────
    const registry = new AIProviderRegistry();
    const provider = registry.getDefaultProvider();
    let usedProvider = 'mock';
    let usedModel = 'seafood-vision-mock-v2';

    if (provider.name !== 'mock') {
      // Real AI provider available — use it
      const request: AIIdentificationRequest = {
        jobId,
        assetId,
        imageUrl,
        imageBase64,
        contextHints: contextHints ?? {},
      };
      try {
        const result = await provider.identify(request);
        usedProvider = result.provider;
        usedModel = result.model;
        // Store real AI candidates
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
          commercial_name: c.commonName,
          description_candidate: `${c.commonName} (${c.scientificName}) — AI proposal. Human validation required.`,
          category_candidate: assetContext.category ?? 'Fish',
          packaging_candidate: c.productForm ?? 'Whole',
          product_candidate: c.productForm ?? 'Whole',
          keywords_candidate: [c.commonName, c.scientificName, c.family, 'seafood'],
        }));

        await supabase.from('sie_jobs').update({ progress_step: 'taxonomy_search', progress_pct: 55 }).eq('id', jobId);
        await supabase.from('sie_jobs').update({ progress_step: 'building_metadata', progress_pct: 75 }).eq('id', jobId);
        await supabase.from('sie_species_candidates').delete().eq('job_id', jobId);
        await supabase.from('sie_species_candidates').insert(candidateRows);

        return await finalizeJob(supabase, jobId, assetId, candidateRows, usedProvider, usedModel, result.processingTimeMs);
      } catch {
        // Fall through to Mock Engine
      }
    }

    await supabase.from('sie_jobs').update({ progress_step: 'taxonomy_search', progress_pct: 55 }).eq('id', jobId);
    await new Promise((r) => setTimeout(r, 120));
    await supabase.from('sie_jobs').update({ progress_step: 'building_metadata', progress_pct: 75 }).eq('id', jobId);

    // ── Mock Engine v2 — generate enriched proposals from asset metadata ────
    const processingStart = Date.now();
    const mockCandidates = generateEnrichedMockCandidates(jobId, assetContext);

    const candidateRows = mockCandidates.map((c) => ({
      job_id: jobId,
      rank: c.rank,
      common_name: c.common_name,
      scientific_name: c.scientific_name,
      family: c.family,
      genus: c.genus,
      ai_score: c.ai_score,
      similarity_score: c.similarity_score,
      main_reasons: c.main_reasons,
      product_form: c.product_form,
      source_provider: c.source_provider,
      commercial_name: c.commercial_name,
      description_candidate: c.description_candidate,
      category_candidate: c.category_candidate,
      packaging_candidate: c.packaging_candidate,
      product_candidate: c.product_candidate,
      keywords_candidate: c.keywords_candidate,
    }));

    // Delete existing candidates for this job (idempotent)
    await supabase.from('sie_species_candidates').delete().eq('job_id', jobId);
    await supabase.from('sie_species_candidates').insert(candidateRows);

    const processingTimeMs = Date.now() - processingStart;
    return await finalizeJob(supabase, jobId, assetId, candidateRows, usedProvider, usedModel, processingTimeMs, mockCandidates[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Finalize job: push to metadata_suggestions + update job status ──────────
async function finalizeJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  assetId: string | undefined,
  candidateRows: Record<string, unknown>[],
  provider: string,
  model: string,
  processingTimeMs: number,
  topMockCandidate?: { vision_confidence?: number; species_confidence?: number; commercial_confidence?: number; metadata_confidence?: number } | null,
) {
  // Push top candidate to metadata_suggestions as 'under_review' (never auto-publish)
  if (assetId && candidateRows.length > 0) {
    const top = candidateRows[0];
    const confidenceFraction = Math.min(1, ((top.ai_score as number) ?? 0) / 100);
    await supabase.from('metadata_suggestions').upsert({
      asset_id: assetId,
      field_name: 'species_candidate',
      suggested_value: top.scientific_name,
      source: 'ai_generated',
      confidence_score: confidenceFraction,
      status: 'under_review',
      review_note: `AI Job: ${jobId} | Top candidate: ${top.common_name} (${top.scientific_name}) | Confidence: ${top.ai_score}% | ${provider === 'mock' ? 'Mock Engine v2' : provider} | Validation humaine requise — jamais publié automatiquement`,
    }, { onConflict: 'asset_id,field_name' });
  }

  const topScore = (candidateRows[0]?.ai_score as number) ?? 0;
  const globalConfidence = Math.round(topScore * 0.7 + ((candidateRows[1]?.ai_score as number) ?? 0) * 0.3);

  // Confidence breakdown (use mock engine values if available)
  const visionConf = topMockCandidate?.vision_confidence ?? Math.round(topScore * 0.9);
  const speciesConf = topMockCandidate?.species_confidence ?? topScore;
  const commercialConf = topMockCandidate?.commercial_confidence ?? Math.round(topScore * 0.65);
  const metadataConf = topMockCandidate?.metadata_confidence ?? Math.round(topScore * 0.55);

  await supabase.from('sie_jobs').update({
    job_status: 'proposals_ready',
    progress_step: 'proposals_ready',
    progress_pct: 100,
    ai_provider: provider,
    ai_model: model,
    processing_time_ms: processingTimeMs,
    ambiguity_detected: true,
    vision_confidence: visionConf,
    species_confidence: speciesConf,
    commercial_confidence: commercialConf,
    metadata_confidence: metadataConf,
    documentation_confidence: Math.round(topScore * 0.4),
    global_confidence: globalConfidence,
  }).eq('id', jobId);

  return NextResponse.json({
    success: true,
    jobId,
    candidatesCount: candidateRows.length,
    provider,
    model,
    ambiguityDetected: true,
    globalConfidence,
    topCandidate: {
      commonName: candidateRows[0]?.common_name,
      scientificName: candidateRows[0]?.scientific_name,
      confidence: candidateRows[0]?.ai_score,
    },
    message: 'Top 5 candidates ready for human review. Pushed to Metadata Review Center as under_review. No automatic publishing.',
  });
}

// ─── GET /api/sie/identify?jobId=xxx ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const { data: job } = await supabase.from('sie_jobs').select('*').eq('id', jobId).single();
    const { data: candidates } = await supabase
      .from('sie_species_candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('rank');

    return NextResponse.json({ job, candidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
