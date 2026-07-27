'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fish, Mail, ArrowRight, ArrowLeft, CircleCheck as CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendPasswordResetEmail } from '@/lib/supabase/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-secondary/20 border border-secondary/30 flex items-center justify-center">
          <Fish size={18} className="text-secondary" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">SeafoodVision</span>
      </Link>

      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-modal p-8">
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the instructions.
            </p>
            <Link href="/auth/sign-in" className="btn-primary w-full justify-center">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground mb-1">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    Sending…
                  </span>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Remember your password?{' '}
              <Link href="/auth/sign-in" className="text-secondary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>

      <Link href="/" className="mt-8 text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5">
        <ArrowLeft size={12} />
        Back to SeafoodVision
      </Link>
    </div>
  );
}
