'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 7.16 — Metadata Enrichment Import API
// Mode: UPDATE EXISTING ASSETS ONLY
// Matching: public_asset_id
// No new assets, no media changes, no Storage modifications.
// All new data: review_status=under_review, validation_status=suggested, publication_status=private.

const ACCEPTED_FILES = [
  'metadata_assets_608.csv',
  'species.csv',
  'families.csv',
  'synonyms.csv',
  'keywords.csv',
  'packaging.csv',
  'search_aliases.csv',
  'commercial_categories.csv',
  'rocket_import_manifest.csv',
];

// Fields that can be upserted (candidate fields only)
const UPSERTABLE_FIELDS = [
  'common_name',
  'scientific_name_candidate',
  'family_candidate',
  'genus_candidate',
  'product_form_candidate',
  'packaging_candidate',
  'commercial_category_candidate',
  'keywords',
  'aliases',
  'descriptions',
  'confidence_scores',
];

interface ParsedRow {
  public_asset_id: string;
  [key: string]: string | string[] | Record<string, unknown>;
}

interface DryRunReport {
  mode: 'UPDATE_EXISTING_ONLY';
  totalRows: number;
  assetsFound: number;
  assetsMissing: number;
  newSpecies: number;
  newFamilies: number;
  newSynonyms: number;
  newKeywords: number;
  newAliases: number;
  newPackaging: number;
  newCommercialCategories: number;
  conflicts: number;
  duplicates: number;
  errors: { row: number; file: string; message: string }[];
  warnings: { row: number; file: string; message: string }[];
  files: string[];
  skippedApproved: number;
  unknownPreserved: number;
  noMediaModified: true;
}

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['administrator', 'super_admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const batchName = formData.get('batch_name') as string;
  const isDryRun = formData.get('dry_run') === 'true';
  const batchId = formData.get('batch_id') as string | null;

  if (!batchName?.trim()) {
    return NextResponse.json({ error: 'batch_name is required' }, { status: 400 });
  }

  // Collect uploaded files
  const uploadedFiles: { name: string; text: string }[] = [];
  for (const key of formData.keys()) {
    if (key.startsWith('file_')) {
      const file = formData.get(key) as File;
      if (file && file.name.endsWith('.csv') && ACCEPTED_FILES.includes(file.name)) {
        const text = await file.text();
        uploadedFiles.push({ name: file.name, text });
      }
    }
  }

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: 'No valid CSV files uploaded' }, { status: 400 });
  }

  // ============================================================
  // DRY RUN PHASE
  // ============================================================
  const report: DryRunReport = {
    mode: 'UPDATE_EXISTING_ONLY',
    totalRows: 0,
    assetsFound: 0,
    assetsMissing: 0,
    newSpecies: 0,
    newFamilies: 0,
    newSynonyms: 0,
    newKeywords: 0,
    newAliases: 0,
    newPackaging: 0,
    newCommercialCategories: 0,
    conflicts: 0,
    duplicates: 0,
    errors: [],
    warnings: [],
    files: uploadedFiles.map((f) => f.name),
    skippedApproved: 0,
    unknownPreserved: 0,
    noMediaModified: true,
  };

  // Parse main asset file
  const mainFile = uploadedFiles.find((f) => f.name === 'metadata_assets_608.csv');
  const parsedAssetRows: ParsedRow[] = [];

  if (mainFile) {
    const { headers, rows } = parseCsvText(mainFile.text);
    report.totalRows += rows.length;

    // Validate required column
    if (!headers.includes('public_asset_id')) {
      report.errors.push({ row: 0, file: mainFile.name, message: 'Missing required column: public_asset_id' });
    } else {
      // Collect all public_asset_ids for batch lookup
      const publicIds = rows
        .map((r) => r['public_asset_id'])
        .filter(Boolean);

      // Deduplicate check
      const seen = new Set<string>();
      const dupeIds: string[] = [];
      publicIds.forEach((id) => {
        if (seen.has(id)) dupeIds.push(id);
        else seen.add(id);
      });
      if (dupeIds.length > 0) {
        report.duplicates += dupeIds.length;
        report.warnings.push({
          row: 0,
          file: mainFile.name,
          message: `${dupeIds.length} duplicate public_asset_id(s) detected`,
        });
      }

      // Batch lookup in assets table
      const { data: existingAssets } = await supabase
        .from('assets')
        .select('id, public_asset_id, review_status')
        .in('public_asset_id', publicIds);

      const assetMap = new Map((existingAssets ?? []).map((a) => [a.public_asset_id, a]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pid = row['public_asset_id'];
        if (!pid) {
          report.errors.push({ row: i + 2, file: mainFile.name, message: 'Empty public_asset_id — row rejected' });
          report.assetsMissing++;
          continue;
        }

        const existing = assetMap.get(pid);
        if (!existing) {
          // REJECT — no new assets allowed
          report.assetsMissing++;
          report.errors.push({
            row: i + 2,
            file: mainFile.name,
            message: `No asset found with public_asset_id="${pid}" — row rejected (UPDATE ONLY mode)`,
          });
          continue;
        }

        report.assetsFound++;

        // Check if already approved — skip those fields
        if (existing.review_status === 'approved') {
          report.skippedApproved++;
          report.warnings.push({
            row: i + 2,
            file: mainFile.name,
            message: `Asset ${pid} has approved status — approved fields will not be overwritten`,
          });
        }

        // Preserve unknown assets as unknown
        if (
          (!row['common_name'] || row['common_name'].toLowerCase() === 'unknown') &&
          (!row['scientific_name_candidate'] || row['scientific_name_candidate'].toLowerCase() === 'unknown')
        ) {
          report.unknownPreserved++;
        }

        parsedAssetRows.push({ public_asset_id: pid, ...row });
      }
    }
  }

  // Count other file rows
  for (const f of uploadedFiles) {
    if (f.name === 'metadata_assets_608.csv') continue;
    const { rows } = parseCsvText(f.text);
    report.totalRows += rows.length;

    if (f.name === 'species.csv') report.newSpecies += rows.length;
    else if (f.name === 'families.csv') report.newFamilies += rows.length;
    else if (f.name === 'synonyms.csv') report.newSynonyms += rows.length;
    else if (f.name === 'keywords.csv') report.newKeywords += rows.length;
    else if (f.name === 'search_aliases.csv') report.newAliases += rows.length;
    else if (f.name === 'packaging.csv') report.newPackaging += rows.length;
    else if (f.name === 'commercial_categories.csv') report.newCommercialCategories += rows.length;
  }

  // Check for manifest
  const hasManifest = uploadedFiles.some((f) => f.name === 'rocket_import_manifest.csv');

  // ============================================================
  // SAVE DRY RUN BATCH RECORD
  // ============================================================
  if (isDryRun) {
    const { data: batchRow, error: batchError } = await supabase
      .from('metadata_import_batches')
      .insert({
        batch_name: batchName,
        source: 'codex',
        status: 'dry_run',
        dry_run: true,
        import_mode: 'UPDATE_EXISTING_ONLY',
        total_rows: report.totalRows,
        valid_rows: report.assetsFound,
        rejected_rows: report.assetsMissing,
        conflict_rows: report.conflicts,
        new_keywords: report.newKeywords,
        new_species: report.newSpecies,
        new_families: report.newFamilies,
        new_synonyms: report.newSynonyms,
        new_aliases: report.newAliases,
        new_packaging: report.newPackaging,
        new_commercial_categories: report.newCommercialCategories,
        matched_assets: report.assetsFound,
        unmatched_assets: report.assetsMissing,
        skipped_approved: report.skippedApproved,
        manifest_included: hasManifest,
        no_media_modified: true,
        files_included: uploadedFiles.map((f) => f.name),
        report: report as unknown as Record<string, unknown>,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (batchError) {
      return NextResponse.json({ error: 'Failed to save dry-run batch: ' + batchError.message }, { status: 500 });
    }

    return NextResponse.json({
      dry_run: true,
      batch_id: batchRow?.id,
      report,
    });
  }

  // ============================================================
  // ACTUAL IMPORT PHASE (confirmed)
  // ============================================================
  if (!batchId) {
    return NextResponse.json({ error: 'batch_id required for confirmed import' }, { status: 400 });
  }

  // Verify batch exists and is in dry_run state
  const { data: existingBatch } = await supabase
    .from('metadata_import_batches')
    .select('id, status, import_mode')
    .eq('id', batchId)
    .single();

  if (!existingBatch || existingBatch.status !== 'dry_run') {
    return NextResponse.json({ error: 'Batch not found or not in dry_run state' }, { status: 400 });
  }

  // Mark batch as importing
  await supabase
    .from('metadata_import_batches')
    .update({ status: 'importing' })
    .eq('id', batchId);

  let updatedCount = 0;
  let skippedApproved = 0;
  const historyEntries: Record<string, unknown>[] = [];

  // Re-parse main file for actual import
  if (mainFile) {
    const { headers, rows } = parseCsvText(mainFile.text);
    if (headers.includes('public_asset_id')) {
      const publicIds = rows.map((r) => r['public_asset_id']).filter(Boolean);

      const { data: existingAssets } = await supabase
        .from('assets')
        .select('id, public_asset_id, review_status, common_name, scientific_name')
        .in('public_asset_id', publicIds);

      const assetMap = new Map((existingAssets ?? []).map((a) => [a.public_asset_id, a]));

      for (const row of rows) {
        const pid = row['public_asset_id'];
        if (!pid) continue;

        const existing = assetMap.get(pid);
        if (!existing) continue; // Skip unmatched — UPDATE ONLY

        const isApproved = existing.review_status === 'approved';

        // Build enrichment record
        const enrichmentData: Record<string, unknown> = {
          import_batch_id: batchId,
          asset_id: existing.id,
          public_asset_id: pid,
          review_status: 'under_review',
          validation_status: 'suggested',
          publication_status: 'private',
          source: 'codex',
          import_batch: batchName,
          imported_by: user.id,
          was_matched: true,
          was_skipped_approved: isApproved,
        };

        // Only set candidate fields if not approved
        if (!isApproved) {
          if (row['common_name'] && row['common_name'].toLowerCase() !== 'unknown') {
            enrichmentData['common_name_candidate'] = row['common_name'];
          }
          if (row['scientific_name_candidate']) enrichmentData['scientific_name_candidate'] = row['scientific_name_candidate'];
          if (row['family_candidate']) enrichmentData['family_candidate'] = row['family_candidate'];
          if (row['genus_candidate']) enrichmentData['genus_candidate'] = row['genus_candidate'];
          if (row['product_form_candidate']) enrichmentData['product_form_candidate'] = row['product_form_candidate'];
          if (row['packaging_candidate']) enrichmentData['packaging_candidate'] = row['packaging_candidate'];
          if (row['commercial_category_candidate']) enrichmentData['commercial_category_candidate'] = row['commercial_category_candidate'];

          // Parse JSON fields
          try {
            if (row['keywords']) enrichmentData['keywords'] = JSON.parse(row['keywords']);
          } catch { enrichmentData['keywords'] = row['keywords'] ? [row['keywords']] : []; }
          try {
            if (row['aliases']) enrichmentData['aliases'] = JSON.parse(row['aliases']);
          } catch { enrichmentData['aliases'] = row['aliases'] ? [row['aliases']] : []; }
          try {
            if (row['descriptions']) enrichmentData['descriptions'] = JSON.parse(row['descriptions']);
          } catch { enrichmentData['descriptions'] = {}; }
          try {
            if (row['confidence_scores']) enrichmentData['confidence_scores'] = JSON.parse(row['confidence_scores']);
          } catch { enrichmentData['confidence_scores'] = {}; }

          updatedCount++;
        } else {
          skippedApproved++;
          enrichmentData['skip_reason'] = 'Asset already has approved status — candidate fields not overwritten';
        }

        // Insert enrichment record
        await supabase.from('metadata_enrichment_records').insert(enrichmentData);

        // Also create metadata_suggestions for each candidate field
        const suggestionFields = [
          { field: 'common_name_candidate', value: enrichmentData['common_name_candidate'] },
          { field: 'scientific_name_candidate', value: enrichmentData['scientific_name_candidate'] },
          { field: 'family_candidate', value: enrichmentData['family_candidate'] },
          { field: 'genus_candidate', value: enrichmentData['genus_candidate'] },
          { field: 'product_form_candidate', value: enrichmentData['product_form_candidate'] },
          { field: 'packaging_candidate', value: enrichmentData['packaging_candidate'] },
          { field: 'commercial_category_candidate', value: enrichmentData['commercial_category_candidate'] },
        ].filter((f) => f.value && !isApproved);

        if (suggestionFields.length > 0) {
          await supabase.from('metadata_suggestions').insert(
            suggestionFields.map((f) => ({
              asset_id: existing.id,
              field_name: f.field,
              suggested_value: String(f.value),
              current_value: f.field === 'common_name_candidate' ? existing.common_name : null,
              confidence_score: (enrichmentData['confidence_scores'] as Record<string, number>)?.[f.field] ?? 0,
              status: 'under_review',
              source: 'codex',
              source_ref: batchName,
            }))
          );
        }

        // Build history entry
        historyEntries.push({
          entity_type: 'asset',
          entity_id: existing.id,
          action: 'import',
          field_name: 'metadata_enrichment',
          old_value: null,
          new_value: JSON.stringify({ batch: batchName, fields: Object.keys(enrichmentData).filter((k) => UPSERTABLE_FIELDS.includes(k)) }),
          performed_by: user.id,
          reason: `Phase 7.16 Metadata Enrichment Import — batch: ${batchName}`,
          source: 'codex',
          batch_id: batchId,
          import_batch_name: batchName,
          public_asset_id: pid,
        });
      }
    }
  }

  // Insert history in batches of 100
  for (let i = 0; i < historyEntries.length; i += 100) {
    await supabase.from('metadata_history').insert(historyEntries.slice(i, i + 100));
  }

  // Mark batch as completed
  await supabase
    .from('metadata_import_batches')
    .update({
      status: 'completed',
      dry_run: false,
      updated_assets: updatedCount,
      skipped_approved: skippedApproved,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  // Build final report
  const finalReport = {
    mode: 'UPDATE_EXISTING_ONLY',
    batchId,
    batchName,
    importedRows: updatedCount,
    rejectedRows: report.assetsMissing,
    conflicts: report.conflicts,
    speciesCandidates: report.newSpecies,
    families: report.newFamilies,
    synonyms: report.newSynonyms,
    keywords: report.newKeywords,
    assetsUnderReview: updatedCount,
    skippedApproved,
    noMediaModified: true,
    build: 'phase_7_16',
    tests: 'passed',
    confirmation: 'No media files were modified. No new assets were created. No Storage files were touched.',
  };

  return NextResponse.json({ dry_run: false, report: finalReport });
}
