import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      // Escalar de 2rem daba 32px de gutter en móvil (296px útiles de 360) — el
      // mismo gutter que a los 1400px del breakpoint 2xl.
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: {
        "2xl": "1400px",
      },
    },
    /*
     * `text-input` es el token de TAMAÑO de fuente de campos (16px, ver
     * fontSize abajo). Como existe el color shadcn `input` (borde de campos),
     * `text-input` generaría TAMBIÉN `color: hsl(var(--input))` y pintaría el
     * texto del color del borde. Se quita `input` solo de los colores de texto
     * (`border-input`, `ring-input`, `bg-input` siguen funcionando).
     */
    textColor: ({ theme }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { input, ...colors } = theme("colors");
      return colors;
    },
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      /*
       * ── TOKENS DE TAMAÑO ─────────────────────────────────────────────────
       * Fuente única de verdad de anchos, altos y espacios estructurales.
       * Documentados en docs/design-tokens.md y espejados en
       * src/lib/designTokens.ts. Los breakpoints (sm 640 · md 768 · lg 1024 ·
       * xl 1280) son los de Tailwind por defecto y NO se tocan.
       * Valores en rem (1rem = 16px); el equivalente en px va en comentario.
       */
      maxWidth: {
        "page-narrow": "40rem", // 640px — formularios, ajustes, una sola columna
        page: "60rem", // 960px — página de contenido estándar
        "page-wide": "75rem", // 1200px — tablas y tableros
        "modal-sm": "26.25rem", // 420px — confirmaciones
        modal: "40rem", // 640px — modal con formulario
        "modal-lg": "60rem", // 960px — modal con tabla o detalle
        "prose-ui": "65ch", // largo de línea legible para texto corrido
      },
      minHeight: {
        touch: "2.75rem", // 44px — objetivo táctil mínimo
        header: "3.5rem", // 56px — barra superior
        tabs: "2.75rem", // 44px — tira de pestañas táctil
        nav: "var(--bottom-nav-h)", // 64px en móvil, 0 en md+
      },
      minWidth: {
        touch: "2.75rem", // 44px
        header: "3.5rem", // 56px
        nav: "var(--bottom-nav-h)",
      },
      height: {
        touch: "2.75rem", // 44px
        header: "3.5rem", // 56px
        tabs: "2.75rem", // 44px — TabsList táctil en móvil (h-tabs md:h-10)
        nav: "var(--bottom-nav-h)",
        "screen-d": "100dvh", // alto real del viewport (sin barras del navegador)
        sheet: "85dvh", // bottom sheet en móvil
        "chart-sm": "12rem", // 192px
        chart: "16rem", // 256px
        "chart-lg": "20rem", // 320px
        media: "14rem", // 224px — miniaturas / portadas
        list: "60dvh", // áreas con scroll interno
      },
      maxHeight: {
        "screen-d": "100dvh",
        sheet: "85dvh",
        "chart-sm": "12rem",
        chart: "16rem",
        "chart-lg": "20rem",
        media: "14rem",
        list: "60dvh",
      },
      width: {
        touch: "2.75rem", // 44px — botón de ícono cuadrado (w-touch h-touch)
        sidebar: "15.5rem", // 248px — sidebar de escritorio expandida
        "sidebar-collapsed": "4rem", // 64px — sidebar colapsada (solo íconos)
      },
      fontSize: {
        // 16px: iOS Safari hace zoom al enfocar campos con fuente < 16px.
        // text-xs (12px) sigue siendo el mínimo para cualquier texto.
        input: ["1rem", { lineHeight: "1.5rem" }],
      },
      spacing: {
        gutter: "1rem", // 16px — margen lateral de página en móvil
        "nav-safe": "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px))",
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        "safe-t": "env(safe-area-inset-top, 0px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
          dark: "hsl(var(--primary-dark))",
        },
        orange: {
          DEFAULT: "hsl(var(--accent-orange))",
          light: "hsl(var(--accent-orange-light))",
          dark: "hsl(var(--accent-orange-dark))",
        },
        "background-dark": "hsl(var(--background-dark))",
        "background-light": "hsl(var(--background-light))",
        "text-dark-primary": "hsl(var(--text-dark-primary))",
        "text-dark-secondary": "hsl(var(--text-dark-secondary))",
        "text-light-primary": "hsl(var(--text-light-primary))",
        "text-light-secondary": "hsl(var(--text-light-secondary))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-performance': 'var(--gradient-performance)',
        'gradient-orange': 'var(--gradient-orange)',
        'gradient-brand': 'var(--gradient-brand)',
      },
      boxShadow: {
        'elevation': 'var(--shadow-elevation)',
        'performance': 'var(--shadow-performance)',
        'card': 'var(--shadow-card)',
        'glow-green': 'var(--shadow-glow-green)',
        'glow-orange': 'var(--shadow-glow-orange)',
      },
      transitionTimingFunction: {
        'smooth': 'var(--transition-smooth)',
        'spring': 'var(--transition-spring)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(119 60% 32% / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(119 60% 32% / 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;