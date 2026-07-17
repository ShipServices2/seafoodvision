// ============================================================
// SEAFOOD VISION — Backfill Propagation API
// POST /api/admin/backfill-propagation
//
// Selects all Batch 02 assets that are:
//   - human_validated = true
//   - not skipped
//   - propagation_status absent, pending, partial, or failed
//   - have a selected candidate
//
// For each, calls propagateHumanValidatedIdentification()
// — the same function used by CONFIRM IDENTIFICATION.
//
// Returns per-asset results: propagated | already_propagated | failed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { propagateHumanValidatedIdentification } from '@/lib/propagation/propagateIdentification';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, display_name, email')
    .eq('id', user.id)
    .single();

  if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { batchJobId, dryRun = false } = body as { batchJobId?: string; dryRun?: boolean };

  // ── Find the target batch job(s) ──────────────────────────────────────
  // If batchJobId provided, use it. Otherwise find all real_ai batch jobs.
  let targetJobIds: string[] = [];

  if (batchJobId) {
    targetJobIds = [batchJobId];
  } else {
    // Find all real_ai pilot batch jobs that have assets
    const { data: pilotJobs } = await supabase
      .from('sie_jobs')
      .select('id, pilot_job_name')
      .eq('provider_mode', 'real_ai')
      .not('pilot_job_name', 'is', null)
      .is('is_superseded', null);

    if (pilotJobs && pilotJobs.length > 0) {
      targetJobIds = pilotJobs.map((j) => j.id);
    }
  }

  if (targetJobIds.length === 0) {
    return NextResponse.json({ error: 'No batch jobs found' }, { status: 404 });
  }

  // ── Find all validated results that need propagation ──────────────────
  // Select from openai_pilot_results where:
  //   - job_id in targetJobIds
  //   - human_validated = true
  //   - propagation_status is null, 'pending', 'partial', 'failed', or 'propagating'
  //   (NOT 'completed')
  const { data: resultsToPropagateRaw, error: resultsError } = await supabase
    .from('openai_pilot_results')
    .select('id, job_id, asset_id, public_asset_id, propagation_status, human_validated, review_status')
    .in('job_id', targetJobIds)
    .eq('human_validated', true)
    .not('review_status', 'eq', 'skipped');

  if (resultsError) {
    return NextResponse.json({ error: `Failed to query results: ${resultsError.message}` }, { status: 500 });
  }

  // Filter: exclude already fully propagated (propagation_status = 'completed' with asset_species)
  const resultsToProcess = (resultsToPropagateRaw ?? []).filter(
    (r) => !r.propagation_status || r.propagation_status !== 'completed'
  );

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalValidated: (resultsToPropagateRaw ?? []).length,
      toProcess: resultsToProcess.length,
      alreadyCompleted: (resultsToPropagateRaw ?? []).length - resultsToProcess.length,
      results: resultsToProcess.map((r) => ({
        resultId: r.id,
        publicAssetId: r.public_asset_id,
        currentPropagationStatus: r.propagation_status,
      })),
    });
  }

  // ── Process each result ───────────────────────────────────────────────
  const results: Array<{
    resultId: string;
    publicAssetId: string;
    status: 'propagated' | 'already_propagated' | 'failed' | 'skipped_no_candidate';
    steps: string[];
    errors: string[];
    speciesId: string | null;
    message: string;
  }> = [];

  let propagatedCount = 0;
  let alreadyPropagatedCount = 0;
  let failedCount = 0;
  let speciesCreatedCount = 0;
  let speciesReusedCount = 0;
  let assetSpeciesWrittenCount = 0;
  let aliasesWrittenTotal = 0;
  let speciesNamesWrittenTotal = 0;

  for (const result of resultsToProcess) {
    try {
      // Find the selected/validated candidate for this result
      const { data: candidates } = await supabase
        .from('openai_pilot_candidates')
        .select('*')
        .eq('result_id', result.id)
        .order('rank', { ascending: true });

      if (!candidates || candidates.length === 0) {
        results.push({
          resultId: result.id,
          publicAssetId: result.public_asset_id,
          status: 'skipped_no_candidate',
          steps: [],
          errors: ['No candidates found for this result'],
          speciesId: null,
          message: 'Skipped: no candidates found',
        });
        continue;
      }

      // Prefer the selected/validated candidate, fallback to rank 1
      const candidate =
        candidates.find((c) => c.is_selected || c.is_validated) ??
        candidates.find((c) => c.rank === 1) ??
        candidates[0];

      // Load metadata for this candidate
      const { data: meta } = await supabase
        .from('openai_pilot_candidate_metadata')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      // Find the batch job asset entry for this result
      const { data: jobAsset } = await supabase
        .from('openai_pilot_job_assets')
        .select('batch_job_id, asset_job_id')
        .eq('result_id', result.id)
        .maybeSingle();

      // Find the sie_job for this asset (for jobId parameter)
      const jobId = jobAsset?.asset_job_id ?? result.job_id;

      // Build field decisions: approve all fields that have values
      // (backfill uses approve-all since human already validated)
      const fieldDecisions: Record<string, { action: 'approve' }> = {};
      if (candidate.common_name) fieldDecisions['species'] = { action: 'approve' };
      if (candidate.scientific_name) fieldDecisions['scientific_name'] = { action: 'approve' };
      if (candidate.family) fieldDecisions['family'] = { action: 'approve' };
      if (candidate.genus) fieldDecisions['genus'] = { action: 'approve' };
      if (candidate.biological_order) fieldDecisions['order_name'] = { action: 'approve' };
      if (meta?.commercial_names?.length) fieldDecisions['commercial_name'] = { action: 'approve' };
      if (meta?.local_names_fr?.length || meta?.local_names_en?.length) fieldDecisions['local_names'] = { action: 'approve' };
      if (meta?.keywords?.length) fieldDecisions['keywords'] = { action: 'approve' };
      if (meta?.category) fieldDecisions['category'] = { action: 'approve' };
      if (meta?.short_description) fieldDecisions['description'] = { action: 'approve' };
      if (meta?.packaging) fieldDecisions['packaging'] = { action: 'approve' };
      if (meta?.product_form) fieldDecisions['product_type'] = { action: 'approve' };

      const propagationResult = await propagateHumanValidatedIdentification(supabase, {
        resultId: result.id,
        jobId,
        assetId: result.asset_id,
        publicAssetId: result.public_asset_id,
        candidateId: candidate.id,
        candidateSource: 'openai_pilot',
        batchJobId: jobAsset?.batch_job_id ?? null,
        fieldDecisions,
        editValues: {},
        comment: 'Backfill propagation — batch 02',
        commonName: candidate.common_name,
        scientificName: candidate.scientific_name ?? null,
        family: candidate.family ?? null,
        genus: candidate.genus ?? null,
        biologicalOrder: candidate.biological_order ?? null,
        confidenceScore: candidate.confidence_score ?? null,
        commercialNames: meta?.commercial_names ?? [],
        localNamesFr: meta?.local_names_fr ?? [],
        localNamesEn: meta?.local_names_en ?? [],
        localNamesEs: meta?.local_names_es ?? [],
        localNamesPt: meta?.local_names_pt ?? [],
        localNamesAr: meta?.local_names_ar ?? [],
        synonyms: meta?.synonyms ?? [],
        reviewerId: profile.id,
        reviewerName: profile.display_name ?? profile.email ?? null,
      });

      results.push({
        resultId: result.id,
        publicAssetId: result.public_asset_id,
        status: propagationResult.status,
        steps: propagationResult.steps,
        errors: propagationResult.errors,
        speciesId: propagationResult.speciesId,
        message: propagationResult.message,
      });

      if (propagationResult.status === 'propagated') {
        propagatedCount++;
        if (propagationResult.speciesCreated) speciesCreatedCount++;
        if (propagationResult.speciesReused) speciesReusedCount++;
        if (propagationResult.assetSpeciesWritten) assetSpeciesWrittenCount++;
        aliasesWrittenTotal += propagationResult.aliasesWritten;
        speciesNamesWrittenTotal += propagationResult.speciesNamesWritten;
      } else if (propagationResult.status === 'already_propagated') {
        alreadyPropagatedCount++;
      } else {
        failedCount++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        resultId: result.id,
        publicAssetId: result.public_asset_id,
        status: 'failed',
        steps: [],
        errors: [msg],
        speciesId: null,
        message: `Exception: ${msg}`,
      });
      failedCount++;
    }
  }

  return NextResponse.json({
    success: failedCount === 0,
    summary: {
      totalAudited: resultsToProcess.length,
      propagated: propagatedCount,
      alreadyPropagated: alreadyPropagatedCount,
      failed: failedCount,
      speciesCreated: speciesCreatedCount,
      speciesReused: speciesReusedCount,
      assetSpeciesWritten: assetSpeciesWrittenCount,
      aliasesWritten: aliasesWrittenTotal,
      speciesNamesWritten: speciesNamesWrittenTotal,
    },
    results,
  });
}
