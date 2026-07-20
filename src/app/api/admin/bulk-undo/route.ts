import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Shared undo store reference — in production use Redis
// This module-level store is shared with bulk-action/route.ts via a singleton pattern
// For this deployment, we use a global variable
declare global {
  // eslint-disable-next-line no-var
  var __bulkUndoStore: Map<string, {
    assetIds: string[];
    action: string;
    previousStates: Record<string, string>;
    expiresAt: number;
  }> | undefined;
}

if (!global.__bulkUndoStore) {
  global.__bulkUndoStore = new Map();
}

const undoStore = global.__bulkUndoStore;

async function createSupabaseServer() {
  const cookieStore = await cookies();
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
  const supabase = await createSupabaseServer();

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

  const { undoId } = await req.json();
  if (!undoId) return NextResponse.json({ error: 'Missing undoId' }, { status: 400 });

  const entry = undoStore.get(undoId);
  if (!entry) {
    return NextResponse.json({ error: 'Undo entry not found or expired' }, { status: 404 });
  }

  if (entry.expiresAt < Date.now()) {
    undoStore.delete(undoId);
    return NextResponse.json({ error: 'Undo window expired (10 minutes)' }, { status: 410 });
  }

  try {
    // Restore previous states
    for (const assetId of entry.assetIds) {
      const prev = entry.previousStates[assetId];
      if (prev) {
        const prevData = JSON.parse(prev);
        await supabase
          .from('assets')
          .update({ ...prevData, updated_at: new Date().toISOString() })
          .eq('id', assetId);
      }
    }

    undoStore.delete(undoId);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `bulk_undo_${entry.action}`,
      table_name: 'assets',
      record_id: null,
      payload: { asset_count: entry.assetIds.length, undo_id: undoId },
    });

    return NextResponse.json({ success: true, restoredCount: entry.assetIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
