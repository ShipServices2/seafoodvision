'use client';

import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import ImageProtection from '@/components/ImageProtection';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ImageProtection />
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
