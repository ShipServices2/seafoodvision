'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreditsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router?.replace('/admin/commerce/dodo-credit-config');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Redirecting to Dodo Credit Config…</p>
    </div>
  );
}
