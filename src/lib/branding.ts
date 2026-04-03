export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  contactUrl?: string;
  contactEmail?: string;
  tagline?: string;
}

declare global {
  interface Window {
    __WALL_PLANNER_BRANDING__?: Partial<BrandingConfig>;
  }
}

const DEFAULTS: BrandingConfig = {
  companyName: 'Wall Planner',
  primaryHue: 158,
  primarySaturation: 28,
  primaryLightness: 32,
  tagline: 'Plan your retaining wall visually',
};

export function loadBranding(): BrandingConfig {
  const overrides = window.__WALL_PLANNER_BRANDING__ ?? {};
  return { ...DEFAULTS, ...overrides };
}

/** Convert branding primary color to HSL string for CSS variables */
export function brandingToHSL(b: BrandingConfig): string {
  return `${b.primaryHue} ${b.primarySaturation}% ${b.primaryLightness}%`;
}

/** Lighter variant for accents */
export function brandingToHSLLight(b: BrandingConfig): string {
  return `${b.primaryHue} ${Math.max(b.primarySaturation - 8, 10)}% 90%`;
}

/** Darker variant for hover states */
export function brandingToHSLDark(b: BrandingConfig): string {
  return `${b.primaryHue} ${Math.min(b.primarySaturation + 2, 100)}% ${Math.max(b.primaryLightness - 10, 10)}%`;
}

/** Convert branding primary to RGB for PDF rendering */
export function brandingToRGB(b: BrandingConfig): [number, number, number] {
  const h = b.primaryHue / 360;
  const s = b.primarySaturation / 100;
  const l = b.primaryLightness / 100;
  let r: number, g: number, bl: number;
  if (s === 0) {
    r = g = bl = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    bl = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255)];
}
