'use client';

import React from 'react';
import { Award, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle } from 'lucide-react';
import type { EncCertification } from '@/lib/supabase/encyclopediaQueries';

interface Props {
  certifications: EncCertification[];
  possibleCertifications: string[] | null;
}

const CERT_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  document_received: { label: 'Document Received', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  under_verification: { label: 'Under Verification', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  claimed: { label: 'Claimed', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertCircle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
};

const CERT_TYPE_COLOR: Record<string, string> = {
  sustainability: 'bg-green-50 text-green-700',
  quality: 'bg-blue-50 text-blue-700',
  organic: 'bg-emerald-50 text-emerald-700',
  traceability: 'bg-purple-50 text-purple-700',
  safety: 'bg-red-50 text-red-700',
};

export default function HubCertifications({ certifications, possibleCertifications }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award size={16} className="text-secondary" />
        <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
        {certifications.length > 0 && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{certifications.length} verified</span>
        )}
      </div>

      {certifications.length === 0 && (!possibleCertifications || possibleCertifications.length === 0) ? (
        <div className="text-center py-8 bg-card rounded-xl border border-border">
          <Award size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No certifications documented for this species.</p>
        </div>
      ) : (
        <>
          {certifications.length > 0 && (
            <div className="space-y-3">
              {certifications.map((cert) => {
                const statusInfo = CERT_STATUS[cert.status] || CERT_STATUS.claimed;
                const StatusIcon = statusInfo.icon;
                return (
                  <div key={cert.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-foreground">{cert.name}</h4>
                        {cert.issuing_body && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cert.issuing_body}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                          <StatusIcon size={10} />
                          {statusInfo.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CERT_TYPE_COLOR[cert.certification_type] || 'bg-muted text-muted-foreground'}`}>
                          {cert.certification_type}
                        </span>
                      </div>
                    </div>
                    {cert.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{cert.description}</p>
                    )}
                    {cert.verification_required && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={10} /> Verification required for commercial use
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {possibleCertifications && possibleCertifications.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Potentially Applicable Certifications</p>
              <div className="flex flex-wrap gap-1.5">
                {possibleCertifications.map((c) => (
                  <span key={c} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">{c}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">These certifications may be applicable but require independent verification.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
