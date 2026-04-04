import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';

const FooterCTA = () => {
  const branding = useBranding();

  return (
    <footer className="border-t border-border bg-[#f9f9f9]">
      {/* Engineering CTA */}
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[#33E65D]" />
        <h2 className="text-2xl font-light text-[#171717] sm:text-3xl">
          Ready to get your wall engineered?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-[#525252]">
          Send this concept plan to our team for certified engineering design, construction documentation, and council-ready drawings.
        </p>
        {branding.contactUrl ? (
          <a href={branding.contactUrl} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="mt-6 h-12 rounded-xl bg-[#33E65D] px-8 text-sm font-semibold text-white transition-all hover:bg-[#2bc950]"
            >
              Get Your Free Quote
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button
            size="lg"
            className="mt-6 h-12 rounded-xl bg-[#33E65D] px-8 text-sm font-semibold text-white transition-all hover:bg-[#2bc950]"
          >
            Get Your Free Quote
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#e5e5e5]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 sm:flex-row">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-7 w-auto object-contain"
              />
            ) : (
              <span className="text-sm font-semibold text-[#171717]">{branding.companyName}</span>
            )}
          </div>
          <p className="text-center text-[11px] text-[#737373]">
            Concept planning tool only. Not for construction or council approval.
            &copy; {new Date().getFullYear()} {branding.companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterCTA;
