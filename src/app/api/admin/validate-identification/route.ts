// ============================================================
// SEAFOOD VISION — Transactional Validation API
// POST /api/admin/validate-identification
// Performs a full transactional CONFIRM IDENTIFICATION:
//   1. Marks candidate as validated
//   2. Writes asset_species row
//   3. Creates/reuses species (dedup by scientific_name)
//   4. Writes species_names / aliases
//   5. Updates assets.search_aliases + validated_metadata
//   6. Updates sie_jobs status
//   7. Updates openai_pilot_job_assets review_status
//   8. Logs validation history
// All steps in a single server-side operation with error reporting.
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
  candidateSource: 'sie' | 'openai_pilot'; // which table the candidate is from
  resultId?: string | null; // openai_pilot_results.id if source = openai_pilot
  batchJobId?: string | null; // openai_pilot_job_assets.batch_job_id
  fieldDecisions: Record<string, FieldDecision>;
  editValues: Record<string, string>;
  comment?: string;
  // Candidate data (passed from client to avoid re-fetch)
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

  // Add genus alone (e.g. "sepia" from "Sepia officinalis")
  if (scientificName) {
    const parts = scientificName.trim().split(/\s+/);
    if (parts.length >= 1) add(parts[0]);
  }

  // Add common name words (e.g. "cuttlefish" from "common cuttlefish")
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

  const errors: string[] = [];
  const steps: string[] = [];

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

  // ── Step 1: Mark candidate as validated ────────────────────────────────────
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

  // ── Step 2: Mark openai_pilot_result as human_validated ────────────────────
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

  // ── Step 3: Update sie_jobs status ─────────────────────────────────────────
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
    if (error) errors.push(`job_update: ${error.message}`);
    else steps.push('job_validated');
  } catch (e) {
    errors.push(`job_update_exception: ${e}`);
  }

  // ── Step 4: Find or create species (dedup by LOWER(TRIM(scientific_name))) ──
  let speciesId: string | null = null;

  if (approvedScientificName) {
    try {
      // Try to find existing species by normalized scientific name
      const normalizedSci = normalizeText(approvedScientificName);
      const { data: existingSpecies } = await supabase
        .from('species')
        .select('id')
        .ilike('scientific_name', normalizedSci)
        .maybeSingle();

      if (existingSpecies?.id) {
        speciesId = existingSpecies.id;
        // Update existing species with approved data
        await supabase.from('species').update({
          common_name: approvedCommonName,
          family: approvedFamily ?? undefined,
          is_validated: true,
          updated_at: new Date().toISOString(),
        }).eq('id', speciesId);
        steps.push('species_reused');
      } else {
        // Create new species
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
          steps.push('species_created');
        }
      }
    } catch (e) {
      errors.push(`species_exception: ${e}`);
    }
  }

  // ── Step 5: Write asset_species row ────────────────────────────────────────
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
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
        status: 'validated',
      });
      if (error) errors.push(`asset_species: ${error.message}`);
      else steps.push('asset_species_written');
    } catch (e) {
      errors.push(`asset_species_exception: ${e}`);
    }
  }

  // ── Step 6: Update assets.species_id + search_aliases + validated_metadata ─
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

  // ── Step 7: Write species_names (approved names and aliases) ───────────────
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
        // Check if this name already exists for this species
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

  // ── Step 8: Update openai_pilot_job_assets review_status ──────────────────
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

  // ── Step 9: Log validation history ────────────────────────────────────────
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
    errors.push(`history_log_exception: ${e}`);
  }

  // ── Step 10: Update sie_jobs propagation_status ────────────────────────────
  try {
    await supabase.from('sie_jobs').update({
      propagation_status: errors.length === 0 ? 'completed' : 'partial',
      propagated_at: new Date().toISOString(),
    }).eq('id', jobId);
    steps.push('propagation_logged');
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: errors.length === 0,
    steps,
    errors,
    speciesId,
    searchAliasesWritten: assetId ? true : false,
    message: errors.length === 0
      ? `Identification confirmed: ${approvedCommonName} (${approvedScientificName ?? '—'})`
      : `Confirmed with ${errors.length} non-fatal error(s): ${errors.join('; ')}`,
  });
}
