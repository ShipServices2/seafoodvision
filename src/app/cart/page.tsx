'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Minus, Plus, ShoppingCart, Trash2, XCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import type { CartSnapshot, CartValidationResult } from '@/lib/payments/CartService';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setCart(null); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/cart', { cache: 'no-store' });
      const data = await response.json() as CartSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Unable to load cart');
      setCart(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load cart');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  useEffect(() => {
    const encoded = searchParams.get('cart_intent');
    if (!user || !encoded || busy) return;
    const resume = async () => {
      setBusy('resume');
      try {
        const item = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
        const response = await fetch('/api/cart/items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
        });
        const data = await response.json() as CartSnapshot & { error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Unable to resume cart action');
        setCart(data);
        setNotice('Your selected item was added after sign-in.');
        window.dispatchEvent(new Event('seafoodvision:cart-updated'));
      } catch (resumeError) {
        setError(resumeError instanceof Error ? resumeError.message : 'Unable to resume cart action');
      } finally {
        setBusy(null);
        router.replace('/cart');
      }
    };
    void resume();
  // Process the one-time, reference-only intent after authentication.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  async function mutate(url: string, init: RequestInit, key: string) {
    if (busy) return;
    setBusy(key); setError(null); setNotice(null); setConfirmed(false);
    try {
      const response = await fetch(url, init);
      const data = await response.json() as CartSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Cart update failed');
      setCart(data);
      window.dispatchEvent(new Event('seafoodvision:cart-updated'));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Cart update failed');
    } finally { setBusy(null); }
  }

  async function validate() {
    if (busy) return;
    setBusy('validate'); setError(null); setNotice(null);
    try {
      const response = await fetch('/api/cart/validate', { method: 'POST' });
      const data = await response.json() as CartValidationResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Cart validation failed');
      setCart(data.cart);
      if (!data.valid) {
        setConfirmed(false);
        setError(data.errors.map((entry) => entry.message).join(' · '));
      } else if (data.priceChanged) {
        setConfirmed(false);
        setNotice('A price changed. The total was refreshed; review it and validate again.');
      } else {
        setConfirmed(true);
        setNotice('Cart validated. You can continue to secure checkout.');
      }
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Cart validation failed');
    } finally { setBusy(null); }
  }

  async function checkout() {
    if (busy || !confirmed) return;
    setBusy('checkout'); setError(null);
    try {
      const response = await fetch('/api/cart/checkout', { method: 'POST' });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? 'Checkout is unavailable');
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setConfirmed(false);
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout is unavailable');
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <ShoppingCart className="text-secondary" />
          <div><h1 className="text-3xl font-bold">Your cart</h1><p className="text-sm text-muted-foreground">One order, one secure checkout.</p></div>
        </div>

        {authLoading || loading ? (
          <div className="flex min-h-56 items-center justify-center" aria-label="Loading cart"><Loader2 className="animate-spin" /></div>
        ) : !user ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <h2 className="mb-2 text-xl font-semibold">Sign in to use your persistent cart</h2>
            <p className="mb-6 text-sm text-muted-foreground">Your cart is stored securely and available across devices.</p>
            <Link href="/auth/sign-in?return_to=/cart" className="btn-primary inline-flex">Sign in</Link>
          </div>
        ) : !cart?.items.length ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <ShoppingCart className="mx-auto mb-4 text-muted-foreground" size={36} />
            <h2 className="mb-2 text-xl font-semibold">Your cart is empty</h2>
            <p className="mb-6 text-sm text-muted-foreground">Add licensed assets or credit packs to begin.</p>
            <div className="flex justify-center gap-3"><Link href="/library" className="btn-primary">Browse Library</Link><Link href="/pricing" className="btn-outline">View Pricing</Link></div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-3" aria-label="Cart items">
              {cart.items.map((item) => (
                <article key={item.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold">{item.productName}</h2>
                      {item.assetTitle && <p className="truncate text-sm text-muted-foreground">{item.assetTitle}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.format && <span className="rounded-full bg-muted px-2 py-1">{item.format}</span>}
                        {item.licenseName && <span className="rounded-full bg-muted px-2 py-1">{item.licenseName}</span>}
                        {item.credits && <span className="rounded-full bg-muted px-2 py-1">{item.credits} credits each</span>}
                      </div>
                    </div>
                    <button aria-label={`Remove ${item.productName}`} disabled={!!busy || cart.locked} onClick={() => mutate(`/api/cart/items/${item.id}`, { method: 'DELETE' }, item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={17} /></button>
                  </div>
                  {item.validationError && <p role="alert" className="mt-3 flex gap-2 text-sm text-red-600"><XCircle size={16} />{item.validationError}</p>}
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    {item.itemType === 'credit_pack' ? (
                      <div className="flex items-center gap-2" aria-label="Quantity">
                        <button aria-label="Decrease quantity" disabled={!!busy || cart.locked || item.quantity <= 1} onClick={() => mutate(`/api/cart/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: item.quantity - 1 }) }, item.id)} className="rounded border p-1 disabled:opacity-40"><Minus size={14} /></button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button aria-label="Increase quantity" disabled={!!busy || cart.locked || item.quantity >= 10} onClick={() => mutate(`/api/cart/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: item.quantity + 1 }) }, item.id)} className="rounded border p-1 disabled:opacity-40"><Plus size={14} /></button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Quantity 1</span>}
                    <div className="text-right"><p className="font-mono text-sm">{item.unitPrice.toFixed(2)} {cart.currency}</p><p className="font-semibold">{item.subtotal.toFixed(2)} {cart.currency}</p></div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
              <div className="mb-4 flex justify-between"><span>{cart.lineCount} line{cart.lineCount === 1 ? '' : 's'}</span><span>{cart.quantityCount} item{cart.quantityCount === 1 ? '' : 's'}</span></div>
              <div className="mb-5 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{cart.total.toFixed(2)} {cart.currency}</span></div>
              {notice && <p role="status" className="mb-3 flex gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={16} className="shrink-0" />{notice}</p>}
              {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {cart.locked && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This cart is locked because checkout has started.</p>}
              <button onClick={validate} disabled={!!busy || cart.locked} className="btn-outline mb-2 w-full justify-center">{busy === 'validate' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Validate cart</button>
              <button onClick={checkout} disabled={!!busy || !confirmed || cart.locked} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{busy === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : null}Secure checkout</button>
              <button onClick={() => mutate('/api/cart', { method: 'DELETE' }, 'clear')} disabled={!!busy || cart.locked} className="mt-3 w-full text-sm text-muted-foreground hover:text-red-600 disabled:opacity-40">Empty cart</button>
              <p className="mt-4 text-xs text-muted-foreground">Prices, rights and Dodo product mappings are revalidated by the server before checkout.</p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
