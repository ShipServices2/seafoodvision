'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { CartItemRequest } from '@/lib/payments/CartService';

export default function AddToCartButton({
  item,
  className = '',
  label = 'Add to cart',
}: {
  item: CartItemRequest;
  className?: string;
  label?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add() {
    if (loading) return;
    if (!user) {
      const intent = encodeURIComponent(JSON.stringify(item));
      router.push(`/auth/sign-in?return_to=${encodeURIComponent(`/cart?cart_intent=${intent}`)}`);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Unable to add this item');
      window.dispatchEvent(new Event('seafoodvision:cart-updated'));
      setMessage('Added');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add this item');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={add} disabled={loading} className={className} aria-busy={loading}>
        <ShoppingCart size={15} />
        {loading ? 'Adding…' : label}
      </button>
      {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
