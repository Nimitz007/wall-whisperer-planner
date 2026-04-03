import { Button } from '@/components/ui/button';
import { ArrowRight, Shield } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';

const FooterCTA = () => {
  const branding = useBranding();

  return (
    <footer className="border-t border-border bg-card">
      {/* Engineering CTA */}
      <div className="container max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-primary">Need Certified Engineering?</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-foreground md:text-4xl">
          Send this concept plan to {branding.companyName} for review
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Our team can take your concept retaining wall plan and provide certified engineering design,
          construction documentation, and council-ready drawings.
        </p>
        {branding.contactUrl ? (
          <a href={branding.contactUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="mt-8 h-14 rounded-xl px-10 text-base font-semibold shadow-card">
              Request Engineering Design
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button size="lg" className="mt-8 h-14 rounded-xl px-10 text-base font-semibold shadow-card">
            Request Engineering Design
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.companyName} className="h-5 object-contain" />
            ) : (
              <>
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-display text-sm font-semibold text-foreground">{branding.companyName}</span>
              </>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Concept planning tool only. Not for construction or council approval.
            © {new Date().getFullYear()} {branding.companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterCTA;
