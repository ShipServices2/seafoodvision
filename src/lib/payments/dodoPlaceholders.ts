// Server-side detection of unset or placeholder Dodo Product ID values.
// Kept under src/lib so no Dodo Product ID pattern lives in a frontend (src/app) file.

const PLACEHOLDER_PATTERNS = [
  /^YOUR_DODO/i,
  /^pdt_xxx/i,
  /^placeholder/i,
  /^YOUR_/i,
  /^REPLACE/i,
];

export function isPlaceholderDodoValue(value: string | undefined | null): boolean {
  if (!value || value.trim() === '') return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}
