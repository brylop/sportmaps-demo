export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
    const reg = await navigator.serviceWorker.register(swUrl, { 
      scope: '/',
      type: 'module'
    });
    console.log('[PWA] SW registrado:', reg.scope);

    // Detectar actualización disponible
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Hay nueva versión disponible → notificar al usuario
          window.dispatchEvent(new CustomEvent('pwa:update-available'));
        }
      });
    });
  } catch (err) {
    console.error('[PWA] Error registrando SW:', err);
  }
}
