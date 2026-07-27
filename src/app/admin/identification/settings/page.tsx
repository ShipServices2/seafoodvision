'use client';

import Link from 'next/link';
import { ChevronRight, Settings, AlertCircle } from 'lucide-react';

export default function AdminIdentificationSettingsPage() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Settings</span>
        </div>

        <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Settings size={18} className="text-ocean-600" />
          Identification Settings
        </h1>

        <div className="space-y-5">
          {/* Quotas */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Quotas (Phase 6.1 — read-only)</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Visitor daily limit', value: '1–3 requests/day', note: 'Configurable' },
                { label: 'Member daily limit', value: 'Higher limit', note: 'Configurable' },
                { label: 'Photos per request', value: '1 (up to 3 for members)', note: 'Phase 6.2' },
                { label: 'Max file size', value: '20 MB', note: 'Configurable' },
                { label: 'Human review requests', value: 'Unlimited (Phase 6.1)', note: 'Configurable' },
              ]?.map(({ label, value, note }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="text-right">
                    <span className="text-foreground font-medium">{value}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({note})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retention */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">File retention policy</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Anonymous uploads', value: '7 days auto-delete' },
                { label: 'Member uploads (no consent)', value: '7 days' },
                { label: 'Member uploads (with consent)', value: '90 days' },
                { label: 'Cancelled requests', value: 'Accelerated deletion' },
                { label: 'Catalogue files', value: 'Never deleted by this policy' },
              ]?.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Engine */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Identification engine</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Level A (Metadata hints)', status: 'Active', color: 'text-emerald-600' },
                { label: 'Level B (Structured search)', status: 'Active', color: 'text-emerald-600' },
                { label: 'Level C (Visual AI)', status: 'Not yet enabled', color: 'text-amber-600' },
              ]?.map(({ label, status, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium ${color}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Allowed formats */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Allowed upload formats</h2>
            <div className="flex flex-wrap gap-2">
              {['JPEG', 'PNG', 'WEBP', 'HEIC']?.map((fmt) => (
                <span key={fmt} className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-2.5 py-1 rounded-full">{fmt}</span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Rejected:</span>
              {['PDF', 'SVG', 'ZIP', 'EXE', 'Archives']?.map((fmt) => (
                <span key={fmt} className="bg-red-50 text-red-600 border border-red-200 text-xs font-medium px-2.5 py-1 rounded-full">{fmt}</span>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Settings management UI will be available in Phase 6.2. Current values are configured in the codebase and migration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
