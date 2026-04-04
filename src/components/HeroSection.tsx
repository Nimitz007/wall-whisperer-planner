import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, MoveRight, Ruler, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/contexts/BrandingContext';
import heroImage from '@/assets/retaining-wall-hero.png';

// Force eager decode for hero LCP image
const heroImagePreload = new Image();
heroImagePreload.src = heroImage;

interface HeroSectionProps {
  onStartPlanning: () => void;
}

const HeroSection = ({ onStartPlanning }: HeroSectionProps) => {
  const branding = useBranding();

  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={heroImage}
          alt="Retaining wall construction"
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d4e38]/80 via-[#106045]/70 to-[#106045]/60" />
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <span className="text-base font-semibold text-white drop-shadow-md">{branding.companyName}</span>
          )}
        </div>
        {branding.contactUrl && (
          <a
            href={branding.contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Request Quote
          </a>
        )}
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
            Retaining Wall{' '}
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <MoveRight
                className="h-8 w-8 md:h-14 md:w-14 animate-fade-in translate-y-1 md:translate-y-2 text-[#3be35f]"
                strokeWidth={3}
                style={{ animationDelay: '0.3s' }}
              />
              <span className="text-[#3be35f]">Planner</span>
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-md">
            Search your property, sketch your retaining walls, and export a concept site plan.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={onStartPlanning}
              size="lg"
              className="text-base md:text-lg group bg-[#33E65D] text-white hover:bg-[#2bc950] shadow-lg"
            >
              Start Planning
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              onClick={onStartPlanning}
              size="lg"
              variant="outline"
              className="text-base md:text-lg border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50"
            >
              Learn More
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mx-auto mt-12 flex max-w-lg flex-wrap items-center justify-center gap-6 text-white/70 sm:gap-8">
            <div className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4 text-[#3be35f]" />
              <span>Live measurements</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-[#3be35f]" />
              <span>PDF export</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-[#3be35f]" />
              <span>Concept tool</span>
            </div>
          </div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.button
        onClick={onStartPlanning}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors duration-300 cursor-pointer z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        aria-label="Scroll to planner"
      >
        <span className="text-xs uppercase tracking-widest font-medium">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-8 bg-gradient-to-b from-[#3be35f] to-transparent"
        />
      </motion.button>
    </section>
  );
};

export default HeroSection;
