import ComingSoonTemplate from '@/app/components/ComingSoonTemplate';

export default function KnowledgePage() {
  return (
    <ComingSoonTemplate
      title="Knowledge Base"
      description="A structured knowledge engine linking seafood species, product forms, fishing areas, and scientific references. Built for professionals who need reliable, traceable information."
      icon="📚"
      features={[
        'Species knowledge graph',
        'Scientific reference linking',
        'Product form taxonomy',
        'FAO area documentation',
        'Multilingual knowledge entries',
        'Verified claims with source attribution',
      ]}
    />
  );
}
