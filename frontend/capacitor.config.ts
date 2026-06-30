import type { CapacitorConfig } from '@capacitor/cli';

// ============================================================
// SportMaps — Capacitor config (Bloque 4 / Etapa N1)
//
// App unificada SportMaps. Para white-label por escuela (addon
// premium via flavors) se sobreescribe appId/appName en build
// time con bundle IDs estilo `co.sportmaps.app.<school_slug>`.
//
// webDir = 'build' porque Vite emite a build/ (ver vite.config.ts
// build.outDir), NO al default 'dist'.
//
// RECORDATORIO split de cobros (no romper): las suscripciones SaaS
// SportMaps se abren SIEMPRE en navegador externo via @capacitor/
// browser (Browser.open) — nunca IAP. Solo matriculas/clases/
// productos fisicos cobran dentro de la app (Wompi/Epayco).
// ============================================================

const config: CapacitorConfig = {
  appId: 'co.sportmaps.app',
  appName: 'SportMaps',
  webDir: 'build',

  // En dev, para live-reload contra el server de Vite, exporta
  // CAP_SERVER_URL=http://<tu-ip-lan>:8080 antes de `cap run`.
  // En build de produccion NO se setea (la app sirve los assets
  // empacados en webDir).
  server: process.env.CAP_SERVER_URL
    ? { url: process.env.CAP_SERVER_URL, cleartext: true }
    : undefined,

  plugins: {
    // Push notifications (FCM unificado iOS+Android — feature nativa
    // obligatoria para pasar Apple Guideline 4.2).
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
