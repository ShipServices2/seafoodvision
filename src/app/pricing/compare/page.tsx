import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/pricingConfig';

const compareRows = [
  { label: 'Monthly price', key: 'price' },
  { label: 'Downloads / month', key: 'downloads' },
  { label: 'Image quality', key: 'quality' },
  { label: 'Encyclopedia access', key: 'encyclopedia' },
  { label: 'AI-powered search', key: 'ai' },
  { label: 'Collections', key: 'collections' },
  { label: 'HD images', key: 'hd' },
  { label: 'Ultra HD images', key: 'ultrahd' },
  { label: 'Video downloads', key: 'video' },
  { label: '360° views', key: 'view360' },
  { label: 'API access', key: 'api' },
  { label: 'Private spaces', key: 'private' },
  { label: 'Marketing Kit', key: 'kit' },
  { label: 'Priority support', key: 'support' },
  { label: 'Multi-user management', key: 'multiuser' },
];

function getCellValue(planId: string, key: string): React.ReactNode {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) return null;

  const yes = <CheckCircle2 size={15} className="text-green-verified mx-auto" />;
  const no = <XCircle size={15} className="text-muted-foreground/30 mx-auto" />;

  switch (key) {
    case 'price':
      return plan.monthlyPrice === null ? 'On quote' : plan.monthlyPrice === 0 ? 'Free' : `${plan.monthlyPrice}€/mo`;
    case 'downloads':
      return plan.downloads === null ? 'Unlimited' : plan.downloads === 0 ? '—' : `${plan.downloads}`;
    case 'quality':
      return plan.imageQuality.length === 0 ? 'Preview only' : plan.imageQuality.join(', ').toUpperCase();
    case 'encyclopedia':
      return planId === 'free' ? 'Limited' : yes;
    case 'ai':
      return plan.aiAccess ? yes : no;
    case 'collections':
      return planId === 'free' ? no : yes;
    case 'hd':
      return plan.imageQuality.includes('hd') ? yes : no;
    case 'ultrahd':
      return plan.imageQuality.includes('ultrahd') ? yes : no;
    case 'video':
      return plan.videoAccess ? yes : no;
    case 'view360':
      return plan.view360Access ? yes : no;
    case 'api':
      return plan.apiAccess ? yes : no;
    case 'private':
      return plan.privateSpaces ? yes : no;
    case 'kit':
      return planId === 'professional' || planId === 'business' || planId === 'enterprise' ? yes : no;
    case 'support':
      return planId === 'business' || planId === 'enterprise' ? yes : no;
    case 'multiuser':
      return planId === 'enterprise' ? yes : no;
    default:
      return '—';
  }
}

export default function ComparePlansPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold text-foreground mb-3">Compare plans</h1>
          <p className="text-muted-foreground max-w-xl">
            Side-by-side comparison of all Seafood Vision subscription plans.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border mb-10">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-4 font-semibold text-foreground w-48">Feature</th>
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    className={`text-center px-4 py-4 font-semibold ${
                      plan.highlight ? 'text-secondary' : 'text-foreground'
                    }`}
                  >
                    {plan.name}
                    {plan.highlight && (
                      <div className="text-xs font-normal text-secondary/70 mt-0.5">Most popular</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, idx) => (
                <tr
                  key={row.key}
                  className={`border-b border-border last:border-0 ${
                    idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                  }`}
                >
                  <td className="px-5 py-3 text-muted-foreground font-medium">{row.label}</td>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <td
                      key={`${plan.id}-${row.key}`}
                      className={`text-center px-4 py-3 text-sm ${
                        plan.highlight ? 'bg-secondary/5' : ''
                      }`}
                    >
                      {getCellValue(plan.id, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/pricing" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">
            View pricing
            <ArrowRight size={14} />
          </Link>
          <Link href="/pricing/faq" className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
            Pricing FAQ
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
