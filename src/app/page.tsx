import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/app/components/HeroSection';
import CategoryCards from '@/app/components/CategoryCards';
import ValuePillars from '@/app/components/ValuePillars';
import FeaturedMedia from '@/app/components/FeaturedMedia';
import AuthenticitySection from '@/app/components/AuthenticitySection';
import AudienceSection from '@/app/components/AudienceSection';
import ComingSoonFeatures from '@/app/components/ComingSoonFeatures';
import HomepageCTA from '@/app/components/HomepageCTA';
import SpeciesHighlight from '@/app/components/SpeciesHighlight';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header transparent />
      <main>
        <HeroSection />
        <CategoryCards />
        <ValuePillars />
        <FeaturedMedia />
        <AuthenticitySection />
        <SpeciesHighlight />
        <AudienceSection />
        <ComingSoonFeatures />
        <HomepageCTA />
      </main>
      <Footer />
    </div>
  );
}