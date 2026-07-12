// ============================================================
// SEAFOOD VISION — Identification Engine (Phase 6.1)
// Level A: User metadata hints
// Level B: Seafood Vision structured search
// Level C: Visual AI (placeholder — not yet enabled)
// ============================================================

import { createClient } from '@/lib/supabase/server';
import type {
  IdentificationCandidate,
  MatchReason,
  ConfidenceLevel,
} from './types';

interface HintContext {
  categoryHint?: string | null;
  stateHint?: string | null;
  contextHint?: string | null;
  countryHint?: string | null;
  notes?: string | null;
}

interface RawSpeciesRow {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  family: string | null;
  category: string | null;
  description: string | null;
}

interface RawSpeciesNameRow {
  species_id: string;
  name: string;
  language: string | null;
  name_type: string | null;
}

// ============================================================
// LEVEL A — Metadata-only candidates
// ============================================================
async function buildMetadataCandidates(
  hints: HintContext
): Promise<Partial<IdentificationCandidate>[]> {
  const supabase = await createClient();
  const candidates: Partial<IdentificationCandidate>[] = [];

  if (!hints.categoryHint && !hints.stateHint && !hints.notes) {
    return candidates;
  }

  // Search species by category
  if (hints.categoryHint) {
    const { data: speciesRows } = await supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, family, category, description')
      .ilike('category', `%${hints.categoryHint}%`)
      .limit(5);

    if (speciesRows) {
      speciesRows.forEach((sp: RawSpeciesRow, idx: number) => {
        const reasons: MatchReason[] = [
          { code: 'category_match', label: 'Matches the selected category' },
        ];
        if (hints.stateHint) {
          reasons.push({ code: 'state_hint', label: `User indicated ${hints.stateHint}` });
        }
        candidates.push({
          speciesId: sp.id,
          candidateType: 'species',
          rank: idx + 1,
          confidenceLevel: 'limited_evidence' as ConfidenceLevel,
          matchReasons: reasons,
          sourceType: 'metadata_hints',
          species: {
            id: sp.id,
            slug: sp.slug,
            commonName: sp.common_name,
            scientificName: sp.scientific_name,
            family: sp.family,
            category: sp.category,
            description: sp.description,
          },
        });
      });
    }
  }

  return candidates;
}

// ============================================================
// LEVEL B — Seafood Vision structured search
// ============================================================
async function buildStructuredSearchCandidates(
  hints: HintContext
): Promise<Partial<IdentificationCandidate>[]> {
  const supabase = await createClient();
  const candidates: Partial<IdentificationCandidate>[] = [];
  const seenSpeciesIds = new Set<string>();

  // Search by notes text in species names
  if (hints.notes && hints.notes.trim().length > 2) {
    const searchTerm = hints.notes.trim().toLowerCase();

    const { data: nameRows } = await supabase
      .from('species_names')
      .select('species_id, name, language, name_type')
      .ilike('name', `%${searchTerm}%`)
      .limit(10);

    if (nameRows) {
      const speciesIds = [...new Set((nameRows as RawSpeciesNameRow[]).map((r) => r.species_id))];

      if (speciesIds.length > 0) {
        const { data: speciesRows } = await supabase
          .from('species')
          .select('id, slug, common_name, scientific_name, family, category, description')
          .in('id', speciesIds)
          .limit(5);

        if (speciesRows) {
          speciesRows.forEach((sp: RawSpeciesRow, idx: number) => {
            if (!seenSpeciesIds.has(sp.id)) {
              seenSpeciesIds.add(sp.id);
              const matchedNames = (nameRows as RawSpeciesNameRow[])
                .filter((n) => n.species_id === sp.id)
                .map((n) => n.name);

              candidates.push({
                speciesId: sp.id,
                candidateType: 'species',
                rank: idx + 1,
                confidenceLevel: 'possible_candidate' as ConfidenceLevel,
                matchReasons: [
                  {
                    code: 'commercial_name_match',
                    label: 'Matching commercial name',
                    detail: matchedNames.slice(0, 2).join(', '),
                  },
                ],
                sourceType: 'structured_search',
                species: {
                  id: sp.id,
                  slug: sp.slug,
                  commonName: sp.common_name,
                  scientificName: sp.scientific_name,
                  family: sp.family,
                  category: sp.category,
                  description: sp.description,
                },
              });
            }
          });
        }
      }
    }
  }

  // Search by category + state combination
  if (hints.categoryHint) {
    const { data: speciesRows } = await supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, family, category, description')
      .ilike('category', `%${hints.categoryHint}%`)
      .limit(8);

    if (speciesRows) {
      speciesRows.forEach((sp: RawSpeciesRow) => {
        if (!seenSpeciesIds.has(sp.id)) {
          seenSpeciesIds.add(sp.id);
          const reasons: MatchReason[] = [
            { code: 'category_match', label: 'Matches the selected category' },
          ];
          if (hints.stateHint) {
            reasons.push({
              code: 'state_hint',
              label: `User indicated ${hints.stateHint}`,
            });
          }
          if (hints.contextHint) {
            reasons.push({
              code: 'context_hint',
              label: `Photo context: ${hints.contextHint}`,
            });
          }

          candidates.push({
            speciesId: sp.id,
            candidateType: 'species',
            rank: candidates.length + 1,
            confidenceLevel: 'limited_evidence' as ConfidenceLevel,
            matchReasons: reasons,
            sourceType: 'structured_search',
            species: {
              id: sp.id,
              slug: sp.slug,
              commonName: sp.common_name,
              scientificName: sp.scientific_name,
              family: sp.family,
              category: sp.category,
              description: sp.description,
            },
          });
        }
      });
    }
  }

  return candidates;
}

// ============================================================
// LEVEL C — Visual AI (placeholder)
// ============================================================
function buildVisualAIPlaceholder(): { enabled: false; message: string } {
  return {
    enabled: false,
    message: 'Visual AI comparison is not yet enabled.',
  };
}

// ============================================================
// MAIN ENGINE — Run all levels and merge candidates
// ============================================================
export async function runIdentificationEngine(
  requestId: string,
  hints: HintContext
): Promise<{
  candidates: Partial<IdentificationCandidate>[];
  visualAI: { enabled: false; message: string };
  status: 'candidates_ready' | 'insufficient_quality';
}> {
  const [levelA, levelB] = await Promise.all([
    buildMetadataCandidates(hints),
    buildStructuredSearchCandidates(hints),
  ]);

  // Merge and deduplicate by speciesId
  const merged: Partial<IdentificationCandidate>[] = [];
  const seenIds = new Set<string>();

  // Level B takes priority (more specific)
  [...levelB, ...levelA].forEach((c) => {
    const key = c.speciesId || `${c.candidateType}-${c.rank}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      merged.push(c);
    }
  });

  // Re-rank
  merged.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  // Upgrade confidence for top candidates with multiple reasons
  merged.forEach((c) => {
    if (c.matchReasons && c.matchReasons.length >= 2) {
      if (c.confidenceLevel === 'limited_evidence') {
        c.confidenceLevel = 'possible_candidate';
      } else if (c.confidenceLevel === 'possible_candidate') {
        c.confidenceLevel = 'strong_candidate';
      }
    }
  });

  const status = merged.length > 0 ? 'candidates_ready' : 'insufficient_quality';

  return {
    candidates: merged.slice(0, 8),
    visualAI: buildVisualAIPlaceholder(),
    status,
  };
}

// ============================================================
// SAVE CANDIDATES to DB
// ============================================================
export async function saveCandidates(
  requestId: string,
  candidates: Partial<IdentificationCandidate>[]
): Promise<void> {
  const supabase = await createClient();

  // Delete existing candidates for this request
  await supabase
    .from('identification_candidates')
    .delete()
    .eq('request_id', requestId);

  if (candidates.length === 0) return;

  const rows = candidates.map((c) => ({
    request_id: requestId,
    species_id: c.speciesId || null,
    asset_id: c.assetId || null,
    candidate_type: c.candidateType || 'species',
    rank: c.rank || 1,
    confidence_level: c.confidenceLevel || 'limited_evidence',
    confidence_score: c.confidenceScore || null,
    match_reasons: c.matchReasons || [],
    source_type: c.sourceType || 'structured_search',
    model_name: c.modelName || null,
    model_version: c.modelVersion || null,
    status: 'active',
  }));

  await supabase.from('identification_candidates').insert(rows);
}
