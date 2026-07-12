import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// SECURITY PATTERNS — reject any row containing these
// ============================================================
const REJECT_PATTERNS = [
  { pattern: /[A-Za-z]:\\/, label: 'Windows absolute path' },
  { pattern: /\/Users\//, label: 'macOS user path' },
  { pattern: /dropbox/i, label: 'Dropbox path' },
  { pattern: /\b\d{2,3}\.\d{4,6},\s*\d{2,3}\.\d{4,6}\b/, label: 'GPS coordinates' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'Email address' },
  { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: 'Phone number' },
  { pattern: /secret|api[_-]?key|password|token/i, label: 'Secret/credential' },
  { pattern: /C:\\/, label: 'Windows C: path' },
  { pattern: /\/original[s]?\//i, label: 'Original file path' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function scanForRejectedPatterns(value: string): string | null {
  for (const { pattern, label } of REJECT_PATTERNS) {
    if (pattern.test(value)) return label;
  }
  return null;
}

function validateRow(row: Record<string, string>, rowIndex: number): { valid: boolean; reason?: string } {
  const allValues = Object.values(row).join(' ');
  const rejection = scanForRejectedPatterns(allValues);
  if (rejection) {
    return { valid: false, reason: `Row ${rowIndex + 1}: Rejected — ${rejection}` };
  }
  if (!row.title || row.title.trim() === '') {
    return { valid: false, reason: `Row ${rowIndex + 1}: Missing required field 'title'` };
  }
  return { valid: true };
}

// POST /api/admin/import
// Body: { mode: 'dry_run' | 'import', rows: Record<string, string>[], batchName?: string, batchNotes?: string }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — administrator role required' }, { status: 403 });
    }

    const body = await request.json();
    const { mode, rows, batchName, batchNotes } = body as {
      mode: 'dry_run' | 'import';
      rows: Record<string, string>[];
      batchName?: string;
      batchNotes?: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // ---- VALIDATION PASS ----
    const validRows: Record<string, string>[] = [];
    const rejectedRows: { row: number; reason: string }[] = [];
    const newSpeciesNames = new Set<string>();
    const newCategoryNames = new Set<string>();
    const newKeywords = new Set<string>();
    const duplicateSlugs: string[] = [];

    // Fetch existing slugs for duplicate detection
    const { data: existingSlugs } = await supabase
      .from('assets')
      .select('slug, public_asset_id');
    const existingSlugSet = new Set((existingSlugs || []).map((a: { slug: string }) => a.slug));
    const existingPublicIds = new Set((existingSlugs || []).map((a: { public_asset_id: string | null }) => a.public_asset_id).filter(Boolean));

    // Fetch existing species for duplicate detection
    const { data: existingSpecies } = await supabase
      .from('species')
      .select('slug, scientific_name, common_name');
    const existingSpeciesSlugs = new Set((existingSpecies || []).map((s: { slug: string }) => s.slug));
    const existingScientificNames = new Set((existingSpecies || []).map((s: { scientific_name: string }) => s.scientific_name?.toLowerCase()));

    rows.forEach((row, idx) => {
      const validation = validateRow(row, idx);
      if (!validation.valid) {
        rejectedRows.push({ row: idx + 1, reason: validation.reason! });
        return;
      }

      // Duplicate detection
      const slug = slugify(row.public_asset_id || row.title);
      if (existingSlugSet.has(slug) || existingPublicIds.has(row.public_asset_id)) {
        duplicateSlugs.push(row.public_asset_id || row.title);
        rejectedRows.push({ row: idx + 1, reason: `Row ${idx + 1}: Duplicate — slug or public_asset_id already exists` });
        return;
      }

      validRows.push(row);

      // Collect new species
      if (row.species_common_name && row.scientific_name) {
        const sciSlug = slugify(row.scientific_name);
        if (!existingSpeciesSlugs.has(sciSlug) && !existingScientificNames.has(row.scientific_name.toLowerCase())) {
          newSpeciesNames.add(row.species_common_name);
        }
      }

      // Collect new categories
      if (row.category) newCategoryNames.add(row.category);

      // Collect keywords
      if (row.keywords) {
        row.keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean).forEach((k: string) => newKeywords.add(k));
      }
    });

    const dryRunReport = {
      totalRows: rows.length,
      validRows: validRows.length,
      rejectedRows: rejectedRows.length,
      rejectionDetails: rejectedRows,
      duplicatesDetected: duplicateSlugs.length,
      duplicates: duplicateSlugs,
      newSpecies: Array.from(newSpeciesNames),
      newCategories: Array.from(newCategoryNames),
      newKeywords: Array.from(newKeywords),
      preview: validRows.slice(0, 5),
    };

    // ---- DRY RUN MODE — return report without inserting ----
    if (mode === 'dry_run') {
      return NextResponse.json({ mode: 'dry_run', report: dryRunReport });
    }

    // ---- IMPORT MODE ----
    if (validRows.length === 0) {
      return NextResponse.json({
        mode: 'import',
        error: 'No valid rows to import after validation',
        report: dryRunReport,
      }, { status: 422 });
    }

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        created_by: user.id,
        source_name: batchName || 'Codex Pilot 100',
        total_rows: rows.length,
        processed_rows: 0,
        rejected_rows: rejectedRows.length,
        status: 'processing',
        rejection_reasons: rejectedRows,
        notes: batchNotes || 'First controlled pilot import — Phase 4.3',
      })
      .select()
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Failed to create import batch', detail: batchError?.message }, { status: 500 });
    }

    const importErrors: string[] = [];
    let importedCount = 0;
    let speciesCreated = 0;
    let keywordsCreated = 0;

    // ---- UPSERT SPECIES ----
    const speciesMap = new Map<string, string>(); // scientific_name -> species_id

    // Load existing species into map
    (existingSpecies || []).forEach((s: { id: string; scientific_name: string }) => {
      speciesMap.set(s.scientific_name.toLowerCase(), s.id);
    });

    for (const row of validRows) {
      if (!row.species_common_name || !row.scientific_name) continue;
      const sciKey = row.scientific_name.toLowerCase();
      if (speciesMap.has(sciKey)) continue;

      const speciesSlug = slugify(row.scientific_name);
      const { data: newSpecies, error: speciesError } = await supabase
        .from('species')
        .insert({
          slug: speciesSlug,
          common_name: row.species_common_name,
          scientific_name: row.scientific_name,
          is_demo: false,
          is_validated: false,
        })
        .select('id, scientific_name')
        .single();

      if (speciesError) {
        // May already exist due to race — try to fetch
        const { data: existing } = await supabase
          .from('species')
          .select('id, scientific_name')
          .eq('scientific_name', row.scientific_name)
          .maybeSingle();
        if (existing) {
          speciesMap.set(sciKey, existing.id);
        } else {
          importErrors.push(`Species insert failed for "${row.scientific_name}": ${speciesError.message}`);
        }
      } else if (newSpecies) {
        speciesMap.set(sciKey, newSpecies.id);
        speciesCreated++;
      }
    }

    // ---- UPSERT KEYWORDS ----
    const keywordMap = new Map<string, string>(); // term -> keyword_id

    const { data: existingKeywords } = await supabase.from('keywords').select('id, term');
    (existingKeywords || []).forEach((k: { id: string; term: string }) => {
      keywordMap.set(k.term.toLowerCase(), k.id);
    });

    const allKeywordTerms = Array.from(newKeywords);
    for (const term of allKeywordTerms) {
      const termKey = term.toLowerCase();
      if (keywordMap.has(termKey)) continue;

      const { data: kw, error: kwError } = await supabase
        .from('keywords')
        .insert({ term })
        .select('id, term')
        .single();

      if (kwError) {
        const { data: existing } = await supabase
          .from('keywords')
          .select('id, term')
          .eq('term', term)
          .maybeSingle();
        if (existing) keywordMap.set(termKey, existing.id);
      } else if (kw) {
        keywordMap.set(termKey, kw.id);
        keywordsCreated++;
      }
    }

    // ---- INSERT ASSETS ----
    for (const row of validRows) {
      const slug = slugify(row.public_asset_id || row.title);
      const speciesId = row.scientific_name
        ? speciesMap.get(row.scientific_name.toLowerCase()) || null
        : null;

      const mediaType = (['photo', 'video', 'document', 'illustration'].includes(row.media_type))
        ? row.media_type
        : 'photo';

      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert({
          public_asset_id: row.public_asset_id || null,
          slug,
          title: row.title,
          media_type: mediaType,
          category: row.category || null,
          species_id: speciesId,
          product_form: row.product_form || null,
          product_state: row.fresh_or_frozen || null,
          freezing_method: row.freezing_method || null,
          packaging: row.packaging || null,
          orientation: row.orientation || null,
          width_px: row.width ? parseInt(row.width, 10) || null : null,
          height_px: row.height ? parseInt(row.height, 10) || null : null,
          // Forced statuses — never auto-approve
          is_demo: false,
          review_status: 'under_review',
          publication_status: 'preview_only',
          rights_info: 'review_required',
          commercial_use: false,
          editorial_use: false,
          is_real_photo: true,
          is_verified: false,
        })
        .select('id')
        .single();

      if (assetError || !asset) {
        importErrors.push(`Asset insert failed for "${row.title}": ${assetError?.message}`);
        continue;
      }

      importedCount++;

      // Link keywords
      if (row.keywords) {
        const terms = row.keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean);
        for (const term of terms) {
          const kwId = keywordMap.get(term.toLowerCase());
          if (kwId) {
            await supabase
              .from('asset_keywords')
              .insert({ asset_id: asset.id, keyword_id: kwId })
              .then(() => {});
          }
        }
      }
    }

    // ---- UPDATE BATCH STATUS ----
    const finalStatus = importErrors.length === 0
      ? 'completed'
      : importedCount > 0 ? 'partial' : 'failed';

    await supabase
      .from('import_batches')
      .update({
        status: finalStatus,
        processed_rows: importedCount,
        rejected_rows: rejectedRows.length + importErrors.length,
        rejection_reasons: [...rejectedRows, ...importErrors.map((e, i) => ({ row: i, reason: e }))],
        completed_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    return NextResponse.json({
      mode: 'import',
      batchId: batch.id,
      report: {
        ...dryRunReport,
        importedCount,
        speciesCreated,
        keywordsCreated,
        importErrors,
        finalStatus,
      },
    });
  } catch (err) {
    console.error('Import API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
