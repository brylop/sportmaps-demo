/**
 * Tokens de tamaño para uso en TypeScript (gráficas de Recharts, cálculos de
 * layout, estilos inline inevitables). ESPEJO de tailwind.config.ts y de las
 * variables de src/index.css — si cambias uno, cambia el otro.
 * Documentación: docs/design-tokens.md
 */

/** Breakpoints de Tailwind (por defecto, no se tocan). En px. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1400 } as const;

/** Anchos máximos (clase `max-w-<clave>`). */
export const MAX_WIDTH = {
  "page-narrow": "40rem", // 640px
  page: "60rem", // 960px
  "page-wide": "75rem", // 1200px
  "modal-sm": "26.25rem", // 420px
  modal: "40rem", // 640px
  "modal-lg": "60rem", // 960px
  "prose-ui": "65ch",
} as const;

/** Altos (clase `h-<clave>` / `max-h-<clave>`). */
export const HEIGHT = {
  touch: "2.75rem", // 44px
  header: "3.5rem", // 56px
  tabs: "2.75rem", // 44px
  nav: "var(--bottom-nav-h)",
  "screen-d": "100dvh",
  sheet: "85dvh",
  "chart-sm": "12rem", // 192px
  chart: "16rem", // 256px
  "chart-lg": "20rem", // 320px
  media: "14rem", // 224px
  list: "60dvh",
} as const;

/** Altos de gráfica en px, para `<ResponsiveContainer height={...}>`. */
export const CHART_HEIGHT_PX = { sm: 192, md: 256, lg: 320 } as const;

/** Anchos (clase `w-<clave>`). */
export const WIDTH = {
  touch: "2.75rem", // 44px
  sidebar: "15.5rem", // 248px
  "sidebar-collapsed": "4rem", // 64px
} as const;

/** Espacios (clase `p-<clave>`, `gap-<clave>`, `bottom-<clave>`…). */
export const SPACING = {
  gutter: "1rem", // 16px
  "nav-safe": "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px))",
  "safe-b": "env(safe-area-inset-bottom, 0px)",
  "safe-t": "env(safe-area-inset-top, 0px)",
} as const;

/** Mínimos de accesibilidad móvil, en px. */
export const MOBILE_MIN = {
  touchTarget: 44,
  inputFontSize: 16,
  textMin: 12,
  viewportMin: 360,
} as const;
