export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // En desarrollo NO registramos el SW: el dev-SW se regenera con cada HMR y
  // dispara controllerchange en cada cambio → recargas en bucle mientras se
  // trabaja. El SW solo aporta valor en producción.
  if (import.meta.env.DEV) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      type: 'module'
    });
    console.log('[PWA] SW registrado:', reg.scope);

    // Auto-actualización: cuando el nuevo SW toma control (sw.js hace skipWaiting+
    // claim), recargamos UNA vez para servir el bundle nuevo. Así el usuario no ve
    // la versión vieja ni tiene que darle "Actualizar ahora" manual. Solo si ya
    // había un controller (es una ACTUALIZACIÓN, no la primera instalación) — así
    // no recargamos innecesariamente en la primera visita.
    //
    // GUARD PERSISTENTE (sessionStorage): el flag sobrevive al reload. Si tras
    // recargar el controller vuelve a cambiar (p.ej. instancias del servidor
    // sirviendo builds distintos, o un SW clásico vs módulo re-registrándose),
    // NO recargamos otra vez → corta el bucle de recargas. Máximo un reload por
    // sesión y por versión de SW.
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem('sw-reloaded')) return;
        sessionStorage.setItem('sw-reloaded', '1');
        window.location.reload();
      });
    }

    // Detectar actualización disponible
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Hay nueva versión disponible → notificar al usuario
          window.dispatchEvent(new CustomEvent('pwa:update-available'));
          // Opcional: recargar automáticamente si registerType es autoUpdate
          // window.location.reload();
        }
      });
    });

    // Verificar actualizaciones periódicamente (cada 60 min)
    setInterval(() => {
      reg.update();
    }, 60 * 60 * 1000);

  } catch (err) {
    console.error('[PWA] Error registrando SW:', err);
  }
}
