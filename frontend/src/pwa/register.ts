export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
    const reg = await navigator.serviceWorker.register(swUrl, {
      scope: '/',
      type: 'module'
    });
    console.log('[PWA] SW registrado:', reg.scope);

    // Auto-actualización: cuando el nuevo SW toma control (sw.js hace skipWaiting+
    // claim), recargamos UNA vez para servir el bundle nuevo. Así el usuario no ve
    // la versión vieja ni tiene que darle "Actualizar ahora" manual. Solo si ya
    // había un controller (es una ACTUALIZACIÓN, no la primera instalación) — así
    // no recargamos innecesariamente en la primera visita.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
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
