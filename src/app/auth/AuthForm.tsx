'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Fish, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

type AuthMode = 'login' | 'register';

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const { user, loading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [user, loading, router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        toast.success('Welcome back!');
        router.replace(next);
      } else {
        if (!displayName.trim()) {
          toast.error('Please enter your name');
          setSubmitting(false);
          return;
        }
        await signUp(email.trim(), password, { fullName: displayName.trim() });
        toast.success('Account created! Welcome to SeafoodVision.');
        router.replace(next);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-secondary/20 border border-secondary/30 flex items-center justify-center">
          <Fish size={18} className="text-secondary" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">SeafoodVision</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-modal p-8">
        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1 mb-8">
          {(['login', 'register'] as AuthMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                mode === m
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full name"
                className="input-base w-full pl-10"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="input-base w-full pl-10"
              required
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-base w-full pl-10 pr-10"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center mt-2"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {mode === 'register' && (
          <div className="mt-5 flex items-start gap-2.5 bg-muted/60 rounded-xl p-3.5">
            <CheckCircle2 size={14} className="text-secondary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              By creating an account you agree to our terms of service. Your data is processed in accordance with our privacy policy.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-secondary font-semibold hover:underline"
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>

      <Link href="/" className="mt-8 text-xs text-white/40 hover:text-white/70 transition-colors">
        ← Back to SeafoodVision
      </Link>
    </div>
  );
}
