// ============================================================
// SEAFOOD VISION — /api/ai/identify (Phase 8)
// Runs AI identification engine on a queued asset
// NEVER auto-publishes — always returns Top 5 for human review
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/roleAuth';
import { aiProviderRegistry } from '@/lib/ai/providers';
import type { AIIdentificationRequest } from '@/lib/ai/providers';

export async function POST(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, assetId, providerType } = body as {
      jobId?: string;
      assetId?: string;
      providerType?: string;
    };

    if (!jobId && !assetId) {
      return NextResponse.json({ error: 'jobId or assetId required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Resolve job
    let job: Record<string, unknown> | null = null;
    if (jobId) {
      const { data } = await supabase
        .from('ai_identification_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      job = data;
    } else if (assetId) {
      // Create or find existing job for this asset
      const { data: existing } = await supabase
        .from('ai_identification_jobs')
        .select('*')
        .eq('asset_id', assetId)
        .eq('status', 'pending')
        .single();

      if (existing) {
        job = existing;
      } else {
        // Fetch asset context
        const { data: asset } = await supabase
          .from('assets')
          .select('id, public_asset_id, title, category, original_filename, import_batch_id')
          .eq('id', assetId)
          .single();

        if (!asset) {
          return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        const { data: newJob } = await supabase
          .from('ai_identification_jobs')
          .insert({
            asset_id: assetId,
            public_asset_id: asset.public_asset_id,
            current_name: asset.title,
            current_category: asset.category,
            original_filename: asset.original_filename,
            status: 'pending',
          })
          .select()
          .single();
        job = newJob;
      }
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Mark as processing
    await supabase
      .from('ai_identification_jobs')
      .update({ status: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', job.id);

    // Select provider
    const provider = providerType
      ? aiProviderRegistry.getProvider(providerType as never) ?? aiProviderRegistry.getDefaultProvider()
      : aiProviderRegistry.getDefaultProvider();

    const identRequest: AIIdentificationRequest = {
      jobId: job.id as string,
      assetId: job.asset_id as string | undefined,
      contextHints: {
        currentName: job.current_name as string | undefined,
        currentCategory: job.current_category as string | undefined,
        originalFilename: job.original_filename as string | undefined,
        importBatch: job.import_batch as string | undefined,
        folderPath: job.folder_path as string | undefined,
      },
    };

    const result = await provider.identify(identRequest);

    // Store Top 5 candidates — never a single automatic result
    const candidateInserts = result.candidates.map((c) => ({
      job_id: job!.id,
      rank: c.rank,
      common_name: c.commonName,
      scientific_name: c.scientificName,
      family: c.family,
      genus: c.genus,
      confidence: c.confidence,
      similarity: c.similarity,
      main_reasons: c.mainReasons,
      source_provider: c.sourceProvider,
      visual_features: result.visualFeatures,
      product_form: c.productForm,
    }));

    // Delete old candidates for this job before inserting new ones
    await supabase.from('ai_species_candidates').delete().eq('job_id', job.id);
    await supabase.from('ai_species_candidates').insert(candidateInserts);

    // Update job status to candidates_ready
    await supabase
      .from('ai_identification_jobs')
      .update({
        status: 'candidates_ready',
        processing_completed_at: new Date().toISOString(),
        ai_provider: provider.name,
        ai_model: provider.model,
        identification_confidence: result.candidates[0]?.confidence ?? 0,
        global_confidence: Math.round(
          result.candidates.reduce((sum, c) => sum + c.confidence, 0) / result.candidates.length
        ),
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      candidatesCount: result.candidates.length,
      topCandidate: result.candidates[0]?.commonName,
      ambiguityDetected: result.ambiguityDetected,
      provider: result.provider,
      model: result.model,
      processingTimeMs: result.processingTimeMs,
      note: 'Top 5 candidates ready for human review. No automatic identification.',
    });
  } catch (err) {
    console.error('[/api/ai/identify]', err);
    return NextResponse.json({ error: 'Identification failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const supabase = await createClient();
    const { data: candidates } = await supabase
      .from('ai_species_candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('rank', { ascending: true });

    return NextResponse.json({ candidates: candidates ?? [] });
  } catch (err) {
    console.error('[/api/ai/identify GET]', err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
