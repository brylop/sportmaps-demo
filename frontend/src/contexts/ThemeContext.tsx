import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

interface BrandingSettings {
  primary_color: string
  secondary_color: string
  show_sportmaps_watermark: boolean
}

const DEFAULT_BRANDING: BrandingSettings = {
  primary_color: '#248223', // SportMaps Green
  secondary_color: '#FB9F1E', // SportMaps Orange
  show_sportmaps_watermark: true,
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
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

  // Listen for system theme changes
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

  // --- Branding Logic ---
  const { schoolBranding } = useSchoolContext();
  const branding: BrandingSettings = {
    ...DEFAULT_BRANDING,
    ...(schoolBranding?.branding_settings ?? {}),
  }

  useEffect(() => {
    const root = window.document.documentElement;

    root.style.setProperty('--primary', hexToHsl(branding.primary_color));
    root.style.setProperty('--secondary', hexToHsl(branding.secondary_color));
    root.style.setProperty('--primary-foreground', getContrastColorHsl(branding.primary_color));
    root.style.setProperty('--secondary-foreground', getContrastColorHsl(branding.secondary_color));

    return () => {
      root.style.setProperty('--primary', hexToHsl(DEFAULT_BRANDING.primary_color));
      root.style.setProperty('--secondary', hexToHsl(DEFAULT_BRANDING.secondary_color));
      root.style.setProperty('--primary-foreground', getContrastColorHsl(DEFAULT_BRANDING.primary_color));
      root.style.setProperty('--secondary-foreground', getContrastColorHsl(DEFAULT_BRANDING.secondary_color));
    };
  }, [branding.primary_color, branding.secondary_color]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
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

// === Branding Export ===
export function useBranding(): BrandingSettings {
  const { schoolBranding } = useSchoolContext();
  return {
    ...DEFAULT_BRANDING,
    ...(schoolBranding?.branding_settings ?? {}),
  };
}

// === Helper Functions ===
export function hexToHsl(hex: string): string {
  if (!hex || typeof hex !== 'string') return '201 96% 32%';

  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
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
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '0 0% 0%' : '0 0% 100%';
}
