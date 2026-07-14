import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// In-memory undo store (per-process, 10-minute TTL)
// For production scale, use Redis; this works for the current deployment
const undoStore = new Map<string, { assetIds: string[]; action: string; previousStates: Record<string, string>; expiresAt: number }>();

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role as string;
  if (!['reviewer', 'administrator', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { action, assetIds, payload } = body as {
    action: string;
    assetIds: string[];
    payload?: Record<string, unknown>;
  };

  if (!action || !Array.isArray(assetIds) || assetIds.length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Delete requires super_admin
  if (action === 'delete' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Delete requires super_admin role' }, { status: 403 });
  }

  const startTime = Date.now();

  try {
    // Fetch previous states for undo
    const { data: previousAssets, error: fetchError } = await supabase
      .from('assets')
      .select('id, review_status, publication_status, species_id, category, product_form, packaging, commercial_use')
      .in('id', assetIds);

    if (fetchError) throw new Error(fetchError.message);

    const previousStates: Record<string, string> = {};
    for (const a of previousAssets || []) {
      previousStates[a.id] = JSON.stringify({
        review_status: a.review_status,
        publication_status: a.publication_status,
        species_id: a.species_id,
        category: a.category,
        product_form: a.product_form,
        packaging: a.packaging,
        commercial_use: a.commercial_use,
      });
    }

    let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let historyAction = action;
    let errors: string[] = [];
    let successCount = 0;

    if (action === 'approve') {
      updateData.review_status = 'approved';
    } else if (action === 'reject') {
      updateData.review_status = 'rejected';
    } else if (action === 'promote') {
      updateData.review_status = payload?.status as string || 'approved';
      historyAction = `promote_to_${updateData.review_status}`;
    } else if (action === 'under_review') {
      updateData.review_status = 'under_review';
    } else if (action === 'preview_only') {
      updateData.review_status = 'preview_only';
    } else if (action === 'commercial_ready') {
      updateData.review_status = 'commercial';
      updateData.commercial_use = true;
    } else if (action === 'archive') {
      updateData.review_status = 'archived';
      updateData.publication_status = 'archived';
    } else if (action === 'change_species') {
      updateData.species_id = payload?.species_id as string || null;
    } else if (action === 'change_category') {
      updateData.category = payload?.category as string || null;
    } else if (action === 'change_product_form') {
      updateData.product_form = payload?.product_form as string || null;
    } else if (action === 'change_packaging') {
      updateData.packaging = payload?.packaging as string || null;
    } else if (action === 'delete') {
      // Delete handled separately
      const { error: delError } = await supabase
        .from('assets')
        .delete()
        .in('id', assetIds);
      if (delError) throw new Error(delError.message);
      successCount = assetIds.length;
    } else if (action === 'add_keywords') {
      // Keywords handled separately
      const keywords = (payload?.keywords as string[]) || [];
      for (const kw of keywords) {
        // Upsert keyword
        const { data: kwData } = await supabase
          .from('keywords')
          .upsert({ term: kw }, { onConflict: 'term' })
          .select('id')
          .maybeSingle();
        if (kwData?.id) {
          for (const assetId of assetIds) {
            await supabase
              .from('asset_keywords')
              .upsert({ asset_id: assetId, keyword_id: kwData.id }, { onConflict: 'asset_id,keyword_id' });
          }
        }
      }
      successCount = assetIds.length;
    } else if (action === 'remove_keywords') {
      const keywords = (payload?.keywords as string[]) || [];
      for (const kw of keywords) {
        const { data: kwData } = await supabase
          .from('keywords')
          .select('id')
          .eq('term', kw)
          .maybeSingle();
        if (kwData?.id) {
          await supabase
            .from('asset_keywords')
            .delete()
            .in('asset_id', assetIds)
            .eq('keyword_id', kwData.id);
        }
      }
      successCount = assetIds.length;
    } else if (action === 'assign_collection') {
      const collectionId = payload?.collection_id as string;
      if (collectionId) {
        for (const assetId of assetIds) {
          await supabase
            .from('collection_items')
            .upsert({ collection_id: collectionId, asset_id: assetId }, { onConflict: 'collection_id,asset_id' });
        }
      }
      successCount = assetIds.length;
    } else if (action === 'export') {
      // Export is handled client-side; just log it
      successCount = assetIds.length;
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Apply bulk update for status/field changes
    if (!['delete', 'add_keywords', 'remove_keywords', 'assign_collection', 'export'].includes(action)) {
      const { error: updateError } = await supabase
        .from('assets')
        .update(updateData)
        .in('id', assetIds);

      if (updateError) throw new Error(updateError.message);

      // Record status history for status-changing actions
      const statusActions = ['approve', 'reject', 'promote', 'under_review', 'preview_only', 'commercial_ready', 'archive'];
      if (statusActions.includes(action)) {
        const newStatus = updateData.review_status as string;
        const historyRows = assetIds.map((assetId) => ({
          asset_id: assetId,
          changed_by: user.id,
          old_status: JSON.parse(previousStates[assetId] || '{}').review_status || null,
          new_status: newStatus,
          reason: `Bulk action: ${action}`,
        }));
        await supabase.from('asset_status_history').insert(historyRows);
      }

      successCount = assetIds.length;
    }

    const duration = Date.now() - startTime;

    // Store undo data (10 min TTL)
    const undoId = `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    undoStore.set(undoId, {
      assetIds,
      action,
      previousStates,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean expired undo entries
    for (const [key, val] of undoStore.entries()) {
      if (val.expiresAt < Date.now()) undoStore.delete(key);
    }

    // Log bulk operation to audit_logs
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `bulk_${historyAction}`,
      table_name: 'assets',
      record_id: null,
      payload: {
        asset_count: assetIds.length,
        success_count: successCount,
        error_count: errors.length,
        duration_ms: duration,
        undo_id: undoId,
        payload,
      },
    });

    return NextResponse.json({
      success: true,
      successCount,
      errorCount: errors.length,
      errors,
      duration,
      undoId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
