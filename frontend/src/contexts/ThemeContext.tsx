import { createContext, useContext, useEffect, useState, ReactNode, CSSProperties } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';

type Theme = 'light' | 'dark' | 'system';

interface BrandingSettings {
  primary_color: string;
  secondary_color: string;
  show_sportmaps_watermark: boolean;
}

interface ThemeContextType {
  /** light/dark global theme (NO confundir con branding por escuela) */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
  /** Preview branding (settings form) — scopeado, no global */
  previewBranding: BrandingSettings | null;
  /**
   * Setea un preview temporal de branding usado por el form de settings.
   * IMPORTANTE: el preview NO se aplica globalmente a :root — solo es
   * leido por <BrandingScope> y solo afecta el container donde esta montado.
   * El form de Branding ademas tiene su propio preview local mas estrecho.
   */
  setPreviewBranding: (branding: BrandingSettings | null) => void;
}

// SportMaps Green / Orange — branding por defecto cuando la escuela no tiene
// (free tier) o cuando la ruta no permite branding (admin, marketplace, etc).
const DEFAULT_BRANDING: BrandingSettings = {
  primary_color: '#248223',
  secondary_color: '#FB9F1E',
  show_sportmaps_watermark: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // ── light/dark — sigue siendo global y aplicado a :root.classList ──────
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      setActualTheme(systemTheme);
    } else {
      root.classList.add(theme);
      setActualTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      setActualTheme(newTheme);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // ── preview branding (settings form) — NO se aplica globalmente ──────
  // En el modelo anterior, este preview se aplicaba al :root y leakeaba a
  // toda la app. Ahora es solo un estado que <BrandingScope> consume
  // localmente y solo afecta al container del componente que lo envuelve.
  const [previewBranding, setPreviewBrandingState] = useState<BrandingSettings | null>(null);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        actualTheme,
        previewBranding,
        setPreviewBranding: setPreviewBrandingState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook que devuelve el branding efectivo a aplicar segun:
 *   - schoolContext.schoolBranding (lo que viene de DB)
 *   - previewBranding del settings form (override temporal)
 *   - DEFAULT_BRANDING si no hay nada
 *
 * IMPORTANTE: este hook ya NO aplica nada al DOM. Solo devuelve los valores.
 * Es responsabilidad de <BrandingScope> (o el componente que lo use) decidir
 * si aplicar como CSS vars en un container y en que ruta.
 */
export function useBranding(): BrandingSettings {
  const { schoolBranding } = useSchoolContext();
  const ctx = useContext(ThemeContext);
  const previewBranding = ctx?.previewBranding ?? null;

  const fromDb: BrandingSettings | null = schoolBranding?.branding_settings ?? null;

  // Sanitizamos en caller — el RPC y BFF ya validan hex estricto, pero por
  // defense-in-depth si algo malicioso pasara al estado, no lo pintamos.
  const safe = (val: string | undefined, fallback: string) =>
    val && /^#[0-9A-Fa-f]{6}$/.test(val) ? val : fallback;

  if (previewBranding) {
    return {
      primary_color: safe(previewBranding.primary_color, DEFAULT_BRANDING.primary_color),
      secondary_color: safe(previewBranding.secondary_color, DEFAULT_BRANDING.secondary_color),
      show_sportmaps_watermark: !!previewBranding.show_sportmaps_watermark,
    };
  }
  if (fromDb) {
    return {
      primary_color: safe(fromDb.primary_color, DEFAULT_BRANDING.primary_color),
      secondary_color: safe(fromDb.secondary_color, DEFAULT_BRANDING.secondary_color),
      show_sportmaps_watermark: fromDb.show_sportmaps_watermark ?? true,
    };
  }
  return DEFAULT_BRANDING;
}

/**
 * Hook que convierte el branding actual en un objeto de CSS variables listo
 * para inyectar en un <div style={...}>. Esto es lo que <BrandingScope> usa.
 */
export function useBrandingCssVars(): CSSProperties {
  const branding = useBranding();
  return {
    ['--primary' as any]: hexToHsl(branding.primary_color),
    ['--secondary' as any]: hexToHsl(branding.secondary_color),
    ['--primary-foreground' as any]: getContrastColorHsl(branding.primary_color),
    ['--secondary-foreground' as any]: getContrastColorHsl(branding.secondary_color),
  };
}

// === Default export para compatibilidad con imports existentes ===
// Algunos archivos del codebase importaban DEFAULT_BRANDING — lo dejamos
// disponible aunque el flujo correcto es useBranding().
export { DEFAULT_BRANDING };

// === Helper Functions ===
export function hexToHsl(hex: string | undefined | null): string {
  if (!hex || typeof hex !== 'string') return '119 60% 32%';
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getContrastColorHsl(hex: string): string {
  if (!hex || typeof hex !== 'string') return '0 0% 100%';
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '0 0% 0%' : '0 0% 100%';
}
