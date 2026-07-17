// ============================================================
// SEAFOOD VISION — OpenAI Pilot Import API Route
// Handles dry-run and confirmed import of OpenAI Vision pilot CSVs
// Each confirmed import creates a NEW sie_jobs batch record + openai_pilot_job_assets entries
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── CSV Parsers ──────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseArray(val: string): string[] {
  if (!val) return [];
  return val.split('|').map((s) => s.trim()).filter(Boolean);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const mode = formData.get('mode') as string; // 'dry_run' | 'import'

  // Parse all CSV files
  const jobsFile = formData.get('jobs') as File | null;
  const resultsFile = formData.get('results') as File | null;
  const candidatesFile = formData.get('candidates') as File | null;
  const metadataFile = formData.get('metadata') as File | null;
  const localNamesFile = formData.get('local_names') as File | null;
  const keywordsFile = formData.get('keywords') as File | null;

  if (!jobsFile || !resultsFile || !candidatesFile) {
    return NextResponse.json({ error: 'Missing required CSV files: jobs, results, candidates' }, { status: 400 });
  }

  const [jobsText, resultsText, candidatesText, metadataText, localNamesText, keywordsText] = await Promise.all([
    jobsFile.text(),
    resultsFile.text(),
    candidatesFile.text(),
    metadataFile ? metadataFile.text() : Promise.resolve(''),
    localNamesFile ? localNamesFile.text() : Promise.resolve(''),
    keywordsFile ? keywordsFile.text() : Promise.resolve(''),
  ]);

  const jobRows = parseCSV(jobsText);
  const resultRows = parseCSV(resultsText);
  const candidateRows = parseCSV(candidatesText);
  const metadataRows = metadataText ? parseCSV(metadataText) : [];
  const localNameRows = localNamesText ? parseCSV(localNamesText) : [];
  const keywordRows = keywordsText ? parseCSV(keywordsText) : [];

  // Extract all public_asset_ids from results
  const expectedPublicIds = [...new Set(resultRows.map((r) => r.public_asset_id).filter(Boolean))];

  // Match against existing assets
  const { data: existingAssets } = await supabase
    .from('assets')
    .select('id, public_asset_id, title, review_status, species_id')
    .in('public_asset_id', expectedPublicIds);

  const assetMap = new Map<string, { id: string; title: string | null; review_status: string | null; species_id: string | null }>();
  (existingAssets ?? []).forEach((a) => {
    if (a.public_asset_id) assetMap.set(a.public_asset_id, a);
  });

  const assetsFound = expectedPublicIds.filter((id) => assetMap.has(id));
  const assetsMissing = expectedPublicIds.filter((id) => !assetMap.has(id));

  // Check for existing mock proposals
  const { count: mockProposalsCount } = await supabase
    .from('sie_species_candidates')
    .select('*', { count: 'exact', head: true })
    .in('asset_id', assetsFound.map((id) => assetMap.get(id)!.id));

  // Check for existing real AI results
  const { count: existingRealAI } = await supabase
    .from('openai_pilot_results')
    .select('*', { count: 'exact', head: true })
    .in('public_asset_id', expectedPublicIds);

  // Count existing pilot batches to generate batch name
  const { count: existingBatchCount } = await supabase
    .from('sie_jobs')
    .select('*', { count: 'exact', head: true })
    .not('pilot_job_name', 'is', null)
    .eq('provider_mode', 'real_ai');

  // Build dry-run report
  const batchNumber = (existingBatchCount ?? 0) + 1;
  const assetCount = assetsFound.length;
  const batchLabel = batchNumber === 1
    ? `OpenAI Pilot ${assetCount}`
    : `Batch ${String(batchNumber - 1).padStart(2, '0')} (${assetCount})`;

  const dryRunReport = {
    assets_expected: expectedPublicIds.length,
    assets_found: assetsFound.length,
    assets_missing: assetsMissing,
    results_found: resultRows.filter((r) => assetsFound.includes(r.public_asset_id)).length,
    candidates_found: candidateRows.filter((c) => assetsFound.includes(c.public_asset_id)).length,
    metadata_found: metadataRows.filter((m) => assetsFound.includes(m.public_asset_id)).length,
    local_names_found: localNameRows.filter((l) => assetsFound.includes(l.public_asset_id)).length,
    keywords_found: keywordRows.filter((k) => assetsFound.includes(k.public_asset_id)).length,
    conflicts: existingRealAI ?? 0,
    duplicates: 0,
    mock_proposals_existing: mockProposalsCount ?? 0,
    rows_to_create: resultRows.filter((r) => assetsFound.includes(r.public_asset_id)).length,
    rows_to_update: existingRealAI ?? 0,
    rejected_rows: assetsMissing.map((id) => ({ public_asset_id: id, reason: 'Asset not found in database' })),
    batch_label: batchLabel,
  };

  // ── Duplicate detection ──────────────────────────────────────────────────
  // Check if any existing batch job already contains the same public_asset_ids.
  // If so, return the existing canonical job instead of creating a duplicate.
  if (mode === 'import' || mode === 'dry_run') {
    const { data: existingBatchJobs } = await supabase
      .from('sie_jobs')
      .select('id, pilot_job_name, total_assets, created_at')
      .not('pilot_job_name', 'is', null)
      .eq('provider_mode', 'real_ai')
      .order('created_at', { ascending: false });

    if (existingBatchJobs && existingBatchJobs.length > 0) {
      for (const existingJob of existingBatchJobs) {
        // Check overlap: how many of the incoming public_asset_ids already exist in this job
        const { data: existingAssetRows } = await supabase
          .from('openai_pilot_results')
          .select('public_asset_id')
          .eq('job_id', existingJob.id)
          .in('public_asset_id', expectedPublicIds);

        const overlapCount = existingAssetRows?.length ?? 0;
        const overlapRatio = expectedPublicIds.length > 0 ? overlapCount / expectedPublicIds.length : 0;

        // If ≥ 90% overlap, this is a duplicate import
        if (overlapRatio >= 0.9) {
          const duplicateReport = {
            ...dryRunReport,
            is_duplicate: true,
            duplicate_of_job_id: existingJob.id,
            duplicate_of_job_name: existingJob.pilot_job_name,
            overlap_count: overlapCount,
            overlap_ratio: Math.round(overlapRatio * 100),
            message: `This batch is a duplicate of "${existingJob.pilot_job_name}" (${Math.round(overlapRatio * 100)}% overlap). Import blocked to prevent duplication.`,
          };

          if (mode === 'dry_run') {
            return NextResponse.json({ success: true, mode: 'dry_run', report: duplicateReport });
          }

          // For confirmed import, block it and return the existing job
          return NextResponse.json({
            success: false,
            mode: 'import',
            error: `Duplicate import blocked: ${Math.round(overlapRatio * 100)}% of these assets already exist in "${existingJob.pilot_job_name}". Use the existing batch in Human Validation.`,
            duplicate_of_job_id: existingJob.id,
            duplicate_of_job_name: existingJob.pilot_job_name,
            report: duplicateReport,
          }, { status: 409 });
        }
      }
    }
  }

  if (mode === 'dry_run') {
    return NextResponse.json({ success: true, mode: 'dry_run', report: dryRunReport });
  }

  // ─── CONFIRMED IMPORT ────────────────────────────────────────────────────────

  // Create import log
  const { data: importLog } = await supabase
    .from('openai_pilot_import_log')
    .insert({
      imported_by: user.id,
      import_mode: 'confirmed',
      assets_expected: dryRunReport.assets_expected,
      assets_found: dryRunReport.assets_found,
      assets_missing: dryRunReport.assets_missing.length,
      status: 'running',
    })
    .select('id')
    .single();

  const importLogId = importLog?.id;

  // Always create a NEW sie_jobs record for each import batch
  // This ensures each batch is independently selectable in the validation workspace
  const firstAssetId = assetsFound[0] ? assetMap.get(assetsFound[0])?.id : null;
  const avgConf = resultRows.length > 0
    ? resultRows.reduce((s, r) => s + parseFloat(r.avg_confidence || '0'), 0) / resultRows.length
    : 0;

  const { data: newJob } = await supabase
    .from('sie_jobs')
    .insert({
      asset_id: firstAssetId ?? null,
      public_asset_id: assetsFound[0] ?? null,
      pilot_job_name: batchLabel,
      job_status: 'proposals_ready',
      ai_provider: 'openai',
      ai_model: 'gpt-5-mini-2025-08-07',
      provider_mode: 'real_ai',
      total_assets: assetsFound.length,
      avg_confidence: Math.round(avgConf * 100),
      global_confidence: Math.round(avgConf * 100),
      processing_progress: assetsFound.length,
      validation_progress: 0,
    })
    .select('id')
    .single();

  const pilotJobId = newJob?.id ?? null;

  // Import results + candidates per asset
  let resultsImported = 0;
  let candidatesImported = 0;
  let metadataImported = 0;
  let reviewPosition = 1;

  for (const publicAssetId of assetsFound) {
    const asset = assetMap.get(publicAssetId)!;
    const resultRow = resultRows.find((r) => r.public_asset_id === publicAssetId);
    if (!resultRow) continue;

    // Insert a new pilot result for this batch (do NOT upsert — each batch gets its own rows)
    const { data: pilotResult, error: resultError } = await supabase
      .from('openai_pilot_results')
      .insert({
        asset_id: asset.id,
        public_asset_id: publicAssetId,
        job_id: pilotJobId,
        provider: 'openai',
        provider_mode: 'real_ai',
        model: 'gpt-5-mini-2025-08-07',
        validation_status: 'suggested_unverified',
        review_status: 'under_review',
        publication_status: 'private',
        requires_human_review: true,
        human_validated: false,
        total_candidates: parseInt(resultRow.total_candidates || '0'),
        avg_confidence: parseFloat(resultRow.avg_confidence || '0'),
        import_log_id: importLogId,
      })
      .select('id')
      .single();

    if (resultError || !pilotResult) {
      console.error(`[Import] Failed to insert result for ${publicAssetId}:`, resultError?.message ?? 'null result');
      continue;
    }
    resultsImported++;

    // Create openai_pilot_job_assets entry for this batch asset
    // This is what the validation workspace uses to navigate assets
    await supabase
      .from('openai_pilot_job_assets')
      .insert({
        batch_job_id: pilotJobId,
        asset_id: asset.id,
        public_asset_id: publicAssetId,
        result_id: pilotResult.id,
        review_position: reviewPosition,
        review_status: 'unreviewed',
      });
    reviewPosition++;

    // Import candidates for this asset
    const assetCandidates = candidateRows.filter((c) => c.public_asset_id === publicAssetId);
    for (const cRow of assetCandidates) {
      const { data: candidate, error: candidateError } = await supabase
        .from('openai_pilot_candidates')
        .insert({
          result_id: pilotResult.id,
          job_id: pilotJobId,
          asset_id: asset.id,
          public_asset_id: publicAssetId,
          rank: parseInt(cRow.rank || '1'),
          common_name: cRow.common_name || 'Unknown',
          scientific_name: cRow.scientific_name || null,
          family: cRow.family || null,
          genus: cRow.genus || null,
          biological_order: cRow.biological_order || null,
          taxonomic_level: cRow.taxonomic_level || null,
          confidence_score: parseFloat(cRow.confidence_score || '0'),
          visual_evidence: parseArray(cRow.visual_evidence),
          identification_limits: parseArray(cRow.identification_limits),
          source: 'openai_vision',
          provider: 'openai',
          provider_mode: 'real_ai',
          status: 'suggested_unverified',
        })
        .select('id')
        .single();

      if (candidateError || !candidate) {
        console.error(`[Import] Failed to insert candidate rank ${cRow.rank} for ${publicAssetId}:`, candidateError?.message ?? 'null result');
        continue;
      }
      candidatesImported++;

      // Import metadata for this candidate
      const metaRow = metadataRows.find(
        (m) => m.public_asset_id === publicAssetId && m.rank === cRow.rank
      );
      const localNameRow = localNameRows.find(
        (l) => l.public_asset_id === publicAssetId && l.rank === cRow.rank
      );
      const keywordRow = keywordRows.find(
        (k) => k.public_asset_id === publicAssetId && k.rank === cRow.rank
      );

      if (metaRow || localNameRow || keywordRow) {
        const { error: metaError } = await supabase.from('openai_pilot_candidate_metadata').insert({
          candidate_id: candidate.id,
          result_id: pilotResult.id,
          public_asset_id: publicAssetId,
          species_name: metaRow?.species_name || cRow.common_name,
          scientific_name: metaRow?.scientific_name || cRow.scientific_name,
          family: metaRow?.family || cRow.family,
          genus: metaRow?.genus || cRow.genus,
          biological_order: metaRow?.biological_order || cRow.biological_order,
          commercial_names: parseArray(metaRow?.commercial_names || ''),
          local_names_fr: parseArray(localNameRow?.names_fr || ''),
          local_names_en: parseArray(localNameRow?.names_en || ''),
          local_names_es: parseArray(localNameRow?.names_es || ''),
          local_names_pt: parseArray(localNameRow?.names_pt || ''),
          local_names_ar: parseArray(localNameRow?.names_ar || ''),
          synonyms: parseArray(metaRow?.synonyms || ''),
          category: metaRow?.category || null,
          product_form: metaRow?.product_form || null,
          conservation_method: metaRow?.conservation_method || null,
          packaging: metaRow?.packaging || null,
          keywords: parseArray(keywordRow?.keywords || ''),
          short_description: metaRow?.short_description || null,
          vision_confidence: parseFloat(metaRow?.vision_confidence || cRow.confidence_score || '0'),
          species_confidence: parseFloat(metaRow?.species_confidence || '0'),
          commercial_confidence: parseFloat(metaRow?.commercial_confidence || '0'),
          metadata_confidence: parseFloat(metaRow?.metadata_confidence || '0'),
          global_confidence: parseFloat(metaRow?.global_confidence || cRow.confidence_score || '0'),
          warnings: parseArray(metaRow?.warnings || ''),
        });
        if (metaError) {
          console.error(`[Import] Failed to insert metadata for candidate ${candidate.id}:`, metaError.message);
        } else {
          metadataImported++;
        }
      }
    }
  }

  // Update import log
  await supabase
    .from('openai_pilot_import_log')
    .update({
      results_imported: resultsImported,
      candidates_imported: candidatesImported,
      metadata_imported: metadataImported,
      mock_proposals_preserved: mockProposalsCount ?? 0,
      real_ai_proposals_created: candidatesImported,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', importLogId);

  return NextResponse.json({
    success: true,
    mode: 'import',
    pilot_job_id: pilotJobId,
    batch_label: batchLabel,
    report: {
      ...dryRunReport,
      results_imported: resultsImported,
      candidates_imported: candidatesImported,
      metadata_imported: metadataImported,
    },
  });
}
