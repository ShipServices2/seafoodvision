'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, ChevronLeft, Shield, Zap } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ENV_SETTINGS = [
  { key: 'AI_ASSISTANT_ENABLED', value: process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED || 'true (default)', desc: 'Enable or disable the assistant globally' },
  { key: 'AI_PROVIDER', value: 'retrieval_only', desc: 'Active provider mode — no external LLM connected' },
  { key: 'AI_DAILY_GUEST_LIMIT', value: '5', desc: 'Max questions per day for unauthenticated users' },
  { key: 'AI_DAILY_MEMBER_LIMIT', value: '50', desc: 'Max questions per day for authenticated members' },
  { key: 'AI_MAX_CONTEXT_ITEMS', value: '20', desc: 'Max entities included in retrieval context' },
  { key: 'AI_MAX_RESPONSE_TOKENS', value: '800', desc: 'Max tokens for LLM response (when enabled)' },
  { key: 'AI_LOG_PROMPTS', value: 'false', desc: 'Whether to log full prompts (privacy-sensitive)' },
];

export default function AdminAssistantSettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router?.replace('/auth?next=/admin/assistant/settings');
    if (!loading && profile && !['administrator', 'super_admin']?.includes(profile?.role)) router?.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">Environment configuration — edit in .env file</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> These settings are configured via environment variables. To change them, update your <code className="bg-amber-100 px-1 rounded">.env</code> file and redeploy.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Current Configuration</h2>
                </div>
              </div>
              <div className="divide-y divide-border">
                {ENV_SETTINGS?.map((s) => (
                  <div key={s?.key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <code className="text-xs font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">{s?.key}</code>
                        <p className="text-xs text-muted-foreground mt-1">{s?.desc}</p>
                      </div>
                      <span className="text-xs font-medium text-foreground bg-muted px-2 py-1 rounded shrink-0">{s?.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">LLM Provider (Optional)</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                To enable AI-assisted responses (Mode B), configure <code className="bg-muted px-1 rounded text-xs">AI_PROVIDER</code> and <code className="bg-muted px-1 rounded text-xs">AI_PROVIDER_API_KEY</code> in your environment. The key must never be prefixed with <code className="bg-muted px-1 rounded text-xs">NEXT_PUBLIC_</code>.
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>• <strong>AI_PROVIDER</strong>=openai | anthropic | gemini | retrieval_only</p>
                <p>• <strong>AI_MODEL</strong>=gpt-4o | claude-3-5-sonnet | gemini-1.5-pro</p>
                <p>• <strong>AI_PROVIDER_API_KEY</strong>=sk-... (server-side only, never exposed)</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
