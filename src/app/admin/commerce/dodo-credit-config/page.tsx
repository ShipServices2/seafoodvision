'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface DodoProduct {
  product_id: string;
  name: string | null;
  price: number | null;
  currency: string | null;
}

interface PackMatch {
  pack: {
    credits: number;
    priceEur: number;
    envKey: string;
    label: string;
  };
  matched_product: DodoProduct | null;
  current_env_value: string | null;
  is_placeholder: boolean;
}

interface ConfigData {
  environment: string;
  total_dodo_products: number;
  all_products: DodoProduct[];
  credit_pack_matches: PackMatch[];
  ready_to_apply: boolean;
}

export default function DodoCreditConfigPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [fetchLoading, setFetchLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<ConfigData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; applied?: string[] } | null>(null);
  const [manualIds, setManualIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/dodo-credit-config');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  const fetchConfig = useCallback(async () => {
    setFetchLoading(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await fetch('/api/payments/dodo/auto-configure-credits');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch');
      setData(json);
      const ids: Record<string, string> = {};
      for (const m of json.credit_pack_matches ?? []) {
        ids[m.pack.envKey] = m.matched_product?.product_id ?? m.current_env_value ?? '';
      }
      setManualIds(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchConfig();
  }, [user, fetchConfig]);

  const applyConfig = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/payments/dodo/auto-configure-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: manualIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Apply failed');
      setApplyResult({ success: true, message: json.message, applied: json.applied });
    } catch (e) {
      setApplyResult({ success: false, message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setApplying(false);
    }
  };

  const allFilled = Object.values(manualIds).every((v) => v && v.trim() !== '' && !v.startsWith('YOUR_'));

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/commerce" className="text-gray-400 hover:text-white text-sm">← Commerce</Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-xl font-bold text-white">Dodo Credit Pack Configuration</h1>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Fetches real Product IDs from your Dodo TEST account and maps them to the 4 credit packs.
          Matching is done by price (EUR). You can also enter IDs manually.
          Product IDs are saved durably in Supabase (<code className="text-cyan-400">payment_product_mappings</code>) — no server restart needed.
        </p>

        {/* Refresh */}
        <button
          onClick={fetchConfig}
          disabled={fetchLoading}
          className="mb-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {fetchLoading ? 'Fetching from Dodo...' : '🔄 Fetch from Dodo TEST'}
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            ❌ {error}
          </div>
        )}

        {data && (
          <>
            {/* Status bar */}
            <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-lg flex items-center gap-4 text-sm">
              <span className="text-gray-400">Environment:</span>
              <span className={`font-mono font-bold ${data.environment === 'test' ? 'text-yellow-400' : 'text-green-400'}`}>
                {data.environment.toUpperCase()}
              </span>
              <span className="text-gray-400 ml-4">Products found in Dodo:</span>
              <span className="font-bold text-white">{data.total_dodo_products}</span>
            </div>

            {/* All Dodo products */}
            {data.all_products.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-300 mb-3">All Dodo Products (one-time)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-700 rounded-lg overflow-hidden">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-400">Product ID</th>
                        <th className="px-3 py-2 text-left text-gray-400">Name</th>
                        <th className="px-3 py-2 text-right text-gray-400">Price (cents)</th>
                        <th className="px-3 py-2 text-left text-gray-400">Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.all_products.map((p) => (
                        <tr key={p.product_id} className="border-t border-gray-800 hover:bg-gray-800/50">
                          <td className="px-3 py-2 font-mono text-cyan-400">{p.product_id}</td>
                          <td className="px-3 py-2 text-gray-300">{p.name ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-300">{p.price ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-300">{p.currency ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Credit pack mapping */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Credit Pack Mapping</h2>
              <div className="space-y-3">
                {data.credit_pack_matches.map((m) => {
                  const envKey = m.pack.envKey;
                  const matched = m.matched_product;
                  const currentId = manualIds[envKey] ?? '';
                  const isOk = currentId && !currentId.startsWith('YOUR_') && currentId.trim() !== '';

                  return (
                    <div
                      key={envKey}
                      className={`p-4 rounded-lg border ${isOk ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold ${isOk ? 'text-green-400' : 'text-red-400'}`}>
                              {isOk ? '✅' : '❌'}
                            </span>
                            <span className="font-semibold text-white text-sm">{m.pack.label}</span>
                          </div>
                          <div className="text-xs text-gray-400 font-mono mb-2">{envKey}</div>
                          {matched && (
                            <div className="text-xs text-gray-400 mb-2">
                              Auto-matched: <span className="text-cyan-400 font-mono">{matched.product_id}</span>
                              {matched.name && <span className="ml-2 text-gray-500">({matched.name})</span>}
                            </div>
                          )}
                          {!matched && (
                            <div className="text-xs text-yellow-500 mb-2">
                              ⚠️ No auto-match found for {m.pack.priceEur / 100} EUR — enter ID manually below
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-gray-400 block mb-1">Product ID to use:</label>
                        <input
                          type="text"
                          value={currentId}
                          onChange={(e) => setManualIds((prev) => ({ ...prev, [envKey]: e.target.value }))}
                          placeholder="pdt_xxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Apply button */}
            <div className="flex items-center gap-4">
              <button
                onClick={applyConfig}
                disabled={applying || !allFilled}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-colors"
              >
                {applying ? 'Saving to Supabase...' : '✅ Save Product IDs to Supabase'}
              </button>
              {!allFilled && (
                <span className="text-yellow-400 text-xs">Fill all 4 Product IDs before saving</span>
              )}
            </div>

            {applyResult && (
              <div className={`mt-4 p-4 rounded-lg border text-sm ${applyResult.success ? 'border-green-700 bg-green-900/30 text-green-300' : 'border-red-700 bg-red-900/30 text-red-300'}`}>
                {applyResult.success ? '✅' : '❌'} {applyResult.message}
                {applyResult.applied && (
                  <ul className="mt-2 space-y-1">
                    {applyResult.applied.map((line) => (
                      <li key={line} className="font-mono text-xs text-green-400">{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
