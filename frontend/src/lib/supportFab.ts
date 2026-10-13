/**
 * Ocultar la burbuja de soporte (SupportChatButton) mientras una pantalla la
 * necesita libre: en el buzón de WhatsApp tapaba el botón «Enviar» del
 * compositor (inventario de Comunicaciones, 2026-10-12 §7).
 *
 * Un contador y no un booleano: si dos componentes la piden oculta, la burbuja
 * vuelve solo cuando los dos la sueltan.
 */
import { useEffect, useSyncExternalStore } from 'react';

let pedidos = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function suscribir(f: () => void) {
    oyentes.add(f);
    return () => { oyentes.delete(f); };
}

/** ¿Hay alguien pidiendo que la burbuja no se vea? */
export function useFabSoporteOculto(): boolean {
    return useSyncExternalStore(suscribir, () => pedidos > 0, () => false);
}

/** Mientras `activo` sea true (y el componente esté montado), la burbuja se oculta. */
export function useOcultarFabSoporte(activo = true): void {
    useEffect(() => {
        if (!activo) return;
        pedidos += 1;
        avisar();
        return () => { pedidos = Math.max(0, pedidos - 1); avisar(); };
    }, [activo]);
}
