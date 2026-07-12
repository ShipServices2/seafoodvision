import ComingSoonTemplate from '@/app/components/ComingSoonTemplate';

export default function IdentifyPage() {
  return (
    <ComingSoonTemplate
      title="Species Identifier"
      description="Upload a photo of any seafood product and our AI-powered identification engine will identify the species, suggest the scientific name, and match it against our verified catalog."
      icon="🔬"
      features={[
        'Photo upload and instant species identification',
        'Scientific name suggestion with confidence score',
        'Match against verified catalog entries',
        'Multilingual species name lookup',
        'Integration with the Knowledge Engine',
      ]}
    />
  );
}
