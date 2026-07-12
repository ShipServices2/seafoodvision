import ComingSoonTemplate from '@/app/components/ComingSoonTemplate';

export default function ApiAccessPage() {
  return (
    <ComingSoonTemplate
      title="API Access"
      description="Programmatic access to the SeafoodVision catalog. Integrate verified seafood imagery and metadata directly into your applications, platforms, and workflows."
      icon="⚡"
      features={[
        'RESTful API with JSON responses',
        'Asset search and filtering',
        'Metadata retrieval by species or category',
        'Signed URL generation for licensed assets',
        'Webhook support for catalog updates',
        'Enterprise rate limits and SLA',
      ]}
    />
  );
}
