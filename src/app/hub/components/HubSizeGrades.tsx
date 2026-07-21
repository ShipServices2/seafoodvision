'use client';

import React from 'react';
import { Scale, Lock } from 'lucide-react';
import Link from 'next/link';
import type { EncSpecies } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  species: EncSpecies;
  hasSubscription: boolean;
}

// Standard size grade data derived from species size_info
interface SizeGrade {
  grade: string;
  range: string;
  description: string;
}

function deriveSizeGrades(species: EncSpecies): SizeGrade[] {
  const sizeInfo = species.size_info as Record<string, string | number> | null;
  if (!sizeInfo) return [];

  const grades: SizeGrade[] = [];
  // Map common size_info keys to grade descriptions
  const gradeMap: Record<string, { grade: string; description: string }> = {
    max_length: { grade: 'XL / Jumbo', description: 'Maximum recorded size' },
    common_length: { grade: 'L / Large', description: 'Common commercial size' },
    max_weight: { grade: 'Heavy', description: 'Maximum recorded weight' },
    common_weight: { grade: 'Standard', description: 'Common commercial weight' },
  };

  Object.entries(sizeInfo).forEach(([key, val]) => {
    const mapped = gradeMap[key];
    if (mapped) {
      grades.push({ grade: mapped.grade, range: String(val), description: mapped.description });
    }
  });

  return grades;
}

export default function HubSizeGrades({ species, hasSubscription }: Props) {
  const grades = deriveSizeGrades(species);
  const commercialForms = species.commercial_forms || [];
  const presentations = species.presentations || [];

  const hasData = grades.length > 0 || commercialForms.length > 0 || presentations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Size Grades & Presentations</h3>
      </div>

      {!hasData ? (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Scale size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No size grade data available for this species.</p>
        </div>
      ) : (
        <>
          {grades.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Size Grades</p>
              </div>
              <div className="divide-y divide-border">
                {grades.map((g) => (
                  <div key={g.grade} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{g.grade}</span>
                      <p className="text-xs text-muted-foreground">{g.description}</p>
                    </div>
                    <span className="text-sm font-mono text-foreground bg-muted px-2.5 py-1 rounded-lg">{g.range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(commercialForms.length > 0 || presentations.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {commercialForms.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Commercial Forms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {commercialForms.map((f) => (
                      <span key={f} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {presentations.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Presentations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {presentations.map((p) => (
                      <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasSubscription && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">Detailed size grading tables locked</p>
                <p className="text-xs text-muted-foreground mb-2">Professional subscribers access full size grading tables with international standards (EU, US, Asian markets).</p>
                <Link href="/pricing" className="text-xs text-secondary font-medium hover:underline">Upgrade →</Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
