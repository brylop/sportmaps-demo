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
// SportMaps se abren SIEMPRE en navegador externo — nunca IAP. Solo
// matriculas/clases/productos fisicos cobran dentro de la app
// (Wompi/Mercado Pago), que son servicios del mundo real y quedan
// exentos de Play Billing.
//
// Implementado en src/lib/openExternalUrl.ts y usado por MiPlanPage.
// OJO: hasta 2026-08-01 esto era falso — MiPlanPage hacia
// window.location.href, que en nativo navega el propio WebView, y
// @capacitor/browser no estaba importado en ningun lado. Si alguien
// vuelve a poner location.href ahi, el cobro del plan pasa dentro de
// la app y es rechazo de Play.
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

    // Edge-to-edge de Android 15+/API 36: MainActivity paddea el contenedor
    // del WebView con los insets del sistema (ver el comentario largo ahi).
    // Capacitor tambien instala un listener de insets sobre esa vista y solo
    // puede haber uno, asi que lo desactivamos para que no se pisen ni se
    // aplique el inset dos veces.
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
