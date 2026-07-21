/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  build: {
    outDir: 'build',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("tesseract.js") || id.includes("tesseract-core")) return "vendor-tesseract";
          if (id.includes("pdfjs-dist")) return "vendor-pdfjs";
          if (id.includes("node_modules/react")) return "vendor-react";
        },
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: true,
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/nominatim/, ''),
        headers: {
          'User-Agent': 'SportMaps/1.0 (sportmaps-demo)',
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      // NO inyectar el registerSW.js automático: registramos el SW manualmente
      // en src/pwa/register.ts (como type:'module'). El script inyectado lo
      // registraba en paralelo como worker clásico → doble registro del mismo
      // scope con tipos distintos → controllerchange en bucle → recargas.
      injectRegister: null,
      includeAssets: ['favicon.png', 'sportmaps-logo.png'],
      manifest: {
        name: 'SportMaps - Revolucionando el sistema deportivo',
        short_name: 'SportMaps',
        description: 'Plataforma integral para la gestión deportiva. Encuentra escuelas, inscribe a tus hijos y sigue su progreso.',
        theme_color: '#248223',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // IMPORTANTE: usar los PNG reales de /icons/. Antes apuntaba a
        // /sportmaps-logo.png y /favicon.png, que en realidad son JPEG con
        // extensión .png → Chrome Android los rechaza como iconos inválidos y
        // NO cumple los criterios de instalabilidad, por lo que
        // `beforeinstallprompt` nunca se dispara (el banner no aparece).
        icons: [
          { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ],
        categories: ['sports', 'education', 'lifestyle'],
        screenshots: [],
        shortcuts: [
          {
            name: 'Explorar Escuelas',
            short_name: 'Explorar',
            description: 'Buscar escuelas deportivas cerca de ti',
            url: '/explore',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Mi Dashboard',
            short_name: 'Dashboard',
            description: 'Acceder a tu panel de control',
            url: '/dashboard',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        // Desactivado: el dev-SW se regenera con cada HMR y provoca recargas en
        // bucle durante el desarrollo. Solo activamos el SW en producción.
        enabled: false,
        type: 'module',
      }
    })
  ].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query", "@radix-ui/react-slider"],
    // FIX: excluir tesseract.js del procesamiento de Vite para evitar que el
    // minificador rompa los callbacks internos del worker (error "g is not a function")
    exclude: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ],
    },
  },
}));
