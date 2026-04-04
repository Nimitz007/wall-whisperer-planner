import { motion } from 'framer-motion';
import { ArrowDown, Ruler, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/contexts/BrandingContext';

interface HeroSectionProps {
  onStartPlanning: () => void;
}

const HeroSection = ({ onStartPlanning }: HeroSectionProps) => {
  const branding = useBranding();

  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#106045]">
      {/* Dark teal gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d4e38] via-[#106045] to-[#1a7a5a]" />
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

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
            <span className="text-base font-semibold text-white">{branding.companyName}</span>
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
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
            Retaining Wall
            <span className="block text-[#33E65D]"> Planner</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Search your property, sketch your retaining walls, and export a concept site plan.
            Ideal for early planning and engineering review.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={onStartPlanning}
              size="lg"
              className="h-12 rounded-xl bg-[#33E65D] px-8 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#2bc950] hover:shadow-xl sm:h-14 sm:px-10 sm:text-base"
            >
              Start Planning
              <ArrowDown className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mx-auto mt-10 flex max-w-md flex-wrap items-center justify-center gap-6 text-white/70 sm:gap-8">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Ruler className="h-4 w-4 text-[#33E65D]" />
              <span>Live measurements</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4 text-[#33E65D]" />
              <span>PDF export</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Shield className="h-4 w-4 text-[#33E65D]" />
              <span>Concept tool</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-[11px] text-white/40">
            Preliminary concept planning tool only — not for construction or council approval.
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={onStartPlanning}
          className="flex flex-col items-center gap-1 text-white/40 transition-colors hover:text-white/70"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.15em]">Scroll</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
