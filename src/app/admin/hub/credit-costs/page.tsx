'use client';

import React, { useEffect, useState } from 'react';
import { Coins, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CreditCost {
  id: string;
  feature_key: string;
  feature_label: string;
  credits: number;
  description: string | null;
  is_active: boolean;
}

export default function AdminHubCreditCostsPage() {
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('hub_credit_costs')
      .select('*')
      .order('feature_key')
      .then(({ data, error }) => {
        if (!error && data) setCosts(data as CreditCost[]);
        setLoading(false);
      });
  }, []);

  const handleUpdate = async (id: string, credits: number, isActive: boolean) => {
    setSaving(id);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('hub_credit_costs')
      .update({ credits, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  };

  const handleChange = (id: string, field: 'credits' | 'is_active', value: number | boolean) => {
    setCosts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Coins size={20} className="text-secondary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Hub Credit Costs</h1>
          <p className="text-sm text-muted-foreground">Configure credit costs for each Hub feature. Changes take effect immediately.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {costs.map((cost) => (
          <div key={cost.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-foreground">{cost.feature_label}</h3>
                  <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">{cost.feature_key}</span>
                </div>
                {cost.description && (
                  <p className="text-xs text-muted-foreground">{cost.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={cost.is_active}
                    onChange={(e) => handleChange(cost.id, 'is_active', e.target.checked)}
                    className="rounded"
                  />
                  Active
                </label>
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className="text-amber-500" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={cost.credits}
                    onChange={(e) => handleChange(cost.id, 'credits', parseInt(e.target.value) || 0)}
                    className="w-16 bg-muted border border-border rounded-lg px-2 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
                <button
                  onClick={() => handleUpdate(cost.id, cost.credits, cost.is_active)}
                  disabled={saving === cost.id}
                  className="flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-50"
                >
                  {saving === cost.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : saved === cost.id ? (
                    <CheckCircle size={12} />
                  ) : (
                    <Save size={12} />
                  )}
                  {saved === cost.id ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          <strong>Note:</strong> Credit costs are read from the database at runtime. No code changes are required to update them.
          Changes apply immediately to all users.
        </p>
      </div>
    </div>
  );
}
