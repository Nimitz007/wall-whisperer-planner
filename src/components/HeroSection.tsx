import { motion } from 'framer-motion';
import { ArrowDown, Shield, Ruler, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onStartPlanning: () => void;
}

const HeroSection = ({ onStartPlanning }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      <div className="container relative z-10 max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Brand */}
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Simple Engineers
          </p>

          {/* Headline */}
          <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl">
            Plan your retaining wall
            <span className="block text-primary"> visually</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Search your property, sketch your retaining walls, and export a concept site plan.
            Ideal for early planning, budgeting, and engineering review.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              onClick={onStartPlanning}
              size="lg"
              className="h-14 rounded-xl px-10 text-base font-semibold shadow-card transition-all hover:shadow-card-hover"
            >
              Start Planning
              <ArrowDown className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mx-auto mt-14 flex max-w-lg flex-wrap items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4 text-primary" />
              <span>Live measurements</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>PDF export</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              <span>Concept planning tool</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-8 text-xs text-muted-foreground/60">
            This is a preliminary concept planning tool only — not for construction or council approval.
            Engineering certification is required before construction.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
