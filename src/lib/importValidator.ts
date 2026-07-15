// ============================================================
// SHARED IMPORT VALIDATOR — per-cell sensitive data detection
// ============================================================
// This module is used by both:
//   - src/app/admin/imports/page.tsx  (clientValidate)
//   - src/app/api/admin/import/route.ts  (validateRow)
//
// KEY FIX: Each cell is scanned individually.
// The phone-number regex is ONLY applied to columns in
// PHONE_SCANNABLE_COLUMNS — never to technical ID / slug /
// dimension columns such as public_asset_id, width, height, etc.
// ============================================================

// ---------------------------------------------------------------------------
// PHONE_SCANNABLE_COLUMNS
// ---------------------------------------------------------------------------
// The phone-number rule is applied ONLY to columns in this set.
// Technical identifiers, slugs, dimensions, scores, paths, and checksums
// are explicitly excluded to prevent false positives like SV-B100-0006.
//
// Both the client (page.tsx) and the server (route.ts) import and use
// this exact same list — single source of truth.
// ---------------------------------------------------------------------------
export const PHONE_SCANNABLE_COLUMNS = new Set([
  'title',
  'description',
  'notes',
  'user_notes',
  'contact',
  'phone',
  'telephone',
  'company',
  'caption',
  'alt_text',
  'keywords',
  'tags',
  'metadata',
  'comment',
  'comments',
  'message',
  'text',
  'body',
  'content',
  'summary',
  'bio',
  'address',
  'location_name',
]);

// ---------------------------------------------------------------------------
// NUMERIC_COLUMNS (kept for backward compatibility — also excluded from phone)
// ---------------------------------------------------------------------------
export const NUMERIC_COLUMNS = new Set([
  'width',
  'height',
  'confidence_score',
  'technical_score',
  'commercial_score',
]);

// ---------------------------------------------------------------------------
// TECHNICAL_ID_COLUMNS
// ---------------------------------------------------------------------------
// These columns contain structured identifiers and must NEVER be tested
// against the phone-number pattern.
// ---------------------------------------------------------------------------
export const TECHNICAL_ID_COLUMNS = new Set([
  'public_asset_id',
  'id',
  'asset_id',
  'species_id',
  'category_id',
  'batch_id',
  'slug',
  'checksum',
  'thumbnail_path',
  'preview_path',
]);

// ============================================================
// SECURITY PATTERNS
// ============================================================
// Each entry has:
//   - pattern   : RegExp to test against a single cell value
//   - label     : human-readable rejection type
//   - phoneOnly : when true, this rule is ONLY applied to columns
//                 listed in PHONE_SCANNABLE_COLUMNS
// ============================================================
export interface RejectPattern {
  pattern: RegExp;
  label: string;
  phoneOnly?: boolean;
}

export const REJECT_PATTERNS: RejectPattern[] = [
  { pattern: /[A-Za-z]:\\/, label: 'Windows absolute path (C:\\)' },
  { pattern: /\/Users\//, label: 'macOS user path (/Users/)' },
  { pattern: /dropbox/i, label: 'Dropbox path' },
  // GPS: decimal coordinates
  { pattern: /\b\d{1,3}\.\d{4,}\s*,\s*[-]?\d{1,3}\.\d{4,}\b/, label: 'GPS decimal coordinates' },
  // GPS: explicit field names
  { pattern: /\b(?:lat(?:itude)?|lon(?:gitude)?|gps)[_\s:=]+[-\d.]+/i, label: 'GPS/latitude/longitude field' },
  { pattern: /\bgps\b/i, label: 'GPS keyword' },
  // Email
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'Email address' },
  // ---------------------------------------------------------------------------
  // Phone number — phoneOnly: true
  // ---------------------------------------------------------------------------
  // This rule is ONLY applied to columns in PHONE_SCANNABLE_COLUMNS.
  //
  // The regex is strengthened to require genuine phone-number structure:
  //   - An optional country-code prefix (+XXX or 0X) followed by groups of
  //     2–4 digits separated by spaces, dashes, dots, or parentheses.
  //   - Minimum 7 actual digits (after stripping separators).
  //   - Must NOT be a pure technical ID like SV-B100-0006 (letters + dashes
  //     before the digit sequence disqualify it).
  //
  // Accepted (real phones):
  //   +221 77 123 45 67
  //   01 42 86 00 00
  //   (221) 33 800 00 00
  //   +33 1 42 86 00 00
  //
  // Rejected by this rule (technical IDs — never reach this check anyway
  // because their column is not in PHONE_SCANNABLE_COLUMNS):
  //   SV-B100-0006
  //   batch-2026-000100
  //   3840
  //   2160
  //   3840x2160
  // ---------------------------------------------------------------------------
  {
    // Require: optional + or 0, then digit groups separated by spaces/dashes/dots/parens
    // At least 7 digits total, no leading alpha characters (rules out IDs like SV-B100-…)
    pattern: /(?:^|(?<=\s))(?:\+\d{1,3}[\s\-.])?(?:\(?\d{2,4}\)?[\s\-.]){2,}\d{2,4}(?=\s|$)/,
    label: 'Phone number',
    phoneOnly: true,
  },
  // Credentials
  { pattern: /\b(?:secret|api[_-]?key|password|token|private[_-]?key)\b/i, label: 'Secret/credential' },
  // Original file paths
  { pattern: /\/originals?\//i, label: 'Original file path' },
  { pattern: /original[_-]?hd/i, label: 'Original HD reference' },
  // SQLite / database files
  { pattern: /\.sqlite[3]?\b/i, label: 'SQLite file reference' },
  { pattern: /\.db\b/i, label: 'Database file reference' },
];

// ============================================================
// RESULT TYPE
// ============================================================
export interface SensitiveValueResult {
  matched: boolean;
  rejectionType: string | null;
  columnName: string;
  rawValue: string;
}

// ============================================================
// isPhoneScannableColumn
// ============================================================
// Returns true if the phone-number rule should be applied to
// this column. Uses PHONE_SCANNABLE_COLUMNS as the allowlist.
// NUMERIC_COLUMNS and TECHNICAL_ID_COLUMNS are always excluded.
// ============================================================
export function isPhoneScannableColumn(columnName: string): boolean {
  const col = columnName.toLowerCase();
  if (NUMERIC_COLUMNS.has(col)) return false;
  if (TECHNICAL_ID_COLUMNS.has(col)) return false;
  return PHONE_SCANNABLE_COLUMNS.has(col);
}

// ============================================================
// validateSensitiveValue
// ============================================================
// Scans a single cell value for sensitive data.
//
// @param columnName  - the CSV column name (e.g. "width", "user_notes")
// @param value       - the raw string value of that cell
// @returns SensitiveValueResult
// ============================================================
export function validateSensitiveValue(columnName: string, value: string): SensitiveValueResult {
  const col = columnName.toLowerCase();
  const phoneAllowed = isPhoneScannableColumn(col);

  for (const { pattern, label, phoneOnly } of REJECT_PATTERNS) {
    // Phone rule: only run on columns in PHONE_SCANNABLE_COLUMNS
    if (phoneOnly && !phoneAllowed) continue;

    if (pattern.test(value)) {
      return {
        matched: true,
        rejectionType: label,
        columnName,
        rawValue: value,
      };
    }
  }

  return {
    matched: false,
    rejectionType: null,
    columnName,
    rawValue: value,
  };
}

// ============================================================
// scanRowForSensitiveData
// ============================================================
// Scans every cell of a row individually.
// Returns the first match found (or null if the row is clean).
//
// @param row  - key/value map of column → value
// @returns { columnName, rejectionType, rawValue } | null
// ============================================================
export function scanRowForSensitiveData(
  row: Record<string, string>
): { columnName: string; rejectionType: string; rawValue: string } | null {
  for (const [columnName, value] of Object.entries(row)) {
    const result = validateSensitiveValue(columnName, value);
    if (result.matched && result.rejectionType) {
      return {
        columnName,
        rejectionType: result.rejectionType,
        rawValue: value,
      };
    }
  }
  return null;
}

// ============================================================
// scanColumnNamesForSensitiveData
// ============================================================
// Scans the column names themselves (not values) for sensitive patterns.
// Column names are never phone-only, so all non-phoneOnly patterns apply.
//
// @param columnNames  - array of CSV header strings
// @returns { columnName, rejectionType } | null
// ============================================================
export function scanColumnNamesForSensitiveData(
  columnNames: string[]
): { columnName: string; rejectionType: string } | null {
  for (const colName of columnNames) {
    for (const { pattern, label, phoneOnly } of REJECT_PATTERNS) {
      // Skip phone-only rules when scanning column names
      if (phoneOnly) continue;
      if (pattern.test(colName)) {
        return { columnName: colName, rejectionType: label };
      }
    }
  }
  return null;
}
