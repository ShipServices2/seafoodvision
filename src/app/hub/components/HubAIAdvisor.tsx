'use client';

import React, { useState } from 'react';
import { Bot, Send, Coins, ChevronDown, ChevronUp, Loader as Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  speciesId: string;
  speciesName: string;
  hasSubscription: boolean;
  userCredits: number;
  userId: string | null;
  onUseCredits: (feature: string, credits: number) => Promise<boolean>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'simple' | 'advanced';
  credits: number;
}

export default function HubAIAdvisor({ speciesId, speciesName, hasSubscription, userCredits, userId, onUseCredits }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const creditCost = mode === 'simple' ? 2 : 5;
  const canAfford = userCredits >= creditCost;

  const handleAsk = async () => {
    if (!input.trim() || loading || !canAfford) return;
    if (!userId) {
      setError('Please sign in to use the AI Advisor.');
      return;
    }

    const question = input.trim();
    setInput('');
    setError(null);
    setLoading(true);

    // Debit credits first
    const credited = await onUseCredits(
      mode === 'simple' ? 'ai_advisor_simple' : 'ai_advisor_advanced',
      creditCost
    );
    if (!credited) {
      setError('Insufficient credits. Please purchase more credits to continue.');
      setLoading(false);
      return;
    }

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
      mode,
      credits: creditCost,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/hub/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speciesId, speciesName, question, mode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'AI Advisor error');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No response received.',
        mode,
        credits: 0,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Save to DB
      const supabase = createClient();
      await supabase.from('hub_ai_conversations').insert({
        user_id: userId,
        species_id: speciesId,
        question,
        answer: data.answer,
        mode,
        credits_used: creditCost,
        status: 'answered',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to get AI response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-secondary" />
          <h3 className="text-sm font-semibold text-foreground">Seafood AI Advisor</h3>
          <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">AI</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <>
          {!hasSubscription ? (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 text-center">
              <Bot size={24} className="text-purple-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">AI Advisor requires Professional access</p>
              <p className="text-xs text-muted-foreground mb-3">Ask any question about {speciesName} — sourcing, regulations, commercial use, and more.</p>
              <a href="/pricing" className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-ocean-800 transition-colors">
                Upgrade to Professional
              </a>
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div className="flex gap-2">
                {(['simple', 'advanced'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      mode === m
                        ? 'bg-secondary text-white border-secondary' :'bg-card text-muted-foreground border-border hover:border-secondary/40'
                    }`}
                  >
                    <Coins size={11} />
                    {m === 'simple' ? 'Simple (2 credits)' : 'Advanced (5 credits)'}
                  </button>
                ))}
              </div>

              {/* Credit balance */}
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <span>Your credits: <span className="font-semibold text-foreground">{userCredits}</span></span>
                <span>This question: <span className={`font-semibold ${canAfford ? 'text-foreground' : 'text-red-500'}`}>{creditCost} credits</span></span>
              </div>

              {/* Messages */}
              {messages.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                        msg.role === 'user' ?'bg-secondary text-white' :'bg-card border border-border text-foreground'
                      }`}>
                        {msg.role === 'user' && (
                          <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <Coins size={10} />
                            <span className="text-xs">{msg.credits} credits used</span>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-secondary" />
                        <span className="text-sm text-muted-foreground">AI is thinking…</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
                  placeholder={`Ask about ${speciesName}…`}
                  disabled={loading || !canAfford}
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50"
                />
                <button
                  onClick={handleAsk}
                  disabled={loading || !input.trim() || !canAfford}
                  className="bg-secondary text-white p-2.5 rounded-xl hover:bg-ocean-800 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>

              {!canAfford && (
                <p className="text-xs text-red-500 text-center">
                  Insufficient credits. <a href="/account/credits" className="underline">Purchase more credits</a>
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center">
                AI responses are informational only. Always verify with official sources for commercial decisions.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
