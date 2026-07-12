import ComingSoonTemplate from '@/app/components/ComingSoonTemplate';

export default function MarketingKitPage() {
  return (
    <ComingSoonTemplate
      title="Marketing Kit"
      description="Generate ready-to-use marketing materials from verified seafood assets. Product sheets, social media packs, and branded content — all with proper licensing included."
      icon="🎨"
      features={[
        'Automated product sheet generation',
        'Social media image packs',
        'Branded content templates',
        'Multi-language caption generation',
        'License documentation included',
      ]}
    />
  );
}
