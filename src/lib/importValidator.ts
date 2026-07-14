// ============================================================
// SHARED IMPORT VALIDATOR — per-cell sensitive data detection
// ============================================================
// This module is used by both:
//   - src/app/admin/imports/page.tsx  (clientValidate)
//   - src/app/api/admin/import/route.ts  (validateRow)
//
// KEY FIX: Each cell is scanned individually.
// The phone-number regex is NEVER applied to a concatenation of
// multiple column values, which previously caused false positives
// such as "3840 2160" (width + height) being flagged as a phone number.
// ============================================================

// Columns whose values are purely numeric and must NEVER be tested
// against the phone-number pattern.
export const NUMERIC_COLUMNS = new Set([
  'width',
  'height',
  'confidence_score',
  'technical_score',
  'commercial_score',
]);

// ============================================================
// SECURITY PATTERNS
// ============================================================
// Each entry has:
//   - pattern   : RegExp to test against a single cell value
//   - label     : human-readable rejection type
//   - skipForNumericColumns : when true, this rule is skipped for
//                             columns listed in NUMERIC_COLUMNS
// ============================================================
export interface RejectPattern {
  pattern: RegExp;
  label: string;
  skipForNumericColumns?: boolean;
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
  // Phone — ONLY applied to non-numeric columns (skipForNumericColumns: true)
  {
    pattern: /(?<!\d)(?:\+?\d[\d\s\-().]{6,}\d)(?!\d)/,
    label: 'Phone number',
    skipForNumericColumns: true,
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
// validateSensitiveValue
// ============================================================
// Scans a single cell value for sensitive data.
//
// @param columnName  - the CSV column name (e.g. "width", "user_notes")
// @param value       - the raw string value of that cell
// @returns SensitiveValueResult
// ============================================================
export function validateSensitiveValue(columnName: string, value: string): SensitiveValueResult {
  const isNumericCol = NUMERIC_COLUMNS.has(columnName.toLowerCase());

  for (const { pattern, label, skipForNumericColumns } of REJECT_PATTERNS) {
    // Skip phone-number check for known numeric columns
    if (skipForNumericColumns && isNumericCol) continue;

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
// Column names are never numeric, so all patterns apply.
//
// @param columnNames  - array of CSV header strings
// @returns { columnName, rejectionType } | null
// ============================================================
export function scanColumnNamesForSensitiveData(
  columnNames: string[]
): { columnName: string; rejectionType: string } | null {
  for (const colName of columnNames) {
    for (const { pattern, label } of REJECT_PATTERNS) {
      if (pattern.test(colName)) {
        return { columnName: colName, rejectionType: label };
      }
    }
  }
  return null;
}
