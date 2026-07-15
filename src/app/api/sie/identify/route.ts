import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIProviderRegistry, AIIdentificationRequest } from '@/lib/ai/providers';

// ─── Mock species pool for deterministic proposals ────────────────────────────
const MOCK_SPECIES_POOL = [
  { commonName: 'Atlantic Salmon', scientificName: 'Salmo salar', family: 'Salmonidae', genus: 'Salmo' },
  { commonName: 'Rainbow Trout', scientificName: 'Oncorhynchus mykiss', family: 'Salmonidae', genus: 'Oncorhynchus' },
  { commonName: 'Atlantic Cod', scientificName: 'Gadus morhua', family: 'Gadidae', genus: 'Gadus' },
  { commonName: 'European Sea Bass', scientificName: 'Dicentrarchus labrax', family: 'Moronidae', genus: 'Dicentrarchus' },
  { commonName: 'Gilthead Sea Bream', scientificName: 'Sparus aurata', family: 'Sparidae', genus: 'Sparus' },
  { commonName: 'Yellowfin Tuna', scientificName: 'Thunnus albacares', family: 'Scombridae', genus: 'Thunnus' },
  { commonName: 'Bluefin Tuna', scientificName: 'Thunnus thynnus', family: 'Scombridae', genus: 'Thunnus' },
  { commonName: 'Swordfish', scientificName: 'Xiphias gladius', family: 'Xiphiidae', genus: 'Xiphias' },
  { commonName: 'Mahi-Mahi', scientificName: 'Coryphaena hippurus', family: 'Coryphaenidae', genus: 'Coryphaena' },
  { commonName: 'Halibut', scientificName: 'Hippoglossus hippoglossus', family: 'Pleuronectidae', genus: 'Hippoglossus' },
  { commonName: 'Sole', scientificName: 'Solea solea', family: 'Soleidae', genus: 'Solea' },
  { commonName: 'Turbot', scientificName: 'Scophthalmus maximus', family: 'Scophthalmidae', genus: 'Scophthalmus' },
  { commonName: 'Red Mullet', scientificName: 'Mullus surmuletus', family: 'Mullidae', genus: 'Mullus' },
  { commonName: 'Monkfish', scientificName: 'Lophius piscatorius', family: 'Lophiidae', genus: 'Lophius' },
  { commonName: 'Hake', scientificName: 'Merluccius merluccius', family: 'Merlucciidae', genus: 'Merluccius' },
  { commonName: 'Mackerel', scientificName: 'Scomber scombrus', family: 'Scombridae', genus: 'Scomber' },
  { commonName: 'Herring', scientificName: 'Clupea harengus', family: 'Clupeidae', genus: 'Clupea' },
  { commonName: 'Sardine', scientificName: 'Sardina pilchardus', family: 'Clupeidae', genus: 'Sardina' },
  { commonName: 'Whiting', scientificName: 'Merlangius merlangus', family: 'Gadidae', genus: 'Merlangius' },
  { commonName: 'Seabream', scientificName: 'Pagellus erythrinus', family: 'Sparidae', genus: 'Pagellus' },
];

const PRODUCT_FORMS = ['Whole', 'HGT', 'Fillet', 'Steak', 'Loin', 'IQF', 'Block', 'Vacuum', 'Portion'];

function generateMockCandidates(jobId: string, currentName: string | null, category: string | null) {
  const seed = (currentName ?? jobId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseIdx = seed % MOCK_SPECIES_POOL.length;
  const confidences = [72, 58, 41, 28, 18];
  const similarities = [68, 55, 38, 25, 15];

  return Array.from({ length: 5 }, (_, i) => {
    const species = MOCK_SPECIES_POOL[(baseIdx + i) % MOCK_SPECIES_POOL.length];
    const productForm = PRODUCT_FORMS[(seed + i) % PRODUCT_FORMS.length];
    return {
      job_id: jobId,
      rank: i + 1,
      common_name: species.commonName,
      scientific_name: species.scientificName,
      family: species.family,
      genus: species.genus,
      ai_score: confidences[i],
      similarity_score: similarities[i],
      product_form: productForm,
      source_provider: 'mock',
      main_reasons: [
        i === 0
          ? `Coloration et forme correspondent à ${species.family}`
          : `Famille similaire au candidat #${i}`,
        category ? `Catégorie "${category}" compatible` : 'Analyse visuelle générale',
        i < 2 ? 'Silhouette et texture analysées' : 'Ambiguïté — validation humaine requise',
      ],
      commercial_name: species.commonName,
      description_candidate: `${species.commonName} (${species.scientificName}) — proposition IA générée par le Mock Engine. Validation humaine requise avant publication.`,
      category_candidate: category ?? 'Fish',
      packaging_candidate: productForm,
      product_candidate: productForm,
      keywords_candidate: [species.commonName, species.scientificName, species.family, productForm, 'seafood'],
    };
  });
}

// ─── POST /api/sie/identify ───────────────────────────────────────────────────
// Runs the Mock Engine for a single job, stores Top 5 candidates,
// and pushes the top proposal to metadata_suggestions as pending review.
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

    // Run AI identification via provider registry (falls back to Mock)
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
    await new Promise((r) => setTimeout(r, 150));
    await supabase.from('sie_jobs').update({ progress_step: 'building_metadata', progress_pct: 75 }).eq('id', jobId);

    // Generate deterministic Mock Engine candidates
    const mockCandidates = generateMockCandidates(
      jobId,
      contextHints?.currentName ?? null,
      contextHints?.currentCategory ?? null,
    );

    // Merge provider result with mock candidates (provider result takes priority if real AI)
    const candidateRows = result.provider === 'mock'
      ? mockCandidates
      : result.candidates.map((c) => ({
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
          category_candidate: contextHints?.currentCategory ?? 'Fish',
          packaging_candidate: c.productForm ?? 'Whole',
          product_candidate: c.productForm ?? 'Whole',
          keywords_candidate: [c.commonName, c.scientificName, c.family, 'seafood'],
        }));

    // Delete existing candidates for this job (idempotent)
    await supabase.from('sie_species_candidates').delete().eq('job_id', jobId);
    await supabase.from('sie_species_candidates').insert(candidateRows);

    // Push top candidate to metadata_suggestions as 'under_review' (never auto-publish)
    // source must be 'ai_generated' per metadata_source_type ENUM
    // confidence_score is NUMERIC(5,4) — store as 0-1 fraction
    if (assetId && candidateRows.length > 0) {
      const top = candidateRows[0];
      const confidenceFraction = Math.min(1, (top.ai_score ?? 0) / 100);
      await supabase.from('metadata_suggestions').upsert({
        asset_id: assetId,
        field_name: 'species_candidate',
        suggested_value: top.scientific_name,
        source: 'ai_generated',
        confidence_score: confidenceFraction,
        status: 'under_review',
        review_note: `AI Job: ${jobId} | Top candidate: ${top.common_name} (${top.scientific_name}) | Confidence: ${top.ai_score}% | Mock Engine v1 | Validation humaine requise — jamais publié automatiquement`,
      }, { onConflict: 'asset_id,field_name' });
    }

    // Calculate confidence scores
    const topScore = candidateRows[0]?.ai_score ?? 0;
    const globalConfidence = Math.round(topScore * 0.7 + (candidateRows[1]?.ai_score ?? 0) * 0.3);

    // Update job to proposals_ready
    await supabase.from('sie_jobs').update({
      job_status: 'proposals_ready',
      progress_step: 'proposals_ready',
      progress_pct: 100,
      ai_provider: result.provider,
      ai_model: result.model,
      processing_time_ms: result.processingTimeMs,
      ambiguity_detected: true,
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
      candidatesCount: candidateRows.length,
      provider: result.provider,
      model: result.model,
      ambiguityDetected: true,
      globalConfidence,
      topCandidate: {
        commonName: candidateRows[0]?.common_name,
        scientificName: candidateRows[0]?.scientific_name,
        confidence: candidateRows[0]?.ai_score,
      },
      message: 'Top 5 candidates ready for human review. Pushed to Metadata Review Center as under_review. No automatic publishing.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
