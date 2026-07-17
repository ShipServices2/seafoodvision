// ============================================================
// SEAFOOD VISION — Backfill Validated Asset Propagation
// POST /api/admin/backfill-propagation
//
// Audits the 33 already-validated assets from the current
// OpenAI batch job and repairs any missing propagation:
//   - asset_species
//   - species (create or reuse)
//   - species_names
//   - assets.search_aliases + validated_metadata
//   - sie_propagation_log
//   - openai_pilot_results.propagation_status
//   - openai_pilot_job_assets.propagation_status
//
// Idempotent: safe to run multiple times.
// Does NOT re-import, reset validations, or modify media.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface PropagationAuditEntry {
  asset_id: string;
  public_asset_id: string;
  result_id: string;
  candidate_id: string | null;
  common_name: string | null;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  biological_order: string | null;
  commercial_names: string[];
  local_names_fr: string[];
  local_names_en: string[];
  local_names_es: string[];
  local_names_pt: string[];
  local_names_ar: string[];
  synonyms: string[];
  confidence_score: number | null;
  has_asset_species: boolean;
  has_species: boolean;
  has_species_names: boolean;
  has_search_aliases: boolean;
  has_validated_metadata: boolean;
  has_propagation_log: boolean;
  species_id: string | null;
  alias_count: number;
  species_name_count: number;
  propagation_state: 'complete' | 'partial' | 'none' | 'error';
  error?: string;
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

  if (!profile || !['administrator', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: 'audit' | 'backfill' = body.mode ?? 'audit';
  const jobId: string | null = body.jobId ?? null;

  // ── 1. Find the canonical batch job ──────────────────────────────────────
  let canonicalJobId = jobId;
  if (!canonicalJobId) {
    // Auto-detect: find the real_ai pilot job with the most validated assets
    const { data: jobs } = await supabase
      .from('sie_jobs')
      .select('id, pilot_job_name, total_assets, provider_mode, is_superseded')
      .not('pilot_job_name', 'is', null)
      .eq('provider_mode', 'real_ai')
      .order('created_at', { ascending: false });

    const activeJobs = (jobs ?? []).filter(
      (j) => j.is_superseded !== true && !j.pilot_job_name?.includes('[superseded]')
    );

    if (activeJobs.length === 0) {
      return NextResponse.json({ error: 'No active real_ai batch job found' }, { status: 404 });
    }

    // Pick the job with the most validated assets
    let bestJobId = activeJobs[0].id;
    let bestValidatedCount = 0;
    for (const job of activeJobs) {
      const { count } = await supabase
        .from('openai_pilot_job_assets')
        .select('*', { count: 'exact', head: true })
        .eq('batch_job_id', job.id)
        .eq('review_status', 'validated');
      if ((count ?? 0) > bestValidatedCount) {
        bestValidatedCount = count ?? 0;
        bestJobId = job.id;
      }
    }
    canonicalJobId = bestJobId;
  }

  // ── 2. Load the job metadata ──────────────────────────────────────────────
  const { data: batchJob } = await supabase
    .from('sie_jobs')
    .select('id, pilot_job_name, total_assets, provider_mode')
    .eq('id', canonicalJobId)
    .single();

  if (!batchJob) {
    return NextResponse.json({ error: `Job not found: ${canonicalJobId}` }, { status: 404 });
  }

  // ── 3. Load all validated assets from this job ────────────────────────────
  const { data: validatedJobAssets, error: jaError } = await supabase
    .from('openai_pilot_job_assets')
    .select('id, asset_id, public_asset_id, result_id, review_status, propagation_status')
    .eq('batch_job_id', canonicalJobId)
    .eq('review_status', 'validated');

  if (jaError) {
    return NextResponse.json({ error: `Failed to load job assets: ${jaError.message}` }, { status: 500 });
  }

  const validatedAssets = validatedJobAssets ?? [];

  if (validatedAssets.length === 0) {
    return NextResponse.json({
      success: true,
      job_id: canonicalJobId,
      job_name: batchJob.pilot_job_name,
      mode,
      message: 'No validated assets found in this job',
      audit: [],
      summary: { total_audited: 0, complete: 0, partial: 0, none: 0, repaired: 0, errors: 0 },
    });
  }

  // ── 4. Audit each validated asset ────────────────────────────────────────
  const auditEntries: PropagationAuditEntry[] = [];

  for (const ja of validatedAssets) {
    if (!ja.asset_id || !ja.result_id) continue;

    const entry: PropagationAuditEntry = {
      asset_id: ja.asset_id,
      public_asset_id: ja.public_asset_id,
      result_id: ja.result_id,
      candidate_id: null,
      common_name: null,
      scientific_name: null,
      family: null,
      genus: null,
      biological_order: null,
      commercial_names: [],
      local_names_fr: [],
      local_names_en: [],
      local_names_es: [],
      local_names_pt: [],
      local_names_ar: [],
      synonyms: [],
      confidence_score: null,
      has_asset_species: false,
      has_species: false,
      has_species_names: false,
      has_search_aliases: false,
      has_validated_metadata: false,
      has_propagation_log: false,
      species_id: null,
      alias_count: 0,
      species_name_count: 0,
      propagation_state: 'none',
    };

    try {
      // Check propagation status via DB function
      const { data: statusData } = await supabase
        .rpc('check_asset_propagation_status', { p_asset_id: ja.asset_id });

      if (statusData) {
        entry.has_asset_species = statusData.has_asset_species ?? false;
        entry.has_species = statusData.has_species ?? false;
        entry.has_species_names = statusData.has_species_names ?? false;
        entry.has_search_aliases = statusData.has_search_aliases ?? false;
        entry.has_validated_metadata = statusData.has_validated_metadata ?? false;
        entry.has_propagation_log = statusData.has_propagation_log ?? false;
        entry.species_id = statusData.species_id ?? null;
        entry.alias_count = statusData.alias_count ?? 0;
        entry.species_name_count = statusData.species_name_count ?? 0;
      }

      // Determine propagation state
      const completedSteps = [
        entry.has_asset_species,
        entry.has_species,
        entry.has_species_names,
        entry.has_search_aliases,
        entry.has_validated_metadata,
      ].filter(Boolean).length;

      if (completedSteps === 5) {
        entry.propagation_state = 'complete';
      } else if (completedSteps > 0) {
        entry.propagation_state = 'partial';
      } else {
        entry.propagation_state = 'none';
      }

      // Load the validated candidate for this result
      const { data: validatedCandidate } = await supabase
        .from('openai_pilot_candidates')
        .select('id, common_name, scientific_name, family, genus, biological_order, confidence_score')
        .eq('result_id', ja.result_id)
        .eq('is_validated', true)
        .order('rank', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Fallback: use rank 1 candidate if none is marked validated
      const { data: rank1Candidate } = !validatedCandidate ? await supabase
        .from('openai_pilot_candidates')
        .select('id, common_name, scientific_name, family, genus, biological_order, confidence_score')
        .eq('result_id', ja.result_id)
        .order('rank', { ascending: true })
        .limit(1)
        .maybeSingle() : { data: null };

      const candidate = validatedCandidate ?? rank1Candidate;
      if (candidate) {
        entry.candidate_id = candidate.id;
        entry.common_name = candidate.common_name;
        entry.scientific_name = candidate.scientific_name;
        entry.family = candidate.family;
        entry.genus = candidate.genus;
        entry.biological_order = candidate.biological_order;
        entry.confidence_score = candidate.confidence_score;
      }

      // Load metadata for the candidate
      if (entry.candidate_id) {
        const { data: meta } = await supabase
          .from('openai_pilot_candidate_metadata')
          .select('commercial_names, local_names_fr, local_names_en, local_names_es, local_names_pt, local_names_ar, synonyms')
          .eq('candidate_id', entry.candidate_id)
          .maybeSingle();

        if (meta) {
          entry.commercial_names = meta.commercial_names ?? [];
          entry.local_names_fr = meta.local_names_fr ?? [];
          entry.local_names_en = meta.local_names_en ?? [];
          entry.local_names_es = meta.local_names_es ?? [];
          entry.local_names_pt = meta.local_names_pt ?? [];
          entry.local_names_ar = meta.local_names_ar ?? [];
          entry.synonyms = meta.synonyms ?? [];
        }
      }
    } catch (err) {
      entry.propagation_state = 'error';
      entry.error = err instanceof Error ? err.message : String(err);
    }

    auditEntries.push(entry);
  }

  // ── 5. If audit mode, return the report without writing ──────────────────
  if (mode === 'audit') {
    const summary = {
      total_audited: auditEntries.length,
      complete: auditEntries.filter((e) => e.propagation_state === 'complete').length,
      partial: auditEntries.filter((e) => e.propagation_state === 'partial').length,
      none: auditEntries.filter((e) => e.propagation_state === 'none').length,
      errors: auditEntries.filter((e) => e.propagation_state === 'error').length,
      repaired: 0,
    };
    return NextResponse.json({
      success: true,
      job_id: canonicalJobId,
      job_name: batchJob.pilot_job_name,
      mode: 'audit',
      summary,
      audit: auditEntries,
    });
  }

  // ── 6. BACKFILL MODE: repair missing propagation ──────────────────────────
  const repairResults: Array<{
    asset_id: string;
    public_asset_id: string;
    before: string;
    after: string;
    steps_completed: string[];
    errors: string[];
    species_id: string | null;
    species_reused: boolean;
    species_created: boolean;
  }> = [];

  let totalSpeciesReused = 0;
  let totalSpeciesCreated = 0;
  let totalAssetSpeciesWritten = 0;
  let totalAliasesCreated = 0;
  let totalIndexesRebuilt = 0;
  let totalRepaired = 0;

  for (const entry of auditEntries) {
    // Skip already-complete assets
    if (entry.propagation_state === 'complete') continue;
    // Skip assets with no candidate data
    if (!entry.common_name) continue;

    const repairEntry = {
      asset_id: entry.asset_id,
      public_asset_id: entry.public_asset_id,
      before: entry.propagation_state,
      after: 'pending',
      steps_completed: [] as string[],
      errors: [] as string[],
      species_id: entry.species_id,
      species_reused: false,
      species_created: false,
    };

    try {
      let speciesId = entry.species_id;

      // ── Step A: Find or create species ────────────────────────────────────
      if (!entry.has_species || !speciesId) {
        if (entry.scientific_name) {
          const normalizedSci = normalizeText(entry.scientific_name);
          const { data: existingSpecies } = await supabase
            .from('species')
            .select('id')
            .ilike('scientific_name', normalizedSci)
            .maybeSingle();

          if (existingSpecies?.id) {
            speciesId = existingSpecies.id;
            repairEntry.species_reused = true;
            totalSpeciesReused++;
            repairEntry.steps_completed.push('species_reused');
          } else {
            const slug = normalizedSci.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const { data: newSpecies, error: speciesError } = await supabase
              .from('species')
              .insert({
                slug: slug || `species-${Date.now()}`,
                common_name: entry.common_name,
                scientific_name: entry.scientific_name,
                family: entry.family ?? null,
                category: null,
                is_validated: true,
                is_demo: false,
              })
              .select('id')
              .single();

            if (speciesError) {
              repairEntry.errors.push(`species_create: ${speciesError.message}`);
            } else {
              speciesId = newSpecies?.id ?? null;
              repairEntry.species_created = true;
              totalSpeciesCreated++;
              repairEntry.steps_completed.push('species_created');
            }
          }
        } else {
          // No scientific name — use common name as slug
          const slug = normalizeText(entry.common_name ?? 'unknown').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const { data: existingByCommon } = await supabase
            .from('species')
            .select('id')
            .ilike('common_name', entry.common_name ?? '')
            .maybeSingle();

          if (existingByCommon?.id) {
            speciesId = existingByCommon.id;
            repairEntry.species_reused = true;
            totalSpeciesReused++;
            repairEntry.steps_completed.push('species_reused_by_common_name');
          } else {
            const { data: newSpecies, error: speciesError } = await supabase
              .from('species')
              .insert({
                slug: slug || `species-${Date.now()}`,
                common_name: entry.common_name,
                scientific_name: entry.scientific_name ?? null,
                family: entry.family ?? null,
                category: null,
                is_validated: true,
                is_demo: false,
              })
              .select('id')
              .single();

            if (speciesError) {
              repairEntry.errors.push(`species_create_no_sci: ${speciesError.message}`);
            } else {
              speciesId = newSpecies?.id ?? null;
              repairEntry.species_created = true;
              totalSpeciesCreated++;
              repairEntry.steps_completed.push('species_created_no_sci');
            }
          }
        }
        repairEntry.species_id = speciesId;
      }

      // ── Step B: Write asset_species (idempotent) ──────────────────────────
      if (!entry.has_asset_species && speciesId) {
        // Remove any existing primary link first
        await supabase
          .from('asset_species')
          .delete()
          .eq('asset_id', entry.asset_id)
          .eq('relation_type', 'primary');

        const { error: asError } = await supabase.from('asset_species').insert({
          asset_id: entry.asset_id,
          species_id: speciesId,
          relation_type: 'primary',
          confidence: entry.confidence_score ?? null,
          source: 'backfill_human_validation',
          verified_by: profile.id,
          verified_at: new Date().toISOString(),
          status: 'validated',
        });

        if (asError) {
          repairEntry.errors.push(`asset_species: ${asError.message}`);
        } else {
          totalAssetSpeciesWritten++;
          repairEntry.steps_completed.push('asset_species_written');
        }
      } else if (entry.has_asset_species && speciesId && !entry.species_id) {
        // asset_species exists but species_id was null — update it
        repairEntry.steps_completed.push('asset_species_already_exists');
      }

      // ── Step C: Write species_names (idempotent) ──────────────────────────
      if (speciesId && (!entry.has_species_names || entry.species_name_count === 0)) {
        const namesToWrite: Array<{ name: string; language_code: string; name_type: string }> = [];

        if (entry.common_name) {
          namesToWrite.push({ name: entry.common_name, language_code: 'en', name_type: 'common' });
        }
        if (entry.scientific_name) {
          namesToWrite.push({ name: entry.scientific_name, language_code: 'la', name_type: 'scientific' });
        }
        entry.local_names_en.forEach((n) => namesToWrite.push({ name: n, language_code: 'en', name_type: 'local' }));
        entry.local_names_fr.forEach((n) => namesToWrite.push({ name: n, language_code: 'fr', name_type: 'local' }));
        entry.local_names_es.forEach((n) => namesToWrite.push({ name: n, language_code: 'es', name_type: 'local' }));
        entry.local_names_pt.forEach((n) => namesToWrite.push({ name: n, language_code: 'pt', name_type: 'local' }));
        entry.local_names_ar.forEach((n) => namesToWrite.push({ name: n, language_code: 'ar', name_type: 'local' }));
        entry.commercial_names.forEach((n) => namesToWrite.push({ name: n, language_code: 'en', name_type: 'commercial' }));
        entry.synonyms.forEach((n) => namesToWrite.push({ name: n, language_code: 'la', name_type: 'scientific_synonym' }));

        let namesWritten = 0;
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
                source: 'backfill_human_validation',
                verified_by: profile.id,
                verified_at: new Date().toISOString(),
              });
              namesWritten++;
              totalAliasesCreated++;
            }
          } catch { /* non-fatal */ }
        }
        if (namesWritten > 0) repairEntry.steps_completed.push(`species_names_written:${namesWritten}`);
      }

      // ── Step D: Update assets.search_aliases + validated_metadata ─────────
      if (!entry.has_search_aliases || !entry.has_validated_metadata) {
        const allLocalNames = [
          ...entry.local_names_fr, ...entry.local_names_en, ...entry.local_names_es,
          ...entry.local_names_pt, ...entry.local_names_ar,
        ];
        const searchAliases = buildSearchAliases(
          entry.common_name ?? '',
          entry.scientific_name,
          entry.family,
          entry.genus,
          entry.commercial_names,
          allLocalNames,
          entry.synonyms
        );

        const assetUpdate: Record<string, unknown> = {
          search_aliases: searchAliases,
          updated_at: new Date().toISOString(),
        };

        if (!entry.has_validated_metadata) {
          assetUpdate.validated_metadata = {
            common_name: entry.common_name,
            scientific_name: entry.scientific_name,
            family: entry.family,
            genus: entry.genus,
            biological_order: entry.biological_order,
            commercial_names: entry.commercial_names,
            local_names_fr: entry.local_names_fr,
            local_names_en: entry.local_names_en,
            local_names_es: entry.local_names_es,
            local_names_pt: entry.local_names_pt,
            local_names_ar: entry.local_names_ar,
            synonyms: entry.synonyms,
            backfilled_by: profile.id,
            backfilled_at: new Date().toISOString(),
            confidence_score: entry.confidence_score,
          };
        }

        if (speciesId) assetUpdate.species_id = speciesId;

        const { error: assetError } = await supabase
          .from('assets')
          .update(assetUpdate)
          .eq('id', entry.asset_id);

        if (assetError) {
          repairEntry.errors.push(`asset_update: ${assetError.message}`);
        } else {
          totalIndexesRebuilt++;
          repairEntry.steps_completed.push(`search_aliases_written:${searchAliases.length}`);
        }
      }

      // ── Step E: Write propagation log (idempotent upsert) ─────────────────
      if (!entry.has_propagation_log) {
        const targets = ['assets', 'asset_species', 'species_center', 'search_index', 'library'];
        for (const target of targets) {
          try {
            // Check if log entry already exists for this asset+target
            const { data: existingLog } = await supabase
              .from('sie_propagation_log')
              .select('id')
              .eq('asset_id', entry.asset_id)
              .eq('target_system', target)
              .maybeSingle();

            if (!existingLog) {
              await supabase.from('sie_propagation_log').insert({
                job_id: canonicalJobId,
                asset_id: entry.asset_id,
                target_system: target,
                target_table: target === 'assets' ? 'assets' :
                              target === 'asset_species' ? 'asset_species' :
                              target === 'species_center' ? 'species' :
                              target === 'search_index' ? 'assets' : 'assets',
                status: 'completed',
                records_updated: 1,
                propagated_at: new Date().toISOString(),
                propagation_status: 'completed',
                backfill_source: 'admin_backfill',
                species_id: speciesId ?? null,
              });
            } else {
              await supabase.from('sie_propagation_log')
                .update({ status: 'completed', propagation_status: 'completed', propagated_at: new Date().toISOString() })
                .eq('id', existingLog.id);
            }
          } catch { /* non-fatal */ }
        }
        repairEntry.steps_completed.push('propagation_log_written');
      }

      // ── Step F: Mark openai_pilot_results propagation_status ──────────────
      await supabase
        .from('openai_pilot_results')
        .update({
          propagation_status: 'completed',
          propagation_completed_at: new Date().toISOString(),
        })
        .eq('id', entry.result_id);

      // ── Step G: Mark openai_pilot_job_assets propagation_status ───────────
      await supabase
        .from('openai_pilot_job_assets')
        .update({
          propagation_status: 'completed',
          propagation_completed_at: new Date().toISOString(),
        })
        .eq('batch_job_id', canonicalJobId)
        .eq('asset_id', entry.asset_id);

      repairEntry.after = repairEntry.errors.length === 0 ? 'complete' : 'partial';
      if (repairEntry.errors.length === 0) totalRepaired++;

    } catch (err) {
      repairEntry.errors.push(`exception: ${err instanceof Error ? err.message : String(err)}`);
      repairEntry.after = 'error';
    }

    repairResults.push(repairEntry);
  }

  // ── 7. Final summary ──────────────────────────────────────────────────────
  const summary = {
    job_id: canonicalJobId,
    job_name: batchJob.pilot_job_name,
    total_audited: auditEntries.length,
    already_complete: auditEntries.filter((e) => e.propagation_state === 'complete').length,
    partial_before: auditEntries.filter((e) => e.propagation_state === 'partial').length,
    none_before: auditEntries.filter((e) => e.propagation_state === 'none').length,
    errors_during_audit: auditEntries.filter((e) => e.propagation_state === 'error').length,
    repaired: totalRepaired,
    species_reused: totalSpeciesReused,
    species_created: totalSpeciesCreated,
    asset_species_written: totalAssetSpeciesWritten,
    aliases_created: totalAliasesCreated,
    indexes_rebuilt: totalIndexesRebuilt,
    repair_errors: repairResults.filter((r) => r.errors.length > 0).map((r) => ({
      asset_id: r.asset_id,
      public_asset_id: r.public_asset_id,
      errors: r.errors,
    })),
  };

  return NextResponse.json({
    success: true,
    mode: 'backfill',
    summary,
    repairs: repairResults,
  });
}
