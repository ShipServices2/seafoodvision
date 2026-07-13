import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// SECURITY PATTERNS — reject any row containing these
// ============================================================
const REJECT_PATTERNS = [
  { pattern: /[A-Za-z]:\\/, label: 'Windows absolute path (C:\\)' },
  { pattern: /\/Users\//, label: 'macOS user path (/Users/)' },
  { pattern: /dropbox/i, label: 'Dropbox path' },
  // GPS: decimal coordinates, DMS notation, or explicit GPS/lat/lon fields
  { pattern: /\b\d{1,3}\.\d{4,}\s*,\s*[-]?\d{1,3}\.\d{4,}\b/, label: 'GPS decimal coordinates' },
  { pattern: /\b(?:lat(?:itude)?|lon(?:gitude)?|gps)[_\s:=]+[-\d.]+/i, label: 'GPS/latitude/longitude field' },
  { pattern: /\bgps\b/i, label: 'GPS keyword' },
  // Email
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'Email address' },
  // Phone (7+ digit sequences with separators)
  { pattern: /(?<!\d)(?:\+?\d[\d\s\-().]{6,}\d)(?!\d)/, label: 'Phone number' },
  // Credentials
  { pattern: /\b(?:secret|api[_-]?key|password|token|private[_-]?key)\b/i, label: 'Secret/credential' },
  // Original file paths
  { pattern: /\/originals?\//i, label: 'Original file path' },
  { pattern: /original[_-]?hd/i, label: 'Original HD reference' },
  // SQLite / database files
  { pattern: /\.sqlite[3]?\b/i, label: 'SQLite file reference' },
  { pattern: /\.db\b/i, label: 'Database file reference' },
];

// MIME types allowed for media uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

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
  // Scan all values
  const allValues = Object.values(row).join(' ');
  const rejection = scanForRejectedPatterns(allValues);
  if (rejection) {
    return { valid: false, reason: `Row ${rowIndex + 1}: Rejected — ${rejection}` };
  }
  // Also scan keys (column names) for sensitive field names
  const allKeys = Object.keys(row).join(' ');
  const keyRejection = scanForRejectedPatterns(allKeys);
  if (keyRejection) {
    return { valid: false, reason: `Row ${rowIndex + 1}: Rejected — sensitive column detected (${keyRejection})` };
  }
  if (!row.title || row.title.trim() === '') {
    return { valid: false, reason: `Row ${rowIndex + 1}: Missing required field 'title'` };
  }
  return { valid: true };
}

// Make a slug unique by appending a suffix if it collides
function makeUniqueSlug(base: string, existingSet: Set<string>): string {
  if (!existingSet.has(base)) return base;
  let i = 2;
  while (existingSet.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// POST /api/admin/import
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
    const duplicatePublicIds: string[] = [];
    const sensitiveDataFound: string[] = [];

    // Fetch existing assets for deduplication — primary key: public_asset_id, secondary: slug
    const { data: existingAssets } = await supabase
      .from('assets')
      .select('slug, public_asset_id');
    const existingSlugSet = new Set((existingAssets || []).map((a: { slug: string }) => a.slug));
    const existingPublicIds = new Set(
      (existingAssets || [])
        .map((a: { public_asset_id: string | null }) => a.public_asset_id)
        .filter(Boolean) as string[]
    );

    // Fetch existing species for deduplication by scientific name
    const { data: existingSpecies } = await supabase
      .from('species')
      .select('id, slug, scientific_name, common_name');
    const existingSpeciesSlugs = new Set((existingSpecies || []).map((s: { slug: string }) => s.slug));
    const existingScientificNames = new Set(
      (existingSpecies || []).map((s: { scientific_name: string }) => s.scientific_name?.toLowerCase())
    );

    // Track public_asset_ids seen in this batch (intra-batch dedup)
    const batchPublicIds = new Set<string>();

    rows.forEach((row, idx) => {
      const validation = validateRow(row, idx);
      if (!validation.valid) {
        rejectedRows.push({ row: idx + 1, reason: validation.reason! });
        // Track if it was a sensitive data rejection
        if (validation.reason?.includes('Rejected —')) {
          const match = validation.reason.match(/Rejected — (.+)$/);
          if (match) sensitiveDataFound.push(`Row ${idx + 1}: ${match[1]}`);
        }
        return;
      }

      // PRIMARY dedup: public_asset_id (required by spec)
      if (row.public_asset_id) {
        const pid = row.public_asset_id.trim();
        if (existingPublicIds.has(pid) || batchPublicIds.has(pid)) {
          duplicatePublicIds.push(pid);
          rejectedRows.push({ row: idx + 1, reason: `Row ${idx + 1}: Duplicate — public_asset_id '${pid}' already exists` });
          return;
        }
        batchPublicIds.add(pid);
      }

      validRows.push(row);

      // Collect new species (dedup by scientific name)
      if (row.species_common_name && row.scientific_name) {
        const sciKey = row.scientific_name.toLowerCase();
        if (!existingScientificNames.has(sciKey)) {
          newSpeciesNames.add(row.species_common_name);
        }
      }

      // Collect categories
      if (row.category) newCategoryNames.add(row.category);

      // Collect keywords
      if (row.keywords) {
        row.keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean).forEach((k: string) => newKeywords.add(k));
      }
    });

    // Estimate total size (rough: ~500KB per asset for thumbnail + preview)
    const estimatedSizeBytes = validRows.length * 500 * 1024;
    const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(1);

    const dryRunReport = {
      totalRows: rows.length,
      validRows: validRows.length,
      rejectedRows: rejectedRows.length,
      rejectionDetails: rejectedRows,
      duplicatesDetected: duplicatePublicIds.length,
      duplicates: duplicatePublicIds,
      sensitiveDataFound,
      newSpecies: Array.from(newSpeciesNames),
      newCategories: Array.from(newCategoryNames),
      newKeywords: Array.from(newKeywords),
      estimatedSizeMB,
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

    // ============================================================
    // STEP 1 — Create import batch (status: pending → processing)
    // ============================================================
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
        notes: batchNotes || 'First real Seafood Vision MVP catalog import.',
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
    let categoriesCreated = 0;

    // ============================================================
    // STEP 2 — Upsert categories
    // ============================================================
    const categoryMap = new Map<string, string>(); // label -> id
    const { data: existingCategories } = await supabase.from('categories').select('id, slug, label');
    (existingCategories || []).forEach((c: { id: string; slug: string; label: string }) => {
      categoryMap.set(c.label.toLowerCase(), c.id);
      categoryMap.set(c.slug, c.id);
    });

    for (const catLabel of Array.from(newCategoryNames)) {
      const catKey = catLabel.toLowerCase();
      if (categoryMap.has(catKey)) continue;
      const catSlug = slugify(catLabel);
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert({ slug: catSlug, label: catLabel, sort_order: 99, is_active: true })
        .select('id, label')
        .single();
      if (catError) {
        // May already exist
        const { data: existing } = await supabase
          .from('categories')
          .select('id, label')
          .eq('slug', catSlug)
          .maybeSingle();
        if (existing) categoryMap.set(catKey, existing.id);
        else importErrors.push(`Category insert failed for "${catLabel}": ${catError.message}`);
      } else if (newCat) {
        categoryMap.set(catKey, newCat.id);
        categoriesCreated++;
      }
    }

    // ============================================================
    // STEP 3 — Upsert species (dedup by scientific name)
    // ============================================================
    const speciesMap = new Map<string, string>(); // scientific_name.lower -> species_id

    (existingSpecies || []).forEach((s: { id: string; scientific_name: string }) => {
      speciesMap.set(s.scientific_name.toLowerCase(), s.id);
    });

    for (const row of validRows) {
      if (!row.species_common_name || !row.scientific_name) continue;
      const sciKey = row.scientific_name.toLowerCase();
      if (speciesMap.has(sciKey)) continue;

      const speciesSlug = slugify(row.scientific_name);
      const uniqueSpeciesSlug = makeUniqueSlug(speciesSlug, existingSpeciesSlugs);
      existingSpeciesSlugs.add(uniqueSpeciesSlug);

      const { data: newSpecies, error: speciesError } = await supabase
        .from('species')
        .insert({
          slug: uniqueSpeciesSlug,
          common_name: row.species_common_name,
          scientific_name: row.scientific_name,
          is_demo: false,
          is_validated: false,
        })
        .select('id, scientific_name')
        .single();

      if (speciesError) {
        // Race condition — try to fetch
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

    // ============================================================
    // STEP 4 — Insert assets with enforced statuses
    // ============================================================
    // Track inserted asset IDs for relations
    const insertedAssets: { id: string; public_asset_id: string | null; scientific_name: string | null; keywords: string }[] = [];

    // Build a working slug set that includes newly inserted slugs
    const workingSlugSet = new Set(existingSlugSet);

    for (const row of validRows) {
      const baseSlug = slugify(row.public_asset_id || row.title);
      const slug = makeUniqueSlug(baseSlug, workingSlugSet);
      workingSlugSet.add(slug);

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
          description: row.description || null,
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
          // ---- ENFORCED STATUSES — never auto-approve ----
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
      insertedAssets.push({
        id: asset.id,
        public_asset_id: row.public_asset_id || null,
        scientific_name: row.scientific_name || null,
        keywords: row.keywords || '',
      });
    }

    // ============================================================
    // STEP 5 — Asset-species relations (asset_species table)
    // ============================================================
    for (const inserted of insertedAssets) {
      if (!inserted.scientific_name) continue;
      const speciesId = speciesMap.get(inserted.scientific_name.toLowerCase());
      if (!speciesId) continue;

      const { error: asSpeciesError } = await supabase
        .from('asset_species')
        .insert({
          asset_id: inserted.id,
          species_id: speciesId,
          is_primary: true,
          confidence_level: 'possible',
        });

      if (asSpeciesError && !asSpeciesError.message.includes('duplicate')) {
        importErrors.push(`asset_species relation failed for asset ${inserted.id}: ${asSpeciesError.message}`);
      }
    }

    // ============================================================
    // STEP 6 — Upsert keywords
    // ============================================================
    const keywordMap = new Map<string, string>(); // term.lower -> keyword_id

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
        if (existing) {
          keywordMap.set(termKey, existing.id);
        } else {
          importErrors.push(`Keyword insert failed for "${term}": ${kwError.message}`);
        }
      } else if (kw) {
        keywordMap.set(termKey, kw.id);
        keywordsCreated++;
      }
    }

    // ============================================================
    // STEP 7 — Asset-keyword relations
    // ============================================================
    for (const inserted of insertedAssets) {
      if (!inserted.keywords) continue;
      const terms = inserted.keywords.split(/[,;|]/).map((k: string) => k.trim()).filter(Boolean);
      for (const term of terms) {
        const kwId = keywordMap.get(term.toLowerCase());
        if (!kwId) continue;
        const { error: akError } = await supabase
          .from('asset_keywords')
          .insert({ asset_id: inserted.id, keyword_id: kwId });
        if (akError && !akError.message.includes('duplicate')) {
          // Non-fatal — log but continue
          importErrors.push(`asset_keywords relation failed for asset ${inserted.id}, keyword "${term}": ${akError.message}`);
        }
      }
    }

    // Steps 8 & 9 (thumbnail/preview uploads) are handled by the separate /upload endpoint
    // called from the frontend after this response.

    // ============================================================
    // STEP 10 — Update batch status and finalize
    // ============================================================
    // Spec: completed | partially_imported | failed
    const finalStatus: 'completed' | 'partially_imported' | 'failed' =
      importedCount === 0
        ? 'failed'
        : importErrors.length > 0
          ? 'partially_imported' :'completed';

    await supabase
      .from('import_batches')
      .update({
        status: finalStatus,
        processed_rows: importedCount,
        rejected_rows: rejectedRows.length + importErrors.length,
        rejection_reasons: [
          ...rejectedRows,
          ...importErrors.map((e, i) => ({ row: -1 - i, reason: e })),
        ],
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
        categoriesCreated,
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
