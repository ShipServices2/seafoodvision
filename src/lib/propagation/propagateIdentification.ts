// ============================================================
// SEAFOOD VISION — Single Reusable Propagation Function
// propagateHumanValidatedIdentification(resultId, reviewerId)
//
// Used by:
//   A. POST /api/admin/validate-identification (CONFIRM IDENTIFICATION)
//   B. POST /api/admin/backfill-propagation (backfill of Batch 02)
//
// Writes:
//   1. openai_pilot_candidates → is_selected, is_validated
//   2. openai_pilot_results → human_validated, propagation_status
//   3. species (dedup by scientific_name)
//   4. asset_species (relation_type = primary)
//   5. assets → species_id, search_aliases, validated_metadata
//   6. species_names (common, scientific, local, commercial, synonyms)
//   7. openai_pilot_job_assets → review_status = validated
//   8. sie_validation_history
//   9. sie_jobs → propagation_status
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface PropagationInput {
  resultId: string;
  jobId: string;
  assetId: string | null;
  publicAssetId: string | null;
  candidateId: string;
  candidateSource: 'sie' | 'openai_pilot';
  batchJobId?: string | null;
  fieldDecisions: Record<string, { action: 'approve' | 'reject' | 'edit' | 'unknown'; value?: string }>;
  editValues: Record<string, string>;
  comment?: string;
  // Candidate data
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
  // Reviewer
  reviewerId: string;
  reviewerName: string | null;
}

export interface PropagationResult {
  status: 'propagated' | 'already_propagated' | 'failed';
  steps: string[];
  errors: string[];
  speciesId: string | null;
  speciesCreated: boolean;
  speciesReused: boolean;
  assetSpeciesWritten: boolean;
  aliasesWritten: number;
  speciesNamesWritten: number;
  message: string;
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

  // Add genus alone from binomial name
  if (scientificName) {
    const parts = scientificName.trim().split(/\s+/);
    if (parts.length >= 1) add(parts[0]);
  }

  // Add individual words from common name (> 3 chars)
  if (commonName) {
    commonName.split(/\s+/).forEach((w) => { if (w.length > 3) add(w); });
  }

  commercialNames.forEach(add);
  localNames.forEach(add);
  synonyms.forEach(add);

  return Array.from(aliases).filter(Boolean);
}

export async function propagateHumanValidatedIdentification(
  supabase: SupabaseClient,
  input: PropagationInput
): Promise<PropagationResult> {
  const {
    resultId,
    jobId,
    assetId,
    publicAssetId,
    candidateId,
    candidateSource,
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
    reviewerId,
    reviewerName,
  } = input;

  const errors: string[] = [];
  const steps: string[] = [];
  let speciesId: string | null = null;
  let speciesCreated = false;
  let speciesReused = false;
  let assetSpeciesWritten = false;
  let aliasesWritten = 0;
  let speciesNamesWritten = 0;

  // ── Helper: get approved value for a field ──────────────────────────────
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

  // ── Check if already fully propagated (idempotency) ────────────────────
  if (resultId) {
    const { data: existingResult } = await supabase
      .from('openai_pilot_results')
      .select('propagation_status, human_validated')
      .eq('id', resultId)
      .maybeSingle();

    if (existingResult?.propagation_status === 'completed' && existingResult?.human_validated === true) {
      // Verify asset_species actually exists
      if (assetId) {
        const { data: existingAS } = await supabase
          .from('asset_species')
          .select('id')
          .eq('asset_id', assetId)
          .eq('relation_type', 'primary')
          .maybeSingle();

        if (existingAS?.id) {
          return {
            status: 'already_propagated',
            steps: ['already_propagated'],
            errors: [],
            speciesId: null,
            speciesCreated: false,
            speciesReused: false,
            assetSpeciesWritten: false,
            aliasesWritten: 0,
            speciesNamesWritten: 0,
            message: `Already propagated: ${approvedCommonName}`,
          };
        }
      }
    }
  }

  // Mark propagation as in-progress
  if (resultId) {
    await supabase
      .from('openai_pilot_results')
      .update({ propagation_status: 'propagating' })
      .eq('id', resultId);
  }

  // ── Step 1: Mark candidate as validated ────────────────────────────────
  try {
    if (candidateSource === 'openai_pilot') {
      const { error } = await supabase
        .from('openai_pilot_candidates')
        .update({ is_selected: true, is_validated: true, status: 'human_validated' })
        .eq('id', candidateId);
      if (error) errors.push(`candidate_update: ${error.message}`);
      else steps.push('candidate_validated');
    } else {
      const { error } = await supabase
        .from('sie_species_candidates')
        .update({ is_selected: true, is_validated: true })
        .eq('id', candidateId);
      if (error) errors.push(`candidate_update: ${error.message}`);
      else steps.push('candidate_validated');
    }
  } catch (e) {
    errors.push(`candidate_update_exception: ${e}`);
  }

  // ── Step 2: Mark openai_pilot_result as human_validated ────────────────
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
      if (error) errors.push(`result_update: ${error.message}`);
      else steps.push('result_validated');
    } catch (e) {
      errors.push(`result_update_exception: ${e}`);
    }
  }

  // ── Step 3: Update sie_jobs status ─────────────────────────────────────
  try {
    const { error } = await supabase
      .from('sie_jobs')
      .update({
        job_status: 'validated',
        review_status: 'validated',
        reviewed_at: new Date().toISOString(),
        validated_at: new Date().toISOString(),
        reviewer_id: reviewerId,
        reviewer_comment: comment || null,
        propagation_status: 'pending',
      })
      .eq('id', jobId);
    if (error) errors.push(`job_update: ${error.message}`);
    else steps.push('job_validated');
  } catch (e) {
    errors.push(`job_update_exception: ${e}`);
  }

  // ── Step 4: Find or create species ─────────────────────────────────────
  // For industrial content (packaging, warehouse, vessel): skip species creation
  const isIndustrialContent = !approvedScientificName && !approvedCommonName?.match(/[a-z]/i);

  if (approvedScientificName && !isIndustrialContent) {
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
        speciesReused = true;
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
          errors.push(`species_create: ${speciesError.message}`);
        } else {
          speciesId = newSpecies?.id ?? null;
          speciesCreated = true;
          steps.push('species_created');
        }
      }
    } catch (e) {
      errors.push(`species_exception: ${e}`);
    }
  } else if (approvedCommonName && !approvedScientificName) {
    // Genus-level or common-name-only validation: try to find by common name
    try {
      const { data: existingByCommon } = await supabase
        .from('species')
        .select('id')
        .ilike('common_name', approvedCommonName)
        .maybeSingle();

      if (existingByCommon?.id) {
        speciesId = existingByCommon.id;
        speciesReused = true;
        steps.push('species_reused_by_common_name');
      }
      // If not found, don't create a false species without scientific name
    } catch (e) {
      errors.push(`species_common_lookup_exception: ${e}`);
    }
  }

  // ── Step 5: Write asset_species row ────────────────────────────────────
  if (assetId && speciesId) {
    try {
      // Remove any existing primary species link for this asset
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
        verified_by: reviewerId,
        verified_at: new Date().toISOString(),
        status: 'validated',
      });
      if (error) errors.push(`asset_species: ${error.message}`);
      else {
        assetSpeciesWritten = true;
        steps.push('asset_species_written');
      }
    } catch (e) {
      errors.push(`asset_species_exception: ${e}`);
    }
  }

  // ── Step 6: Update assets — species_id, search_aliases, validated_metadata ─
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
      aliasesWritten = searchAliases.length;

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
        validated_by: reviewerId,
        validated_at: new Date().toISOString(),
        candidate_source: candidateSource,
        confidence_score: confidenceScore,
      };

      const assetUpdate: Record<string, unknown> = {
        human_validated: true,
        human_validated_at: new Date().toISOString(),
        human_validated_by: reviewerId,
        validated_metadata: validatedMetadata,
        search_aliases: searchAliases,
        updated_at: new Date().toISOString(),
      };

      if (speciesId) assetUpdate.species_id = speciesId;

      // Only propagate approved fields to asset columns
      const approvedCategory = getApprovedValue('category', null);
      const approvedPackaging = getApprovedValue('packaging', null);
      const approvedDescription = getApprovedValue('description', null);
      const approvedProductType = getApprovedValue('product_type', null);

      if (approvedCategory) assetUpdate.category = approvedCategory;
      if (approvedPackaging) assetUpdate.packaging = approvedPackaging;
      if (approvedDescription) assetUpdate.description = approvedDescription;
      if (approvedProductType) assetUpdate.product_form = approvedProductType;

      const { error } = await supabase.from('assets').update(assetUpdate).eq('id', assetId);
      if (error) errors.push(`asset_update: ${error.message}`);
      else steps.push('asset_updated_with_aliases');
    } catch (e) {
      errors.push(`asset_update_exception: ${e}`);
    }
  }

  // ── Step 7: Write species_names ─────────────────────────────────────────
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
          const { error } = await supabase.from('species_names').insert({
            species_id: speciesId,
            name: nameEntry.name.trim(),
            language_code: nameEntry.language_code,
            name_type: nameEntry.name_type,
            status: 'verified',
            source: 'human_validation',
            verified_by: reviewerId,
            verified_at: new Date().toISOString(),
          });
          if (!error) speciesNamesWritten++;
        } else {
          await supabase.from('species_names').update({
            status: 'verified',
            source: 'human_validation',
            verified_by: reviewerId,
            verified_at: new Date().toISOString(),
          }).eq('id', existing.id);
        }
      } catch { /* non-fatal */ }
    }
    steps.push('species_names_written');
  }

  // ── Step 8: Update openai_pilot_job_assets review_status ───────────────
  if (batchJobId && publicAssetId) {
    try {
      const { error } = await supabase
        .from('openai_pilot_job_assets')
        .update({
          review_status: 'validated',
          reviewed_at: new Date().toISOString(),
        })
        .eq('batch_job_id', batchJobId)
        .eq('public_asset_id', publicAssetId);
      if (error) errors.push(`job_asset_update: ${error.message}`);
      else steps.push('job_asset_updated');
    } catch (e) {
      errors.push(`job_asset_update_exception: ${e}`);
    }
  }

  // ── Step 9: Log validation history ─────────────────────────────────────
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
          reviewer_id: reviewerId,
          reviewer_name: reviewerName,
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
        reviewer_id: reviewerId,
        reviewer_name: reviewerName,
      });
    }
    steps.push('history_logged');
  } catch (e) {
    errors.push(`history_log_exception: ${e}`);
  }

  // ── Step 10: Update propagation_status on result and job ───────────────
  const propagationSuccess = errors.length === 0;
  const finalPropagationStatus = propagationSuccess ? 'completed' : 'failed';

  if (resultId) {
    try {
      await supabase.from('openai_pilot_results').update({
        propagation_status: finalPropagationStatus,
        propagation_completed_at: propagationSuccess ? new Date().toISOString() : null,
        propagation_error: propagationSuccess ? null : errors.join('; '),
      }).eq('id', resultId);
      steps.push('propagation_status_updated');
    } catch { /* non-fatal */ }
  }

  try {
    await supabase.from('sie_jobs').update({
      propagation_status: finalPropagationStatus,
      propagated_at: new Date().toISOString(),
    }).eq('id', jobId);
    steps.push('propagation_logged');
  } catch { /* non-fatal */ }

  const status = propagationSuccess ? 'propagated' : 'failed';
  return {
    status,
    steps,
    errors,
    speciesId,
    speciesCreated,
    speciesReused,
    assetSpeciesWritten,
    aliasesWritten,
    speciesNamesWritten,
    message: propagationSuccess
      ? `Propagated: ${approvedCommonName} (${approvedScientificName ?? '—'})`
      : `Failed with ${errors.length} error(s): ${errors.join('; ')}`,
  };
}
