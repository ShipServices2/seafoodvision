'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, Sparkles, BookOpen, Fish, Package, Globe, FileText, ThumbsUp, ThumbsDown, Copy, Bookmark, RefreshCw, ChevronRight, AlertTriangle, Info, CheckCircle, Clock, X, Plus, History, Star, HelpCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import type { AssistantStructuredContent, AssistantRelatedEntity, AssistantSource } from '@/lib/assistant/types';
import Icon from '@/components/ui/AppIcon';


// ---- Suggestion chips ----
const INITIAL_SUGGESTIONS = [
  { label: 'Explore a species', query: 'What is Octopus vulgaris?', icon: Fish },
  { label: 'Find a seafood product', query: 'Show frozen sardine products', icon: BookOpen },
  { label: 'Search real seafood photos', query: 'Find photos of frozen whole octopus', icon: Globe },
  { label: 'Compare product forms', query: 'Compare IQF and block frozen', icon: RefreshCw },
  { label: 'Explore packaging', query: 'What packaging is associated with shrimp?', icon: Package },
  { label: 'Find public documents', query: 'Show public technical sheets related to tuna', icon: FileText },
];

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  high: { label: 'High confidence', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  moderate: { label: 'Moderate confidence', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  limited: { label: 'Limited verified information', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: AlertTriangle },
  none: { label: 'No verified data', color: 'text-red-700 bg-red-50 border-red-200', icon: X },
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  species: Fish,
  product: BookOpen,
  packaging: Package,
  market: Globe,
  certification: CheckCircle,
  document: FileText,
  media: Star,
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_content?: AssistantStructuredContent;
  created_at: string;
}

function ConfidenceBadge({ level }: { level: string }) {
  const cfg = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.limited;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function SourceList({ sources }: { sources: AssistantSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Sources used</p>
      <div className="flex flex-col gap-1">
        {sources.slice(0, 6).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-4 shrink-0">[{i + 1}]</span>
            {s.source_url ? (
              <Link href={s.source_url} className="text-xs text-primary hover:underline truncate">
                {s.source_title}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground truncate">{s.source_title}</span>
            )}
            <span className="text-xs text-muted-foreground/60 shrink-0 capitalize">{s.source_type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityCard({ entity }: { entity: AssistantRelatedEntity }) {
  const Icon = ENTITY_ICON[entity.type] || BookOpen;
  return (
    <Link
      href={entity.href || '#'}
      className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-150 group"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon size={14} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{entity.title}</p>
        {entity.subtitle && <p className="text-xs text-muted-foreground truncate italic">{entity.subtitle}</p>}
        <p className="text-xs text-muted-foreground/60 capitalize mt-0.5">{entity.type}</p>
      </div>
      <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </Link>
  );
}

function AssistantResponseCard({
  msg,
  onFeedback,
  onSave,
  onCopy,
}: {
  msg: ChatMessage;
  onFeedback: (messageId: string, type: string) => void;
  onSave: (messageId: string) => void;
  onCopy: (text: string) => void;
}) {
  const sc = msg.structured_content;
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleFeedback = (type: string) => {
    setFeedbackGiven(type);
    onFeedback(msg.id, type);
  };

  const handleSave = () => {
    setSaved(true);
    onSave(msg.id);
  };

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-ocean-600 flex items-center justify-center shrink-0 mt-1">
        <Fish size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Main answer */}
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm p-4 shadow-sm">
          {sc && (
            <div className="flex items-center gap-2 mb-3">
              <ConfidenceBadge level={sc.confidence_level} />
              <span className="text-xs text-muted-foreground capitalize">{sc.provider_mode.replace('_', ' ')}</span>
            </div>
          )}

          {/* Answer text */}
          <div className="prose prose-sm max-w-none text-foreground">
            {msg.content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-foreground">{line.replace(/\*\*/g, '')}</p>;
              }
              if (line.startsWith('• ')) {
                return <p key={i} className="text-sm text-foreground pl-2">{line}</p>;
              }
              if (line.startsWith('**') && line.includes('**')) {
                const parts = line.split(/\*\*(.+?)\*\*/g);
                return (
                  <p key={i} className="text-sm text-foreground">
                    {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                  </p>
                );
              }
              return line ? <p key={i} className="text-sm text-foreground">{line}</p> : <br key={i} />;
            })}
          </div>

          {/* Safety notice */}
          {sc?.safety_notice && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{sc.safety_notice}</p>
            </div>
          )}

          {/* Limitations */}
          {sc?.limitations && sc.limitations.length > 0 && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
              <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{sc.limitations[0]}</p>
            </div>
          )}

          {/* Sources */}
          {sc?.sources && <SourceList sources={sc.sources} />}
        </div>

        {/* Related entities */}
        {sc?.related_entities && sc.related_entities.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Related in Seafood Vision</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sc.related_entities.slice(0, 4).map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
            </div>
          </div>
        )}

        {/* Media thumbnails */}
        {sc?.related_media && sc.related_media.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Media in Seafood Vision</p>
            <div className="flex flex-wrap gap-2">
              {sc.related_media.slice(0, 6).map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border text-xs text-foreground transition-colors"
                >
                  <Star size={11} className="text-primary" />
                  {m.title.slice(0, 30)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Suggested questions */}
        {sc?.suggested_questions && sc.suggested_questions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {sc.suggested_questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {}}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                  data-suggestion={q}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleFeedback('helpful')}
            className={`p-1.5 rounded-lg transition-colors ${feedbackGiven === 'helpful' ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="Helpful"
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => handleFeedback('not_helpful')}
            className={`p-1.5 rounded-lg transition-colors ${feedbackGiven === 'not_helpful' ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="Not helpful"
          >
            <ThumbsDown size={13} />
          </button>
          <button
            onClick={() => onCopy(msg.content)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={handleSave}
            className={`p-1.5 rounded-lg transition-colors ${saved ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="Save answer"
          >
            <Bookmark size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => `anon-${Math.random().toString(36).slice(2)}`);
  const [limitReached, setLimitReached] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || loading || limitReached) return;
    setInput('');
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversation_id: conversationId,
          anonymous_session_id: user ? undefined : sessionId,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setLimitReached(true);
        const limitMsg: ChatMessage = {
          id: `limit-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'Daily question limit reached.',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, limitMsg]);
        return;
      }

      const data = await res.json();
      if (data.conversation_id) setConversationId(data.conversation_id);

      const assistantMsg: ChatMessage = {
        id: data.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: data.structured_content?.answer || 'No response available.',
        structured_content: data.structured_content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'An error occurred. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, limitReached, conversationId, sessionId, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestion = (query: string) => sendMessage(query);

  const handleFeedback = async (messageId: string, type: string) => {
    if (!user) return;
    await fetch('/api/assistant/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, feedback_type: type }),
    });
  };

  const handleSave = async (messageId: string) => {
    if (!user) return;
    await fetch('/api/assistant/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setLimitReached(false);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const suggestion = target.closest('[data-suggestion]')?.getAttribute('data-suggestion');
    if (suggestion) sendMessage(suggestion);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col pt-16">
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">

          {/* Header bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ocean-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Seafood Vision Assistant</h1>
                <p className="text-xs text-muted-foreground">Powered by verified Seafood Vision data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <Link href="/assistant/history" className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="History">
                    <History size={16} />
                  </Link>
                  <Link href="/assistant/saved" className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Saved">
                    <Bookmark size={16} />
                  </Link>
                </>
              )}
              <Link href="/assistant/about" className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="About">
                <HelpCircle size={16} />
              </Link>
              {messages.length > 0 && (
                <button
                  onClick={startNewConversation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus size={14} />
                  New
                </button>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {messages.length === 0 ? (
              /* Welcome state */
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-ocean-600/20 flex items-center justify-center mb-6">
                  <Fish size={28} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                  Ask about seafood
                </h2>
                <p className="text-muted-foreground text-center max-w-md mb-8 text-sm">
                  Explore species, products, packaging, certifications, and real seafood imagery — all from verified Seafood Vision data.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
                  {INITIAL_SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.label}
                        onClick={() => handleSuggestion(s.query)}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 text-left transition-all duration-150 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Icon size={14} className="text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                {!user && (
                  <p className="mt-6 text-xs text-muted-foreground text-center">
                    Guest: up to 5 questions/day.{' '}
                    <Link href="/auth" className="text-primary hover:underline">Sign in</Link> for more.
                  </p>
                )}
              </div>
            ) : (
              /* Messages */
              <div className="flex-1 flex flex-col gap-6 pb-4" onClick={handleSuggestionClick}>
                {messages.map((msg) => (
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <AssistantResponseCard
                      key={msg.id}
                      msg={msg}
                      onFeedback={handleFeedback}
                      onSave={handleSave}
                      onCopy={handleCopy}
                    />
                  )
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-ocean-600 flex items-center justify-center shrink-0">
                      <Fish size={14} className="text-white" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1.5 items-center h-5">
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="sticky bottom-0 bg-background pt-4 pb-2">
            {limitReached && (
              <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">
                  Daily limit reached.{' '}
                  {!user && <Link href="/auth" className="font-semibold underline">Sign in</Link>}
                  {!user && ' for more questions.'}
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a species, product, packaging, certification..."
                rows={1}
                disabled={loading || limitReached}
                className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-50 transition-all"
                style={{ minHeight: '52px', maxHeight: '160px' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 160) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || limitReached}
                className="absolute right-3 bottom-3 w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-ocean-700 transition-colors active:scale-95"
              >
                <Send size={14} />
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Answers are based on verified Seafood Vision data only.{' '}
              <Link href="/assistant/disclaimer" className="hover:underline">Disclaimer</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
