'use client';

import React, { useState, useEffect } from 'react';
import { Clock, User, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface BulkLogEntry {
  id: string;
  actor_id: string;
  action: string;
  created_at: string;
  payload: {
    asset_count?: number;
    success_count?: number;
    error_count?: number;
    duration_ms?: number;
    undo_id?: string;
  } | null;
  profiles?: {
    display_name: string | null;
    email: string | null;
  } | null;
}

interface BulkHistoryLogProps {
  onClose: () => void;
}

function formatAction(action: string): string {
  return action
    .replace('bulk_', '')
    .replace('bulk_undo_', 'UNDO: ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BulkHistoryLog({ onClose }: BulkHistoryLogProps) {
  const [logs, setLogs] = useState<BulkLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bulk-history?limit=${pageSize}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(page * pageSize);
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Bulk Operations History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{total} operations logged</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(page * pageSize)}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No bulk operations recorded yet
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assets</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isUndo = log.action.includes('undo');
                  const hasErrors = (log.payload?.error_count ?? 0) > 0;
                  return (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock size={11} />
                          {new Date(log.created_at).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <User size={11} className="text-muted-foreground" />
                          {log.profiles?.display_name || log.profiles?.email || log.actor_id?.slice(0, 8) || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isUndo ? 'bg-amber-100 text-amber-700' : 'bg-secondary/10 text-secondary'
                        }`}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-mono text-foreground">
                        {log.payload?.asset_count ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                        {formatDuration(log.payload?.duration_ms)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {hasErrors ? (
                          <div className="flex items-center justify-center gap-1 text-red-600">
                            <XCircle size={13} />
                            <span className="text-xs">{log.payload?.error_count} err</span>
                          </div>
                        ) : (
                          <CheckCircle2 size={13} className="text-green-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
