import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowRight, Circle as HelpCircle } from 'lucide-react';

const faqs = [
  {
    category: 'Plans & billing',
    items: [
      {
        q: 'What is included in the Free plan?',
        a: 'The Free plan gives you access to browse the full catalog with watermarked previews, limited search (10 queries/day), and limited encyclopedia access. No downloads are included.',
      },
      {
        q: 'Can I switch plans at any time?',
        a: 'Yes. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately; downgrades take effect at the end of your current billing period.',
      },
      {
        q: 'What is the difference between monthly and annual billing?',
        a: 'Annual billing saves approximately 17% compared to monthly billing. You pay for 10 months and get 12. Annual plans are billed once per year.',
      },
      {
        q: 'Are prices inclusive of taxes?',
        a: 'No. All prices shown are exclusive of applicable taxes (VAT, GST, etc.). Taxes are calculated at checkout based on your billing address.',
      },
      {
        q: 'Do unused downloads roll over to the next month?',
        a: 'No. Monthly download quotas reset at the start of each billing period. Unused downloads do not carry over.',
      },
    ],
  },
  {
    category: 'Downloads & assets',
    items: [
      {
        q: 'What image formats are available?',
        a: 'Assets are available in JPEG and PNG formats. Web resolution (72 dpi), HD (300 dpi, up to 4K) and Ultra HD (full resolution, up to 8K) are available depending on your plan.',
      },
      {
        q: 'Can I download videos and 360° views?',
        a: 'Video and 360° view downloads are available on the Business and Enterprise plans, and as individual unit purchases.',
      },
      {
        q: 'What does a "download" count as?',
        a: 'Each asset file downloaded counts as one download against your monthly quota, regardless of format or resolution.',
      },
      {
        q: 'Can I buy individual assets without a subscription?',
        a: 'Yes. Unit purchases are available: Photo Web (5€), Photo HD (20€), Photo Ultra HD (40€), Video (75€), Vue 360° (50€), and a Pack of 10 images (150€).',
      },
    ],
  },
  {
    category: 'Licenses',
    items: [
      {
        q: 'What license types are available?',
        a: 'Seafood Vision offers four license types: Editorial (news, education), Commercial (advertising, packaging), Extended (broadcast, merchandise, unlimited print), and Exclusive (worldwide exclusivity, asset removed from catalog).',
      },
      {
        q: 'Is a commercial license included in my subscription?',
        a: 'Commercial licenses are included in Explorer, Professional, Business and Enterprise plans. The Free plan only allows browsing with watermarked previews.',
      },
      {
        q: 'Can I use assets for AI training datasets?',
        a: 'No. Use of Seafood Vision assets for AI training datasets is explicitly prohibited under all license types.',
      },
      {
        q: 'How do I obtain an Exclusive license?',
        a: 'Exclusive licenses are negotiated individually. Contact our sales team to discuss availability and pricing.',
      },
    ],
  },
  {
    category: 'Credits',
    items: [
      {
        q: 'What are credits and how do I use them?',
        a: 'Credits are a flexible currency for accessing premium features. They can be used for downloads (1–15 credits depending on format), AI identification (2 credits), smart search (1 credit), and AI generation (5 credits).',
      },
      {
        q: 'Do credits expire?',
        a: 'Credits purchased as packs do not expire. Credits included in a subscription plan reset monthly.',
      },
      {
        q: 'Can I combine credits with a subscription?',
        a: 'Yes. Credits can be used alongside your subscription to access features beyond your plan quota.',
      },
    ],
  },
  {
    category: 'Enterprise & API',
    items: [
      {
        q: 'What is included in the Enterprise plan?',
        a: 'Enterprise plans include unlimited downloads, full API access, private collections, multi-user management, dedicated account manager, SLA-backed support, usage statistics, and custom licensing. Pricing is on quote.',
      },
      {
        q: 'Is the API available on lower plans?',
        a: 'API access is available on the Business plan (199€/month) and above. Enterprise plans include extended API quotas and dedicated support.',
      },
      {
        q: 'Can I integrate Seafood Vision with my ERP or CRM?',
        a: 'ERP/CRM integration is on our roadmap and will be available for Enterprise customers. Contact us to discuss your specific requirements.',
      },
    ],
  },
];

export default function PricingFaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Pricing</p>
          <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center gap-3">
            <HelpCircle size={32} className="text-secondary" />
            Pricing FAQ
          </h1>
          <p className="text-muted-foreground mb-12 leading-relaxed">
            Answers to the most common questions about Seafood Vision plans, downloads, licenses and credits.
          </p>

          <div className="space-y-12">
            {faqs?.map((section) => (
              <div key={section?.category}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-secondary mb-5 pb-2 border-b border-border">
                  {section?.category}
                </h2>
                <div className="space-y-6">
                  {section?.items?.map((item) => (
                    <div key={item?.q}>
                      <h3 className="font-semibold text-foreground mb-2 text-sm">{item?.q}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item?.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 bg-muted/50 rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">Still have questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is happy to help you choose the right plan for your needs.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">
                Contact us
                <ArrowRight size={14} />
              </Link>
              <Link href="/pricing/compare" className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
