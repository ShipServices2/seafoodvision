// ============================================================
// SEAFOOD VISION — Identification Engine (Phase 6.1 — OpenAI Vision)
// Level A: User metadata hints (fallback when no image available)
// Level B: Seafood Vision structured search (fallback)
// Level C: OpenAI Vision — GPT-4o (primary, server-side only)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type {
  IdentificationCandidate,
  MatchReason,
  ConfidenceLevel,
} from './types';

// ── Cache version prefix — bump this to invalidate all old cached results ──
const CACHE_VERSION = 'vision-v2';

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

interface OpenAIVisionCandidate {
  common_name: string;
  scientific_name: string;
  confidence: number; // 0-100
  reasons: string[];
  uncertainty_reason?: string;
}

interface OpenAIVisionResponse {
  seafood_detected: boolean;
  category: string | null;
  product_form: string | null;
  visible_features: string[];
  candidate_species: OpenAIVisionCandidate[];
}

// ============================================================
// LEVEL C — OpenAI Vision (GPT-4o)
// ============================================================
async function runOpenAIVision(
  imageBase64: string,
  mimeType: string,
  hints: HintContext
): Promise<{ result: OpenAIVisionResponse; fromCache: false; httpStatus: number } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your-openai-api-key-here' || apiKey.trim() === '') {
    console.warn('[OpenAIVision] OPENAI_API_KEY not configured — skipping vision analysis');
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

  const hintText = [
    hints.categoryHint ? `Category hint: ${hints.categoryHint}` : '',
    hints.stateHint ? `Product state: ${hints.stateHint}` : '',
    hints.contextHint ? `Context: ${hints.contextHint}` : '',
    hints.countryHint ? `Country/origin: ${hints.countryHint}` : '',
    hints.notes ? `User notes: ${hints.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are a professional seafood species identification expert with deep knowledge of marine biology, aquaculture, and seafood processing. You analyze photos of seafood products and identify the most likely species based on visual features.

CRITICAL RULES:
- Only identify species you can actually see evidence of in the image
- Never invent species, origins, FAO zones, or certifications
- If the image does not show seafood, set seafood_detected to false and return empty candidate_species
- Base confidence scores strictly on visible evidence
- Do not default to common species like Atlantic Salmon unless there is clear visual evidence
- Consider all seafood types: fish, shellfish, crustaceans, cephalopods, mollusks, seaweed, processed products

You MUST respond with valid JSON only, no markdown, no explanation outside the JSON.`;

  const userPrompt = `Analyze this seafood image and identify the species.
${hintText ? `\nAdditional context provided by the user:\n${hintText}` : ''}

Respond with this exact JSON structure:
{
  "seafood_detected": true or false,
  "category": "fish" | "shellfish" | "crustacean" | "cephalopod" | "mollusk" | "seaweed" | "processed" | "unknown" | null,
  "product_form": "whole" | "fillet" | "steak" | "frozen" | "smoked" | "canned" | "dried" | "live" | "cooked" | "other" | null,
  "visible_features": ["list of observed visual features like color, texture, shape, fins, shell, etc."],
  "candidate_species": [
    {
      "common_name": "English common name",
      "scientific_name": "Genus species",
      "confidence": 0-100,
      "reasons": ["specific visual reason 1", "specific visual reason 2"],
      "uncertainty_reason": "optional: why confidence is not higher"
    }
  ]
}

Rules:
- Include 1 to 5 candidate_species, ordered by confidence descending
- If seafood_detected is false, candidate_species must be empty []
- confidence must reflect actual visual evidence (not guesses)
- If confidence < 40, add uncertainty_reason
- Do not include species not plausibly visible in the image`;

  console.log(`[OpenAIVision] Calling model=${model} | imageBase64 length=${imageBase64.length} | mimeType=${mimeType}`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    }),
  });

  const httpStatus = response.status;
  console.log(`[OpenAIVision] HTTP status=${httpStatus}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[OpenAIVision] API error ${httpStatus}: ${errText}`);
    throw new Error(`OpenAI Vision API error ${httpStatus}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI Vision returned empty response');

  // Parse JSON — strip markdown code fences if present
  const jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed: OpenAIVisionResponse = JSON.parse(jsonStr);

  // Log raw scientific names returned by OpenAI
  const rawNames = parsed.candidate_species?.map((c) => c.scientific_name).join(', ') ?? '(none)';
  console.log(`[OpenAIVision] seafood_detected=${parsed.seafood_detected} | raw scientific names: ${rawNames}`);

  return { result: parsed, fromCache: false, httpStatus };
}

// ============================================================
// Match OpenAI candidates against the Species table
// ============================================================
async function matchCandidatesWithSpeciesTable(
  candidates: OpenAIVisionCandidate[]
): Promise<Partial<IdentificationCandidate>[]> {
  if (candidates.length === 0) return [];

  const supabase = await createClient();
  const results: Partial<IdentificationCandidate>[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let speciesRow: RawSpeciesRow | null = null;

    // 1. Try exact scientific name match
    if (c.scientific_name) {
      const { data } = await supabase
        .from('species')
        .select('id, slug, common_name, scientific_name, family, category, description')
        .ilike('scientific_name', c.scientific_name.trim())
        .limit(1)
        .maybeSingle();
      speciesRow = data as RawSpeciesRow | null;
    }

    // 2. Try common name match in species table
    if (!speciesRow && c.common_name) {
      const { data } = await supabase
        .from('species')
        .select('id, slug, common_name, scientific_name, family, category, description')
        .ilike('common_name', `%${c.common_name.trim()}%`)
        .limit(1)
        .maybeSingle();
      speciesRow = data as RawSpeciesRow | null;
    }

    // 3. Try species_names table (commercial names, synonyms)
    if (!speciesRow && c.common_name) {
      const { data: nameRows } = await supabase
        .from('species_names')
        .select('species_id')
        .ilike('name', `%${c.common_name.trim()}%`)
        .limit(1);

      if (nameRows && nameRows.length > 0) {
        const { data } = await supabase
          .from('species')
          .select('id, slug, common_name, scientific_name, family, category, description')
          .eq('id', nameRows[0].species_id)
          .maybeSingle();
        speciesRow = data as RawSpeciesRow | null;
      }
    }

    // Build confidence level from score
    const score = c.confidence;
    let confidenceLevel: ConfidenceLevel;
    if (score >= 70) confidenceLevel = 'strong_candidate';
    else if (score >= 45) confidenceLevel = 'possible_candidate';
    else if (score >= 20) confidenceLevel = 'limited_evidence';
    else confidenceLevel = 'insufficient_information';

    const reasons: MatchReason[] = c.reasons.map((r, ri) => ({
      code: `visual_${ri}`,
      label: r,
    }));
    if (c.uncertainty_reason) {
      reasons.push({ code: 'uncertainty', label: c.uncertainty_reason });
    }

    if (speciesRow && !seenIds.has(speciesRow.id)) {
      seenIds.add(speciesRow.id);
      results.push({
        speciesId: speciesRow.id,
        candidateType: 'species',
        rank: i + 1,
        confidenceLevel,
        confidenceScore: score,
        matchReasons: reasons,
        sourceType: 'openai_vision',
        modelName: process.env.OPENAI_MODEL ?? 'gpt-4o',
        modelVersion: '2024-11',
        species: {
          id: speciesRow.id,
          slug: speciesRow.slug,
          commonName: speciesRow.common_name,
          scientificName: speciesRow.scientific_name,
          family: speciesRow.family,
          category: speciesRow.category,
          description: speciesRow.description,
        },
      });
    } else if (!speciesRow) {
      // Species not in DB — include as unlinked candidate with AI name
      results.push({
        speciesId: null,
        candidateType: 'species',
        rank: i + 1,
        confidenceLevel,
        confidenceScore: score,
        matchReasons: reasons,
        sourceType: 'openai_vision',
        modelName: process.env.OPENAI_MODEL ?? 'gpt-4o',
        modelVersion: '2024-11',
        species: {
          id: '',
          slug: '',
          commonName: c.common_name,
          scientificName: c.scientific_name,
          family: null,
          category: null,
          description: null,
        },
      });
    }
  }

  return results;
}

// ============================================================
// LEVEL A — Metadata-only candidates (fallback)
// ============================================================
async function buildMetadataCandidates(
  hints: HintContext
): Promise<Partial<IdentificationCandidate>[]> {
  const supabase = await createClient();
  const candidates: Partial<IdentificationCandidate>[] = [];

  if (!hints.categoryHint && !hints.stateHint && !hints.notes) {
    return candidates;
  }

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
          confidenceScore: null,
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
// LEVEL B — Structured search (fallback)
// ============================================================
async function buildStructuredSearchCandidates(
  hints: HintContext
): Promise<Partial<IdentificationCandidate>[]> {
  const supabase = await createClient();
  const candidates: Partial<IdentificationCandidate>[] = [];
  const seenSpeciesIds = new Set<string>();

  if (hints.notes && hints.notes.trim().length > 2) {
    const searchTerm = hints.notes.trim().toLowerCase();

    const { data: nameRows } = await supabase
      .from('species_names')
      .select('species_id, name, language, name_type')
      .ilike('name', `%${searchTerm}%`)
      .limit(10);

    if (nameRows) {
      const speciesIds = [...new Set(nameRows.map((r: { species_id: string }) => r.species_id))];

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
              const matchedNames = nameRows
                .filter((n: { species_id: string; name: string }) => n.species_id === sp.id)
                .map((n: { name: string }) => n.name);

              candidates.push({
                speciesId: sp.id,
                candidateType: 'species',
                rank: idx + 1,
                confidenceLevel: 'possible_candidate' as ConfidenceLevel,
                confidenceScore: null,
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

  return candidates;
}

// ============================================================
// CREDIT DEBIT — 2 credits for successful non-cached analysis
// ============================================================
async function debitIdentificationCredits(userId: string): Promise<void> {
  try {
    const serviceClient = createServiceClient();

    // Get current balance
    const { data: balanceData } = await serviceClient.rpc('get_user_credit_balance', {
      p_user_id: userId,
    });
    const currentBalance = (balanceData as number) ?? 0;

    await serviceClient.from('credit_ledger').insert({
      user_id: userId,
      movement_type: 'usage',
      amount: -2,
      reason: 'Seafood identification — OpenAI Vision analysis',
      reference: 'identify_openai_vision',
      balance_before: currentBalance,
      balance_after: currentBalance - 2,
    });
  } catch (err) {
    // Non-blocking — log but don't fail the identification
    console.error('[debitIdentificationCredits] Failed to debit credits:', err);
  }
}

// ============================================================
// CREDIT PRE-CHECK — verify balance >= 2 before calling OpenAI
// Returns the current balance, or throws InsufficientCreditsError
// ============================================================
export class InsufficientCreditsError extends Error {
  constructor() {
    super('Crédits insuffisants — 2 crédits sont nécessaires pour cette identification.');
    this.name = 'InsufficientCreditsError';
  }
}

async function checkCreditBalance(userId: string): Promise<number> {
  const serviceClient = createServiceClient();
  const { data: balanceData, error } = await serviceClient.rpc('get_user_credit_balance', {
    p_user_id: userId,
  });
  if (error) {
    console.error('[CreditCheck] RPC error:', error.message);
    // On RPC error, treat as 0 to be safe
    return 0;
  }
  const balance = (balanceData as number) ?? 0;
  console.log(`[CreditCheck] userId=${userId} | balance=${balance}`);
  return balance;
}

// ============================================================
// MAIN ENGINE — Run OpenAI Vision + fallback levels
// ============================================================
export async function runIdentificationEngine(
  requestId: string,
  hints: HintContext,
  userId?: string | null
): Promise<{
  candidates: Partial<IdentificationCandidate>[];
  visualAI: { enabled: boolean; message: string; provider?: string; model?: string };
  status: 'candidates_ready' | 'insufficient_quality';
  fromCache: boolean;
  seafoodDetected: boolean;
}> {
  const supabase = await createClient();

  // Fetch the identification request to get upload_path and checksum
  const { data: reqRow } = await supabase
    .from('identification_requests')
    .select('id, upload_path, checksum')
    .eq('id', requestId)
    .maybeSingle();

  const uploadPath: string | null = reqRow?.upload_path ?? null;
  const existingChecksum: string | null = reqRow?.checksum ?? null;

  console.log(`[Engine] requestId=${requestId} | existingChecksum=${existingChecksum ?? 'none'} | uploadPath=${uploadPath ?? 'none'}`);

  // ── CACHE CHECK ──────────────────────────────────────────
  // Only reuse cache for checksums that start with the current CACHE_VERSION prefix.
  // Old mock-era checksums (without the prefix) are intentionally ignored.
  if (existingChecksum && existingChecksum.startsWith(`${CACHE_VERSION}:`)) {
    console.log(`[Engine] Cache lookup for checksum=${existingChecksum}`);

    const { data: cachedReq } = await supabase
      .from('identification_requests')
      .select('id')
      .eq('checksum', existingChecksum)
      .eq('status', 'candidates_ready')
      .neq('id', requestId)
      .limit(1)
      .maybeSingle();

    if (cachedReq) {
      const { data: cachedCandidates } = await supabase
        .from('identification_candidates')
        .select('*, species:species_id(id, slug, common_name, scientific_name, family, category, description)')
        .eq('request_id', cachedReq.id)
        .order('rank');

      if (cachedCandidates && cachedCandidates.length > 0) {
        const finalNames = cachedCandidates.map((c: Record<string, unknown>) => {
          const sp = c.species as Record<string, unknown> | null;
          return sp?.scientific_name ?? c.species_id ?? 'unknown';
        }).join(', ');

        console.log(`[Engine] fromCache=true | source requestId=${cachedReq.id} | candidates=${finalNames}`);

        const mapped: Partial<IdentificationCandidate>[] = cachedCandidates.map((c: Record<string, unknown>) => ({
          speciesId: c.species_id as string | null,
          candidateType: c.candidate_type as import('./types').CandidateType,
          rank: c.rank as number,
          confidenceLevel: c.confidence_level as ConfidenceLevel,
          confidenceScore: c.confidence_score as number | null,
          matchReasons: c.match_reasons as MatchReason[],
          sourceType: c.source_type as string,
          modelName: c.model_name as string | null,
          modelVersion: c.model_version as string | null,
          species: c.species as Partial<IdentificationCandidate>['species'],
        }));

        return {
          candidates: mapped,
          visualAI: { enabled: true, message: 'Results from cache (same image).', provider: 'openai', model: process.env.OPENAI_MODEL ?? 'gpt-4o' },
          status: 'candidates_ready',
          fromCache: true,
          seafoodDetected: true,
        };
      }
    } else {
      console.log(`[Engine] Cache miss — no prior candidates_ready request for this checksum`);
    }
  } else if (existingChecksum && !existingChecksum.startsWith(`${CACHE_VERSION}:`)) {
    // Old mock-era checksum — invalidate it so a fresh analysis runs
    console.log(`[Engine] Old checksum detected (no vision-v2 prefix) — invalidating: ${existingChecksum}`);
    await supabase
      .from('identification_requests')
      .update({ checksum: null })
      .eq('id', requestId);
  }

  // ── CREDIT PRE-CHECK ─────────────────────────────────────
  // Block OpenAI call immediately if the user has fewer than 2 credits.
  // This prevents the fallback path from running and returning stale results.
  if (userId) {
    const balance = await checkCreditBalance(userId);
    console.log(`[Engine] Credit pre-check | userId=${userId} | balance=${balance}`);
    if (balance < 2) {
      console.warn(`[Engine] Insufficient credits (${balance}) — blocking OpenAI call for userId=${userId}`);
      throw new InsufficientCreditsError();
    }
  }

  // ── OPENAI VISION ─────────────────────────────────────────
  let visionResult: OpenAIVisionResponse | null = null;
  let visionError: string | null = null;
  let openaiHttpStatus: number | null = null;
  let visionSucceeded = false;

  if (uploadPath) {
    try {
      // Download image from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('identification-uploads')
        .download(uploadPath);

      if (downloadError || !fileData) {
        visionError = `Storage download failed: ${downloadError?.message ?? 'unknown'}`;
        console.error(`[Engine] ${visionError}`);
      } else {
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Compute SHA-256 hash with CACHE_VERSION prefix
        const hashBuffer = await crypto.subtle.digest('SHA-256', uint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const rawHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        const versionedChecksum = `${CACHE_VERSION}:${rawHash}`;

        console.log(`[Engine] Computed checksum=${versionedChecksum}`);

        // Store versioned checksum
        await supabase
          .from('identification_requests')
          .update({ checksum: versionedChecksum })
          .eq('id', requestId);

        // Re-check cache with newly computed versioned hash
        const { data: cachedReq2 } = await supabase
          .from('identification_requests')
          .select('id')
          .eq('checksum', versionedChecksum)
          .eq('status', 'candidates_ready')
          .neq('id', requestId)
          .limit(1)
          .maybeSingle();

        if (cachedReq2) {
          const { data: cachedCandidates2 } = await supabase
            .from('identification_candidates')
            .select('*, species:species_id(id, slug, common_name, scientific_name, family, category, description)')
            .eq('request_id', cachedReq2.id)
            .order('rank');

          if (cachedCandidates2 && cachedCandidates2.length > 0) {
            const finalNames2 = cachedCandidates2.map((c: Record<string, unknown>) => {
              const sp = c.species as Record<string, unknown> | null;
              return sp?.scientific_name ?? 'unknown';
            }).join(', ');

            console.log(`[Engine] fromCache=true (post-hash) | source requestId=${cachedReq2.id} | candidates=${finalNames2}`);

            const mapped: Partial<IdentificationCandidate>[] = cachedCandidates2.map((c: Record<string, unknown>) => ({
              speciesId: c.species_id as string | null,
              candidateType: c.candidate_type as import('./types').CandidateType,
              rank: c.rank as number,
              confidenceLevel: c.confidence_level as ConfidenceLevel,
              confidenceScore: c.confidence_score as number | null,
              matchReasons: c.match_reasons as MatchReason[],
              sourceType: c.source_type as string,
              modelName: c.model_name as string | null,
              modelVersion: c.model_version as string | null,
              species: c.species as Partial<IdentificationCandidate>['species'],
            }));

            return {
              candidates: mapped,
              visualAI: { enabled: true, message: 'Results from cache (same image).', provider: 'openai', model: process.env.OPENAI_MODEL ?? 'gpt-4o' },
              status: 'candidates_ready',
              fromCache: true,
              seafoodDetected: true,
            };
          }
        }

        // Determine MIME type from upload path
        const ext = uploadPath.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          heic: 'image/heic',
          heif: 'image/heif',
        };
        const mimeType = mimeMap[ext] ?? 'image/jpeg';

        // Convert to base64 — this is the actual image bytes sent to OpenAI
        const base64 = Buffer.from(uint8).toString('base64');
        console.log(`[Engine] Sending image to OpenAI | mimeType=${mimeType} | base64 bytes=${base64.length}`);

        const visionResponse = await runOpenAIVision(base64, mimeType, hints);
        if (visionResponse) {
          visionResult = visionResponse.result;
          openaiHttpStatus = visionResponse.httpStatus;
          visionSucceeded = true;
        }
      }
    } catch (err) {
      visionError = err instanceof Error ? err.message : 'Vision analysis failed';
      console.error('[Engine] OpenAI Vision error (no credits will be debited):', err);
      // visionSucceeded remains false — credits will NOT be debited
    }
  }

  // ── PROCESS VISION RESULT ─────────────────────────────────
  if (visionResult && visionSucceeded) {
    // No seafood detected — return empty, no credits debited
    if (!visionResult.seafood_detected || visionResult.candidate_species.length === 0) {
      console.log(`[Engine] fromCache=false | OpenAI HTTP=${openaiHttpStatus} | seafood_detected=false | no credits debited`);
      return {
        candidates: [],
        visualAI: {
          enabled: true,
          message: 'No seafood detected in this image.',
          provider: 'openai',
          model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        },
        status: 'insufficient_quality',
        fromCache: false,
        seafoodDetected: false,
      };
    }

    // Match candidates with species table
    const matched = await matchCandidatesWithSpeciesTable(visionResult.candidate_species);
    const top5 = matched.slice(0, 5);

    // Re-rank
    top5.forEach((c, idx) => { c.rank = idx + 1; });

    // Log final candidates
    const finalCandidateNames = top5.map((c) => c.species?.scientificName ?? c.species?.commonName ?? 'unknown').join(', ');
    console.log(`[Engine] fromCache=false | OpenAI HTTP=${openaiHttpStatus} | model=${process.env.OPENAI_MODEL ?? 'gpt-4o'} | finalCandidates=[${finalCandidateNames}]`);

    // Debit 2 credits ONLY after successful OpenAI analysis (not cached, not error)
    if (userId) {
      console.log(`[Engine] Debiting 2 credits for userId=${userId}`);
      await debitIdentificationCredits(userId);
    }

    const featureNote = visionResult.visible_features?.length > 0
      ? `Visible features: ${visionResult.visible_features.slice(0, 4).join(', ')}`
      : 'OpenAI Vision analysis';

    return {
      candidates: top5,
      visualAI: {
        enabled: true,
        message: featureNote,
        provider: 'openai',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      },
      status: top5.length > 0 ? 'candidates_ready' : 'insufficient_quality',
      fromCache: false,
      seafoodDetected: true,
    };
  }

  // ── FALLBACK: metadata + structured search ────────────────
  // Note: credits are NOT debited for fallback path (no OpenAI call succeeded)
  console.log(`[Engine] fromCache=false | OpenAI unavailable/failed | falling back to metadata+search | visionError=${visionError ?? 'none'}`);

  const [levelA, levelB] = await Promise.all([
    buildMetadataCandidates(hints),
    buildStructuredSearchCandidates(hints),
  ]);

  const merged: Partial<IdentificationCandidate>[] = [];
  const seenIds = new Set<string>();

  [...levelB, ...levelA].forEach((c) => {
    const key = c.speciesId || `${c.candidateType}-${c.rank}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      merged.push(c);
    }
  });

  merged.forEach((c, idx) => { c.rank = idx + 1; });

  merged.forEach((c) => {
    if (c.matchReasons && c.matchReasons.length >= 2) {
      if (c.confidenceLevel === 'limited_evidence') {
        c.confidenceLevel = 'possible_candidate';
      } else if (c.confidenceLevel === 'possible_candidate') {
        c.confidenceLevel = 'strong_candidate';
      }
    }
  });

  const fallbackMessage = visionError
    ? `Visual AI unavailable: ${visionError}. Showing metadata-based candidates.`
    : 'No image available. Showing metadata-based candidates only.';

  return {
    candidates: merged.slice(0, 8),
    visualAI: { enabled: false, message: fallbackMessage },
    status: merged.length > 0 ? 'candidates_ready' : 'insufficient_quality',
    fromCache: false,
    seafoodDetected: true,
  };
}

// ============================================================
// SAVE CANDIDATES to DB — always replaces existing candidates for this request
// ============================================================
export async function saveCandidates(
  requestId: string,
  candidates: Partial<IdentificationCandidate>[]
): Promise<void> {
  const supabase = await createClient();

  // Delete ALL existing candidates for this request before inserting new ones.
  // This prevents accumulation of old mock-era or stale candidates.
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
    confidence_score: c.confidenceScore ?? null,
    match_reasons: c.matchReasons || [],
    source_type: c.sourceType || 'openai_vision',
    model_name: c.modelName || null,
    model_version: c.modelVersion || null,
    status: 'active',
  }));

  console.log(`[saveCandidates] Inserting ${rows.length} candidates for requestId=${requestId}`);
  await supabase.from('identification_candidates').insert(rows);
}
