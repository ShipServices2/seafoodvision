'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, XCircle, FileText, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { CsvValidationResult } from '@/lib/supabase/types';
import { ALLOWED_CSV_COLUMNS } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Patterns that must be rejected
const REJECT_PATTERNS = [
  { pattern: /^[A-Za-z]:\\/, label: 'Windows absolute path (C:\\...)' },
  { pattern: /\/Users\//, label: 'macOS user path' },
  { pattern: /dropbox/i, label: 'Dropbox path' },
  { pattern: /\b\d{2,3}\.\d{4,6},\s*\d{2,3}\.\d{4,6}\b/, label: 'GPS coordinates' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'Email address' },
  { pattern: /\+?\d[\d\s\-().]{7,}\d/, label: 'Phone number' },
];

function validateCsvContent(rows: Record<string, string>[]): CsvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rejectedRows = 0;

  if (rows.length === 0) {
    errors.push('CSV file is empty or has no data rows');
    return { valid: false, errors, warnings, preview: [], totalRows: 0, rejectedRows: 0 };
  }

  const headers = Object.keys(rows[0]);

  // Check for unknown columns
  const unknownCols = headers.filter((h) => !ALLOWED_CSV_COLUMNS.includes(h as any));
  if (unknownCols.length > 0) {
    warnings.push(`Unknown columns detected: ${unknownCols.join(', ')} — these will be ignored`);
  }

  // Check required columns
  if (!headers.includes('title')) {
    errors.push('Missing required column: title');
  }

  // Scan each row for rejected patterns
  rows.forEach((row, idx) => {
    const rowStr = Object.values(row).join(' ');
    REJECT_PATTERNS.forEach(({ pattern, label }) => {
      if (pattern.test(rowStr)) {
        errors.push(`Row ${idx + 1}: Contains rejected data (${label})`);
        rejectedRows++;
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    preview: rows.slice(0, 5),
    totalRows: rows.length,
    rejectedRows,
  };
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}

export default function AdminImportsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvValidationResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/imports');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/admin');
    }
  }, [user, profile, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setResult({
        valid: false,
        errors: ['Only CSV files are accepted'],
        warnings: [],
        preview: [],
        totalRows: 0,
        rejectedRows: 0,
      });
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleValidate = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const validation = validateCsvContent(rows);
      setResult(validation);
    } catch {
      setResult({
        valid: false,
        errors: ['Failed to parse CSV file. Ensure it is valid UTF-8 CSV format.'],
        warnings: [],
        preview: [],
        totalRows: 0,
        rejectedRows: 0,
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !user || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to admin
        </Link>

        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Upload size={18} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">CSV Import Validator</h1>
              <p className="text-sm text-muted-foreground">Validate Codex CSV exports before import</p>
            </div>
          </div>

          {/* Security notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Security validation active</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Files are validated client-side. Rejected patterns: Windows paths, Dropbox paths, GPS coordinates, email addresses, phone numbers, and unknown sensitive columns.
                </p>
              </div>
            </div>
          </div>

          {/* File upload */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <label className="block text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
              Select CSV File
            </label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-secondary/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById('csv-input')?.click()}>
              <FileText size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {file ? file.name : 'Click to select a CSV file'}
              </p>
              <p className="text-xs text-muted-foreground">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Only .csv files accepted'}
              </p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {file && (
              <button
                onClick={handleValidate}
                disabled={processing}
                className="btn-primary w-full justify-center mt-4"
              >
                {processing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Validating…
                  </span>
                ) : (
                  'Validate CSV'
                )}
              </button>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {result.valid ? (
                  <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {result.valid ? 'Validation passed' : 'Validation failed'}
                  </p>
                  <p className={`text-xs mt-0.5 ${result.valid ? 'text-green-700' : 'text-red-700'}`}>
                    {result.totalRows} rows · {result.rejectedRows} rejected · {result.errors.length} errors · {result.warnings.length} warnings
                  </p>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                    <XCircle size={14} />
                    Errors ({result.errors.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {result.errors.map((err, i) => (
                      <li key={`err-${i}`} className="text-xs text-red-700 flex items-start gap-2">
                        <span className="text-red-400 shrink-0 mt-0.5">•</span>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Warnings ({result.warnings.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {result.warnings.map((w, i) => (
                      <li key={`warn-${i}`} className="text-xs text-amber-700 flex items-start gap-2">
                        <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview */}
              {result.preview.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3"
                  >
                    <Eye size={14} />
                    Preview (first {result.preview.length} rows)
                    <span className="text-muted-foreground font-normal">{showPreview ? '▲' : '▼'}</span>
                  </button>
                  {showPreview && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            {Object.keys(result.preview[0]).map((col) => (
                              <th key={col} className="text-left px-2 py-1.5 text-muted-foreground font-semibold whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.preview.map((row, i) => (
                            <tr key={`prev-${i}`} className="border-b border-border">
                              {Object.values(row).map((val, j) => (
                                <td key={`cell-${j}`} className="px-2 py-1.5 text-foreground max-w-32 truncate">
                                  {val || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* No auto-insert notice */}
              <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                <strong>Note:</strong> This validator only checks the CSV format and content. No data has been inserted into the database. Actual import requires manual review and confirmation by a super_admin.
              </div>
            </div>
          )}

          {/* Allowed columns reference */}
          <div className="mt-8 bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Allowed CSV Columns</h3>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_CSV_COLUMNS.map((col) => (
                <span key={col} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono-data">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
