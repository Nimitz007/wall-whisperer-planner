import { createContext, useContext, useEffect, useMemo } from 'react';
import { BrandingConfig, loadBranding, brandingToHSL, brandingToHSLLight, brandingToHSLDark } from '@/lib/branding';

const BrandingContext = createContext<BrandingConfig | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const branding = useMemo(() => loadBranding(), []);

  // Apply CSS custom properties from branding config
  useEffect(() => {
    const root = document.documentElement;
    const hsl = brandingToHSL(branding);
    const hslLight = brandingToHSLLight(branding);
    const hslDark = brandingToHSLDark(branding);

    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--sidebar-ring', hsl);
    root.style.setProperty('--sage', hsl);
    root.style.setProperty('--sage-light', hslLight);
    root.style.setProperty('--sage-dark', hslDark);
    root.style.setProperty('--accent', hslLight);
    root.style.setProperty('--accent-foreground', `${branding.primaryHue} ${branding.primarySaturation}% 25%`);
    root.style.setProperty('--sidebar-accent', `${branding.primaryHue} ${Math.max(branding.primarySaturation - 8, 10)}% 95%`);
    root.style.setProperty('--sidebar-accent-foreground', `${branding.primaryHue} ${branding.primarySaturation}% 25%`);

    // Update page title with company name
    document.title = `Retaining Wall Planner — ${branding.companyName}`;
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingConfig {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
