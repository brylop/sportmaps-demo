/**
 * Alto que le queda a un bloque desde donde empieza hasta el fondo de la
 * ventana, descontando el padding inferior del contenedor con scroll (`main`).
 *
 * Para el buzón de WhatsApp en escritorio: el `calc(100dvh-12rem)` anterior no
 * contaba el encabezado de la app, el título, los avisos y las pestañas
 * (~240 px), y el compositor quedaba ~50 px bajo el pliegue en 1440×900
 * (inventario de Comunicaciones 2026-10-12 §7). Medir es más fiable que
 * adivinar: los avisos de arriba aparecen y desaparecen.
 *
 * Devuelve null mientras `activo` sea false (en el celular el hilo va a
 * pantalla completa y no usa esto).
 */
import { useEffect, useState, type RefObject } from 'react';

export function useAltoDisponible(ref: RefObject<HTMLElement>, activo: boolean, minimo = 480): number | null {
    const [alto, setAlto] = useState<number | null>(null);

    useEffect(() => {
        if (!activo) { setAlto(null); return; }
        const el = ref.current;
        if (!el) return;
        const contenedor = el.closest('main') as HTMLElement | null;

        const medir = () => {
            const rect = el.getBoundingClientRect();
            // Posición si el contenedor estuviera arriba del todo: el alto no
            // cambia por haber hecho scroll.
            const top = rect.top + (contenedor?.scrollTop ?? 0);
            const padInferior = contenedor ? parseFloat(getComputedStyle(contenedor).paddingBottom) || 0 : 0;
            setAlto(Math.max(minimo, Math.floor(window.innerHeight - top - padInferior)));
        };

        medir();
        window.addEventListener('resize', medir);
        // Los avisos de arriba (asistente apagado, consumo…) cambian el alto de lo de arriba.
        const ro = typeof ResizeObserver !== 'undefined' && contenedor?.firstElementChild
            ? new ResizeObserver(() => medir()) : null;
        if (ro && contenedor?.firstElementChild) ro.observe(contenedor.firstElementChild);
        return () => { window.removeEventListener('resize', medir); ro?.disconnect(); };
    }, [ref, activo, minimo]);

    return alto;
}
