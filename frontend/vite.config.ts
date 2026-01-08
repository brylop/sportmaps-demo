import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'build'
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
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
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/sportmaps-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['sports', 'education', 'lifestyle'],
        screenshots: [],
        shortcuts: [
          {
            name: 'Explorar Escuelas',
            short_name: 'Explorar',
            description: 'Buscar escuelas deportivas cerca de ti',
            url: '/explore',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          },
          {
            name: 'Mi Dashboard',
            short_name: 'Dashboard',
            description: 'Acceder a tu panel de control',
            url: '/dashboard',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
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
      }
    })
  ].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
}));
