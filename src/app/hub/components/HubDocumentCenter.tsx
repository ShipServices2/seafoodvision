'use client';

import React from 'react';
import { FileText, Download, Lock, Coins } from 'lucide-react';
import type { EncDocument } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  documents: EncDocument[];
  hasSubscription: boolean;
  userCredits: number;
  onUseCredits: (feature: string, credits: number) => Promise<boolean>;
}

const DOC_TYPE_COLOR: Record<string, string> = {
  spec_sheet: 'bg-blue-50 text-blue-700',
  catalogue: 'bg-purple-50 text-purple-700',
  brochure: 'bg-amber-50 text-amber-700',
  certificate: 'bg-green-50 text-green-700',
  report: 'bg-red-50 text-red-700',
};

interface DownloadableDoc {
  key: string;
  label: string;
  description: string;
  credits: number;
  feature: string;
  icon: string;
}

const DOWNLOADABLE_DOCS: DownloadableDoc[] = [
  { key: 'spec_sheet', label: 'Technical Spec Sheet', description: 'Complete species technical specifications', credits: 2, feature: 'download_spec_sheet', icon: '📋' },
  { key: 'catalogue', label: 'Product Catalogue', description: 'Full commercial product catalogue', credits: 3, feature: 'download_catalogue', icon: '📚' },
  { key: 'brochure', label: 'Commercial Brochure', description: 'Marketing brochure for commercial use', credits: 3, feature: 'download_brochure', icon: '📄' },
  { key: 'pdf_report', label: 'Full PDF Report', description: 'Complete species intelligence report', credits: 5, feature: 'pdf_full_report', icon: '📊' },
];

export default function HubDocumentCenter({ documents, hasSubscription, userCredits, onUseCredits }: Props) {
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [downloaded, setDownloaded] = React.useState<Set<string>>(new Set());

  const handleDownload = async (doc: DownloadableDoc) => {
    if (!hasSubscription) return;
    setDownloading(doc.key);
    const success = await onUseCredits(doc.feature, doc.credits);
    if (success) {
      setDownloaded((prev) => new Set([...prev, doc.key]));
    }
    setDownloading(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Document Center</h3>
        {documents.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{documents.length} docs</span>
        )}
      </div>

      {/* Linked documents */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Documents</p>
          {documents.map((doc) => (
            <div key={doc.id} className="bg-card rounded-xl border border-border p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.public_title}</p>
                {doc.issuing_body && <p className="text-xs text-muted-foreground">{doc.issuing_body}</p>}
                {doc.issue_date && <p className="text-xs text-muted-foreground">Issued: {doc.issue_date}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.document_types?.label && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_TYPE_COLOR[doc.document_types.label.toLowerCase().replace(' ', '_')] || 'bg-muted text-muted-foreground'}`}>
                    {doc.document_types.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credit-based downloads */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Generate & Download</p>
        <div className="space-y-2">
          {DOWNLOADABLE_DOCS.map((doc) => {
            const isDownloaded = downloaded.has(doc.key);
            const isDownloading = downloading === doc.key;
            const canAfford = userCredits >= doc.credits;

            return (
              <div key={doc.key} className="bg-card rounded-xl border border-border p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{doc.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {!hasSubscription ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock size={11} /> Pro
                    </span>
                  ) : isDownloaded ? (
                    <span className="text-xs text-green-600 font-medium">✓ Downloaded</span>
                  ) : (
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={isDownloading || !canAfford}
                      className="flex items-center gap-1.5 bg-secondary/10 text-secondary text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-secondary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <span>Processing…</span>
                      ) : (
                        <>
                          <Coins size={11} />
                          {doc.credits} credits
                          <Download size={11} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!hasSubscription && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
          <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Document downloads require Professional access</p>
            <p className="text-xs text-muted-foreground">Subscribe to unlock document generation and credit-based downloads.</p>
          </div>
        </div>
      )}
    </div>
  );
}
