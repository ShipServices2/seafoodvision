'use client';

import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-plus-jakarta-sans)',
            fontSize: '14px',
          },
        }}
      />
    </AuthProvider>
  );
}
