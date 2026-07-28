/**
 * Guard de recarga del PWA.
 *
 * El SW nuevo, al tomar control (skipWaiting + claim), dispara `controllerchange`
 * y recargamos para servir el bundle nuevo. Pero si eso pasa MIENTRAS el usuario
 * está en un flujo crítico (subiendo un comprobante, en el modal de pago), el
 * reload borra el estado en memoria y toca empezar de cero.
 *
 * Solución: un contador de "bloqueos". Mientras haya ≥1 bloqueo activo, la
 * recarga solicitada por el SW se DIFIERE (queda pendiente) y se ejecuta apenas
 * se libera el último bloqueo (p.ej. al cerrar el modal). Así el usuario nunca
 * pierde un pago a medias, pero igual termina en el bundle nuevo.
 */

let blockCount = 0;
let pending = false;

function doReload() {
  // Máximo un reload por sesión y versión de SW (evita bucles con servidores
  // sirviendo builds distintos). Mismo guard que tenía register.ts.
  if (sessionStorage.getItem('sw-reloaded')) return;
  sessionStorage.setItem('sw-reloaded', '1');
  window.location.reload();
}

/** Bloquea la recarga automática del PWA (ref-counted). Llamar al entrar a un flujo crítico. */
export function blockPwaReload() {
  blockCount += 1;
}

/** Libera un bloqueo. Si era el último y había una recarga pendiente, recarga ahora. */
export function unblockPwaReload() {
  blockCount = Math.max(0, blockCount - 1);
  if (blockCount === 0 && pending) {
    pending = false;
    doReload();
  }
}

/**
 * Solicita la recarga por actualización del SW. Si hay un flujo crítico activo,
 * la deja pendiente hasta que se libere; si no, recarga de una.
 */
export function requestPwaReload() {
  if (blockCount > 0) {
    pending = true;
    return;
  }
  doReload();
}
