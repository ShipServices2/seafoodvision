// ============================================================
// SEAFOOD VISION — Transactional Validation API
// POST /api/admin/validate-identification
// Uses the shared propagateHumanValidatedIdentification() function.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { propagateHumanValidatedIdentification } from '@/lib/propagation/propagateIdentification';

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

  const result = await propagateHumanValidatedIdentification(supabase, {
    resultId: resultId ?? jobId, // fallback to jobId if no resultId
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
    commercialNames,
    localNamesFr,
    localNamesEn,
    localNamesEs,
    localNamesPt,
    localNamesAr,
    synonyms,
    reviewerId: profile.id,
    reviewerName: profile.display_name ?? profile.email ?? null,
  });

  return NextResponse.json({
    success: result.errors.length === 0,
    steps: result.steps,
    errors: result.errors,
    speciesId: result.speciesId,
    searchAliasesWritten: result.aliasesWritten > 0,
    aliasesWritten: result.aliasesWritten,
    speciesNamesWritten: result.speciesNamesWritten,
    speciesCreated: result.speciesCreated,
    speciesReused: result.speciesReused,
    assetSpeciesWritten: result.assetSpeciesWritten,
    message: result.message,
  });
}
