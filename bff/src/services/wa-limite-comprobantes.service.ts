/**
 * Límite de comprobantes que se mandan a leer (OCR) por número y por escuela.
 *
 * Pendiente 3 de docs/cierre-seguridad-ia-pagos-2026-10-05.md: el worker de la
 * cola de WhatsApp dispara OCR por cada archivo (y la auto-aprobación vuelve a
 * leer con dos proveedores). Sin tope, un número en ráfaga quemaba tokens de
 * pago a discreción (denial-of-wallet).
 *
 * La decisión es de la base: `wa_reservar_cupo_ocr(queue_id)` cuenta y reserva
 * atómicamente (candado por escuela, idempotente por fila; migración
 * 20261025205950). Acá solo se interpreta la respuesta y, si se pasó del tope,
 * se cierra la fila como ESCALADA sin llamar al OCR: el archivo se guarda para
 * que la escuela lo vea en «Comprobantes sin resolver», y a la familia se le
 * responde un mensaje neutro (no se le dice que hay un límite: a quien está
 * abusando no se le enseña la regla).
 *
 * Falla ABIERTO: si la RPC no existe todavía (migración sin aplicar) o la base
 * da un error, se lee como siempre. Cerrar en falla dejaría sin comprobantes a
 * todas las escuelas por un problema que no es de la familia.
 */
import { supabase } from '../config/supabase';

type Logger = { info?: (...a: any[]) => void; warn?: (...a: any[]) => void };

export type MotivoCupo = 'ok' | 'limite_numero' | 'limite_escuela' | 'sin_dato';

export interface CupoOcr {
    permitido: boolean;
    motivo: MotivoCupo;
}

/** Mensaje a la familia cuando se frena. Neutro a propósito. */
export const MENSAJE_COMPROBANTE_A_REVISION =
    'Recibí tu archivo. 📄 Lo va a revisar una persona de la escuela y te confirmamos por aquí.';

/** Paso con que queda registrado el saliente (whatsapp_messages.payload.step). */
export const PASO_LIMITE = 'comprobante_limite_revision';

/** Pura: respuesta de la RPC → decisión. Todo lo que no sea un «no» explícito, pasa. */
export function interpretarCupo(data: unknown, error: unknown): CupoOcr {
    if (error || !data || typeof data !== 'object') return { permitido: true, motivo: 'sin_dato' };
    const d = data as { permitido?: unknown; motivo?: unknown };
    if (d.permitido === false && (d.motivo === 'limite_numero' || d.motivo === 'limite_escuela')) {
        return { permitido: false, motivo: d.motivo };
    }
    return { permitido: true, motivo: d.permitido === true ? 'ok' : 'sin_dato' };
}

export async function reservarCupoOcr(queueId: string, log?: Logger): Promise<CupoOcr> {
    try {
        const { data, error } = await supabase.rpc('wa_reservar_cupo_ocr', { p_queue_id: queueId });
        if (error) log?.warn?.({ queueId, err: error.message }, '[wa-limite] cupo no disponible: se lee igual');
        return interpretarCupo(data, error);
    } catch (err: any) {
        log?.warn?.({ queueId, err: err?.message ?? err }, '[wa-limite] cupo falló: se lee igual');
        return { permitido: true, motivo: 'sin_dato' };
    }
}

export interface DependenciasDelFreno {
    /** Baja y guarda el archivo (storage_path) para que la escuela lo vea. */
    guardarArchivo: () => Promise<{ ok: boolean }>;
    responder: (texto: string, paso: string) => Promise<unknown>;
    /** Cierra la fila (status 'ignored') con los campos dados. */
    cerrar: (extra: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Enganche del worker, ANTES de cualquier OCR. Devuelve true si la fila quedó
 * resuelta (frenada) y el worker debe parar.
 */
export async function frenarSiExcedeLimite(
    queueId: string,
    deps: DependenciasDelFreno,
    log?: Logger,
): Promise<boolean> {
    const cupo = await reservarCupoOcr(queueId, log);
    if (cupo.permitido) return false;

    const bajada = await deps.guardarArchivo();
    // Si no se pudo guardar, `guardarArchivo` ya dejó la fila reintentando o
    // cerrada: no se responde nada más. El reintento vuelve a esta puerta y la
    // RPC devuelve la misma decisión (idempotente) sin gastar OCR.
    if (!bajada.ok) return true;

    await deps.responder(MENSAJE_COMPROBANTE_A_REVISION, PASO_LIMITE);
    await deps.cerrar({ result_type: 'escalated', error_message: `limite_ocr: ${cupo.motivo}` });
    log?.info?.({ queueId, motivo: cupo.motivo }, '[wa-limite] límite de comprobantes: a revisión sin OCR');
    return true;
}
