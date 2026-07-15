// ============================================================
// SEAFOOD VISION — /api/ai/species (Phase 8)
// Species lookup + knowledge source enrichment
// Enrichment only — NEVER auto-publishes
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/supabase/roleAuth';
import { enrichSpeciesFromKnowledgeSources } from '@/lib/ai/knowledgeSources';

export async function GET(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const enrich = searchParams.get('enrich') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

    if (!q) return NextResponse.json({ error: 'q (query) parameter required' }, { status: 400 });

    const supabase = await createClient();

    // Search internal species catalog
    const { data: species } = await supabase
      .from('species')
      .select('id, slug, common_name, scientific_name, family, category, description')
      .or(`common_name.ilike.%${q}%,scientific_name.ilike.%${q}%,family.ilike.%${q}%`)
      .limit(limit);

    let enrichment = null;
    if (enrich && q.includes(' ')) {
      // Only enrich if query looks like a scientific name (has space)
      enrichment = await enrichSpeciesFromKnowledgeSources(q);
    }

    return NextResponse.json({
      species: species ?? [],
      enrichment,
      note: enrichment
        ? 'Enrichment data from external sources — requires human validation before publication.'
        : null,
    });
  } catch (err) {
    console.error('[/api/ai/species]', err);
    return NextResponse.json({ error: 'Species lookup failed' }, { status: 500 });
  }
}

// Validate a species identification (approve/reject/replace/unknown)
export async function POST(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role || !['administrator', 'super_admin', 'reviewer'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { jobId, action, candidateId, speciesId, comment } = body as {
      jobId: string;
      action: 'approve' | 'reject' | 'replace' | 'mark_unknown';
      candidateId?: string;
      speciesId?: string;
      comment?: string;
    };

    if (!jobId || !action) {
      return NextResponse.json({ error: 'jobId and action required' }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      replace: 'replaced',
      mark_unknown: 'unknown',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    // Get current job status
    const { data: job } = await supabase
      .from('ai_identification_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    // Update job status
    await supabase
      .from('ai_identification_jobs')
      .update({
        status: newStatus,
        reviewer_id: user?.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: comment,
      })
      .eq('id', jobId);

    // Mark selected candidate
    if (candidateId) {
      await supabase
        .from('ai_species_candidates')
        .update({ is_selected: true })
        .eq('id', candidateId);
    }

    // Log validation history
    await supabase.from('ai_validation_history').insert({
      job_id: jobId,
      action,
      reviewer_id: user?.id,
      selected_candidate_id: candidateId ?? null,
      selected_species_id: speciesId ?? null,
      previous_status: job?.status ?? null,
      new_status: newStatus,
      comment: comment ?? null,
    });

    // Log learning feedback
    if (action === 'approve' && candidateId) {
      await supabase.from('ai_learning_feedback').insert({
        job_id: jobId,
        candidate_id: candidateId,
        reviewer_id: user?.id,
        feedback_type: 'correct',
        correct_species_id: speciesId ?? null,
      });
    } else if (action === 'reject') {
      await supabase.from('ai_learning_feedback').insert({
        job_id: jobId,
        reviewer_id: user?.id,
        feedback_type: 'incorrect',
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      newStatus,
      note: 'Validation recorded. Propagation to Metadata Review / Encyclopedia / Search / Marketplace requires explicit publish action.',
    });
  } catch (err) {
    console.error('[/api/ai/species POST]', err);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
