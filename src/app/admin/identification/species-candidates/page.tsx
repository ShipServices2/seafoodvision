'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Microscope, Loader as Loader2, Fish } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS } from '@/lib/identification/types';
import type { ConfidenceLevel } from '@/lib/identification/types';

interface CandidateRow {
  id: string;
  request_id: string;
  candidate_type: string;
  rank: number;
  confidence_level: string;
  source_type: string;
  status: string;
  created_at: string;
  species?: { common_name: string; scientific_name: string } | null;
}

export default function AdminSpeciesCandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('identification_candidates')
      .select('*, species:species_id(common_name, scientific_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setCandidates((data || []) as CandidateRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Species Candidates</span>
        </div>

        <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Microscope size={18} className="text-ocean-600" />
          Species Candidates
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <Fish size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No candidates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Candidates will appear here after identification requests are processed.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Species</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Confidence</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{c.species?.common_name || 'Unknown'}</p>
                        {c.species?.scientific_name && (
                          <p className="text-xs text-muted-foreground italic">{c.species.scientific_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CONFIDENCE_COLORS[c.confidence_level as ConfidenceLevel] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {CONFIDENCE_LABELS[c.confidence_level as ConfidenceLevel] || c.confidence_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell capitalize">{c.source_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">#{c.rank}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Link href={`/identify/${c.request_id}/results`} className="text-primary hover:underline font-mono text-xs">
                        {c.request_id.slice(0, 10)}…
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
