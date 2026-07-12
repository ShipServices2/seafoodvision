'use client';

import React, { Suspense } from 'react';
import AuthForm from './AuthForm';

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
