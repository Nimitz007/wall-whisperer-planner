import { useRef } from 'react';
import HeroSection from '@/components/HeroSection';
import PlannerSection from '@/components/PlannerSection';
import FooterCTA from '@/components/FooterCTA';

const Index = () => {
  const plannerRef = useRef<HTMLDivElement>(null);

  const scrollToPlanner = () => {
    plannerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroSection onStartPlanning={scrollToPlanner} />
      <div ref={plannerRef}>
        <PlannerSection />
      </div>
      <FooterCTA />
    </div>
  );
};

export default Index;
