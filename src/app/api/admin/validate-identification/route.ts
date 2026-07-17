// ============================================================
// SEAFOOD VISION — Transactional Validation API
// POST /api/admin/validate-identification
// Performs a full transactional CONFIRM IDENTIFICATION:
//   1. Marks candidate as validated
//   2. Marks openai_pilot_result as human_validated
//   3. Updates sie_jobs status
//   4. Finds or creates species (dedup by scientific_name)
//   5. Writes asset_species row
//   6. Updates assets.search_aliases + validated_metadata
//   7. Writes species_names / aliases
//   8. Updates openai_pilot_job_assets review_status
//   9. Writes propagation log entries
//  10. Logs validation history
//
// CRITICAL STEPS (1-8): if any fail → return error, do NOT mark
//   human_validated, do NOT advance to next asset.
// NON-CRITICAL STEPS (9-10): logged but do not block success.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface FieldDecision {
  action: 'approve' | 'reject' | 'edit' | 'unknown';
  value?: string;
}

interface ValidateRequest {
  jobId: string;
  assetId: string | null;
  publicAssetId: string | null;
  candidateId: string;
  candidateSource: 'sie' | 'openai_pilot';
  resultId?: string | null;
  batchJobId?: string | null;
  fieldDecisions: Record<string, FieldDecision>;
  editValues: Record<string, string>;
  comment?: string;
  commonName: string;
  scientificName: string | null;
  family: string | null;
  genus: string | null;
  biologicalOrder: string | null;
  confidenceScore: number | null;
  commercialNames?: string[];
  localNamesFr?: string[];
  localNamesEn?: string[];
  localNamesEs?: string[];
  localNamesPt?: string[];
  localNamesAr?: string[];
  synonyms?: string[];
}

function normalizeText(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildSearchAliases(
  commonName: string,
  scientificName: string | null,
  family: string | null,
  genus: string | null,
  commercialNames: string[],
  localNames: string[],
  synonyms: string[]
): string[] {
  const aliases = new Set<string>();

  const add = (v: string | null | undefined) => {
    if (!v) return;
    const n = normalizeText(v);
    if (n) aliases.add(n);
  };

  add(commonName);
  add(scientificName);
  add(family);
  add(genus);

  if (scientificName) {
    const parts = scientificName.trim().split(/\s+/);
    if (parts.length >= 1) add(parts[0]);
  }

  if (commonName) {
    commonName.split(/\s+/).forEach((w) => { if (w.length > 3) add(w); });
  }

  commercialNames.forEach(add);
  localNames.forEach(add);
  synonyms.forEach(add);

  return Array.from(aliases).filter(Boolean);
}

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

  const body: ValidateRequest = await req.json();
  const {
    jobId,
    assetId,
    publicAssetId,
    candidateId,
    candidateSource,
    resultId,
    batchJobId,
    fieldDecisions,
    editValues,
    comment,
    commonName,
    scientificName,
    family,
    genus,
    biologicalOrder,
    confidenceScore,
    commercialNames = [],
    localNamesFr = [],
    localNamesEn = [],
    localNamesEs = [],
    localNamesPt = [],
    localNamesAr = [],
    synonyms = [],
  } = body;

  if (!jobId || !candidateId) {
    return NextResponse.json({ error: 'Missing required fields: jobId, candidateId' }, { status: 400 });
  }

  // ── Helper: get approved value for a field ──────────────────────────────────
  const getApprovedValue = (field: string, fallback: string | null): string | null => {
    const decision = fieldDecisions[field];
    if (!decision) return fallback;
    if (decision.action === 'approve') return fallback;
    if (decision.action === 'edit') return editValues[field] ?? fallback;
    return null; // reject or unknown → don't propagate
  };

  const approvedCommonName = getApprovedValue('species', commonName) ?? commonName;
  const approvedScientificName = getApprovedValue('scientific_name', scientificName);
  const approvedFamily = getApprovedValue('family', family);
  const approvedGenus = getApprovedValue('genus', genus);
  const approvedOrder = getApprovedValue('order_name', biologicalOrder);

  // ── CRITICAL STEPS — any failure here blocks the confirmation ──────────────
  // We collect critical errors and return early if any occur.
  const criticalErrors: string[] = [];
  const steps: string[] = [];
  const nonCriticalErrors: string[] = [];

  // ── Critical Step 1: Mark candidate as validated ───────────────────────────
  try {
    if (candidateSource === 'openai_pilot') {
      const { error } = await supabase
        .from('openai_pilot_candidates')
        .update({ is_selected: true, is_validated: true, status: 'human_validated' })
        .eq('id', candidateId);
      if (error) criticalErrors.push(`candidate_update: ${error.message}`);
      else steps.push('candidate_validated');
    } else {
      const { error } = await supabase
        .from('sie_species_candidates')
        .update({ is_selected: true, is_validated: true })
        .eq('id', candidateId);
      if (error) criticalErrors.push(`candidate_update: ${error.message}`);
      else steps.push('candidate_validated');
    }
  } catch (e) {
    criticalErrors.push(`candidate_update_exception: ${e}`);
  }

  if (criticalErrors.length > 0) {
    return NextResponse.json({
      success: false,
      steps,
      errors: criticalErrors,
      critical_failure: true,
      message: `CONFIRM IDENTIFICATION failed at step 1 (candidate): ${criticalErrors.join('; ')}`,
    }, { status: 500 });
  }

  // ── Critical Step 2: Mark openai_pilot_result as human_validated ───────────
  if (resultId) {
    try {
      const { error } = await supabase
        .from('openai_pilot_results')
        .update({
          human_validated: true,
          validation_status: 'human_validated',
          review_status: 'validated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', resultId);
      if (error) criticalErrors.push(`result_update: ${error.message}`);
      else steps.push('result_validated');
    } catch (e) {
      criticalErrors.push(`result_update_exception: ${e}`);
    }

    if (criticalErrors.length > 0) {
      // Rollback step 1
      try {
        if (candidateSource === 'openai_pilot') {
          await supabase.from('openai_pilot_candidates')
            .update({ is_selected: false, is_validated: false, status: 'suggested_unverified' })
            .eq('id', candidateId);
        }
      } catch { /* best-effort rollback */ }
      return NextResponse.json({
        success: false,
        steps,
        errors: criticalErrors,
        critical_failure: true,
        message: `CONFIRM IDENTIFICATION failed at step 2 (result): ${criticalErrors.join('; ')}`,
      }, { status: 500 });
    }
  }

  // ── Critical Step 3: Update sie_jobs status ────────────────────────────────
  try {
    const { error } = await supabase
      .from('sie_jobs')
      .update({
        job_status: 'validated',
        review_status: 'validated',
        reviewed_at: new Date().toISOString(),
        validated_at: new Date().toISOString(),
        reviewer_id: profile.id,
        reviewer_comment: comment || null,
        propagation_status: 'pending',
      })
      .eq('id', jobId);
    if (error) criticalErrors.push(`job_update: ${error.message}`);
    else steps.push('job_validated');
  } catch (e) {
    criticalErrors.push(`job_update_exception: ${e}`);
  }

  // ── Critical Step 4: Find or create species ────────────────────────────────
  let speciesId: string | null = null;

  if (approvedScientificName) {
    try {
      const normalizedSci = normalizeText(approvedScientificName);
      const { data: existingSpecies } = await supabase
        .from('species')
        .select('id')
        .ilike('scientific_name', normalizedSci)
        .maybeSingle();

      if (existingSpecies?.id) {
        speciesId = existingSpecies.id;
        await supabase.from('species').update({
          common_name: approvedCommonName,
          family: approvedFamily ?? undefined,
          is_validated: true,
          updated_at: new Date().toISOString(),
        }).eq('id', speciesId);
        steps.push('species_reused');
      } else {
        const slug = normalizedSci.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const { data: newSpecies, error: speciesError } = await supabase
          .from('species')
          .insert({
            slug: slug || `species-${Date.now()}`,
            common_name: approvedCommonName,
            scientific_name: approvedScientificName,
            family: approvedFamily ?? null,
            category: null,
            is_validated: true,
            is_demo: false,
          })
          .select('id')
          .single();

        if (speciesError) {
          criticalErrors.push(`species_create: ${speciesError.message}`);
        } else {
          speciesId = newSpecies?.id ?? null;
          steps.push('species_created');
        }
      }
    } catch (e) {
      criticalErrors.push(`species_exception: ${e}`);
    }
  }

  // ── Critical Step 5: Write asset_species row ───────────────────────────────
  if (assetId && speciesId) {
    try {
      await supabase
        .from('asset_species')
        .delete()
        .eq('asset_id', assetId)
        .eq('relation_type', 'primary');

      const { error } = await supabase.from('asset_species').insert({
        asset_id: assetId,
        species_id: speciesId,
        relation_type: 'primary',
        confidence: confidenceScore ?? null,
        source: 'human_validation_from_openai',
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
        status: 'validated',
      });
      if (error) criticalErrors.push(`asset_species: ${error.message}`);
      else steps.push('asset_species_written');
    } catch (e) {
      criticalErrors.push(`asset_species_exception: ${e}`);
    }
  }

  // ── Critical Step 6: Update assets.species_id + search_aliases + validated_metadata ─
  if (assetId) {
    try {
      const allLocalNames = [
        ...localNamesFr, ...localNamesEn, ...localNamesEs,
        ...localNamesPt, ...localNamesAr,
      ];
      const searchAliases = buildSearchAliases(
        approvedCommonName,
        approvedScientificName,
        approvedFamily,
        approvedGenus,
        commercialNames,
        allLocalNames,
        synonyms
      );

      const validatedMetadata = {
        common_name: approvedCommonName,
        scientific_name: approvedScientificName,
        family: approvedFamily,
        genus: approvedGenus,
        biological_order: approvedOrder,
        commercial_names: commercialNames,
        local_names_fr: localNamesFr,
        local_names_en: localNamesEn,
        local_names_es: localNamesEs,
        local_names_pt: localNamesPt,
        local_names_ar: localNamesAr,
        synonyms,
        field_decisions: fieldDecisions,
        validated_by: profile.id,
        validated_at: new Date().toISOString(),
        candidate_source: candidateSource,
        confidence_score: confidenceScore,
      };

      const assetUpdate: Record<string, unknown> = {
        human_validated: true,
        human_validated_at: new Date().toISOString(),
        human_validated_by: profile.id,
        validated_metadata: validatedMetadata,
        search_aliases: searchAliases,
        updated_at: new Date().toISOString(),
      };

      if (speciesId) assetUpdate.species_id = speciesId;

      const approvedCategory = getApprovedValue('category', null);
      const approvedPackaging = getApprovedValue('packaging', null);
      const approvedDescription = getApprovedValue('description', null);
      const approvedProductType = getApprovedValue('product_type', null);

      if (approvedCategory) assetUpdate.category = approvedCategory;
      if (approvedPackaging) assetUpdate.packaging = approvedPackaging;
      if (approvedDescription) assetUpdate.description = approvedDescription;
      if (approvedProductType) assetUpdate.product_form = approvedProductType;

      const { error } = await supabase.from('assets').update(assetUpdate).eq('id', assetId);
      if (error) criticalErrors.push(`asset_update: ${error.message}`);
      else steps.push('asset_updated_with_aliases');
    } catch (e) {
      criticalErrors.push(`asset_update_exception: ${e}`);
    }
  }

  // ── If any critical step failed, return error WITHOUT advancing ────────────
  if (criticalErrors.length > 0) {
    return NextResponse.json({
      success: false,
      steps,
      errors: criticalErrors,
      critical_failure: true,
      message: `CONFIRM IDENTIFICATION failed: ${criticalErrors.join('; ')}. Asset NOT marked as validated. Please retry.`,
    }, { status: 500 });
  }

  // ── Critical Step 7: Update openai_pilot_job_assets review_status ──────────
  if (batchJobId && publicAssetId) {
    try {
      const { error } = await supabase
        .from('openai_pilot_job_assets')
        .update({
          review_status: 'validated',
          reviewed_at: new Date().toISOString(),
          propagation_status: 'completed',
          propagation_completed_at: new Date().toISOString(),
        })
        .eq('batch_job_id', batchJobId)
        .eq('public_asset_id', publicAssetId);
      if (error) nonCriticalErrors.push(`job_asset_update: ${error.message}`);
      else steps.push('job_asset_updated');
    } catch (e) {
      nonCriticalErrors.push(`job_asset_update_exception: ${e}`);
    }
  }

  // ── Non-critical Step 8: Write species_names ───────────────────────────────
  if (speciesId) {
    const namesToWrite: Array<{ name: string; language_code: string; name_type: string }> = [];

    if (approvedCommonName) {
      namesToWrite.push({ name: approvedCommonName, language_code: 'en', name_type: 'common' });
    }
    if (approvedScientificName) {
      namesToWrite.push({ name: approvedScientificName, language_code: 'la', name_type: 'scientific' });
    }
    localNamesEn.forEach((n) => namesToWrite.push({ name: n, language_code: 'en', name_type: 'local' }));
    localNamesFr.forEach((n) => namesToWrite.push({ name: n, language_code: 'fr', name_type: 'local' }));
    localNamesEs.forEach((n) => namesToWrite.push({ name: n, language_code: 'es', name_type: 'local' }));
    localNamesPt.forEach((n) => namesToWrite.push({ name: n, language_code: 'pt', name_type: 'local' }));
    localNamesAr.forEach((n) => namesToWrite.push({ name: n, language_code: 'ar', name_type: 'local' }));
    commercialNames.forEach((n) => namesToWrite.push({ name: n, language_code: 'en', name_type: 'commercial' }));
    synonyms.forEach((n) => namesToWrite.push({ name: n, language_code: 'la', name_type: 'scientific_synonym' }));

    for (const nameEntry of namesToWrite) {
      if (!nameEntry.name?.trim()) continue;
      try {
        const { data: existing } = await supabase
          .from('species_names')
          .select('id')
          .eq('species_id', speciesId)
          .ilike('name', nameEntry.name.trim())
          .eq('language_code', nameEntry.language_code)
          .maybeSingle();

        if (!existing) {
          await supabase.from('species_names').insert({
            species_id: speciesId,
            name: nameEntry.name.trim(),
            language_code: nameEntry.language_code,
            name_type: nameEntry.name_type,
            status: 'verified',
            source: 'human_validation',
            verified_by: profile.id,
            verified_at: new Date().toISOString(),
          });
        } else {
          await supabase.from('species_names').update({
            status: 'verified',
            source: 'human_validation',
            verified_by: profile.id,
            verified_at: new Date().toISOString(),
          }).eq('id', existing.id);
        }
      } catch { /* non-fatal */ }
    }
    steps.push('species_names_written');
  }

  // ── Non-critical Step 9: Write propagation log ─────────────────────────────
  if (assetId) {
    const propagationTargets = [
      { key: 'assets', table: 'assets' },
      { key: 'asset_species', table: 'asset_species' },
      { key: 'species_center', table: 'species' },
      { key: 'search_index', table: 'assets' },
      { key: 'marketplace', table: 'assets' },
      { key: 'library', table: 'assets' },
    ];

    for (const target of propagationTargets) {
      try {
        const { data: existingLog } = await supabase
          .from('sie_propagation_log')
          .select('id')
          .eq('asset_id', assetId)
          .eq('target_system', target.key)
          .maybeSingle();

        if (!existingLog) {
          await supabase.from('sie_propagation_log').insert({
            job_id: jobId,
            asset_id: assetId,
            target_system: target.key,
            target_table: target.table,
            status: 'completed',
            records_updated: 1,
            propagated_at: new Date().toISOString(),
            propagation_status: 'completed',
            species_id: speciesId ?? null,
          });
        } else {
          await supabase.from('sie_propagation_log')
            .update({ status: 'completed', propagation_status: 'completed', propagated_at: new Date().toISOString() })
            .eq('id', existingLog.id);
        }
      } catch { /* non-fatal */ }
    }
    steps.push('propagation_logged');
  }

  // ── Non-critical Step 10: Update openai_pilot_results propagation_status ───
  if (resultId) {
    try {
      await supabase.from('openai_pilot_results').update({
        propagation_status: 'completed',
        propagation_completed_at: new Date().toISOString(),
      }).eq('id', resultId);
    } catch { /* non-fatal */ }
  }

  // ── Non-critical Step 11: Log validation history ───────────────────────────
  try {
    const fieldEntries = Object.entries(fieldDecisions);
    if (fieldEntries.length > 0) {
      await supabase.from('sie_validation_history').insert(
        fieldEntries.map(([field, decision]) => ({
          job_id: jobId,
          candidate_id: candidateId,
          action: decision.action === 'approve' ? 'approve' :
                  decision.action === 'reject' ? 'reject' :
                  decision.action === 'edit' ? 'edit' : 'unknown',
          field_name: field,
          new_value: decision.action === 'edit' ? (editValues[field] ?? null) : null,
          comment: comment || null,
          previous_status: 'proposals_ready',
          new_status: 'validated',
          reviewer_id: profile.id,
          reviewer_name: profile.display_name ?? profile.email ?? null,
        }))
      );
    } else {
      await supabase.from('sie_validation_history').insert({
        job_id: jobId,
        candidate_id: candidateId,
        action: 'human_validated',
        field_name: 'species',
        new_value: approvedCommonName,
        comment: comment || `Human validated: ${approvedCommonName} (${approvedScientificName ?? 'unknown'})`,
        previous_status: 'proposals_ready',
        new_status: 'validated',
        reviewer_id: profile.id,
        reviewer_name: profile.display_name ?? profile.email ?? null,
      });
    }
    steps.push('history_logged');
  } catch (e) {
    nonCriticalErrors.push(`history_log_exception: ${e}`);
  }

  // ── Final: Update sie_jobs propagation_status ──────────────────────────────
  try {
    await supabase.from('sie_jobs').update({
      propagation_status: nonCriticalErrors.length === 0 ? 'completed' : 'partial',
      propagated_at: new Date().toISOString(),
    }).eq('id', jobId);
  } catch { /* non-fatal */ }

  // ── All critical steps succeeded — return success ──────────────────────────
  return NextResponse.json({
    success: true,
    steps,
    errors: nonCriticalErrors,
    speciesId,
    searchAliasesWritten: assetId ? true : false,
    propagationTargets: ['assets', 'asset_species', 'species_center', 'search_index', 'marketplace', 'library'],
    message: nonCriticalErrors.length === 0
      ? `Identification confirmed and fully propagated: ${approvedCommonName} (${approvedScientificName ?? '—'})`
      : `Identification confirmed: ${approvedCommonName}. ${nonCriticalErrors.length} non-critical warning(s).`,
  });
}
