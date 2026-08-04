/**
 * receipt-context.service — Resuelve el contexto de BD que las reglas de veredicto
 * necesitan (cuentas registradas de la escuela, dedup de referencia/hash, ventana de
 * fecha configurada). Mantiene `evaluateVerdict` puro: aquí ocurre todo el I/O.
 *
 * Usa el cliente service-role (bypass RLS) porque corre server-side en el BFF, igual
 * que el resto de services (config/supabase).
 */

import { supabase } from '../config/supabase';
import { normalizeDestination, type VerdictContext } from './receipt-verdict';

/** Hoy en Bogotá como ISO yyyy-mm-dd (en-CA formatea así). */
function todayIsoBogota(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

export interface BuildContextArgs {
    referenceNorm: string | null;
    imageSha256: string | null;
    expectedAmount?: number | null;
    /** En el flujo de update: el pago que se está editando, para excluirlo del dedup. */
    paymentId?: string | null;
}

/**
 * Arma el VerdictContext para una escuela. Resiliente: si una query falla, degrada
 * (no marca dedup/cuentas) en vez de romper la extracción — el veredicto peca de
 * permisivo, nunca bloquea por un error de infra.
 */
export async function buildVerdictContext(
    schoolId: string,
    args: BuildContextArgs,
): Promise<VerdictContext> {
    const today = todayIsoBogota();

    // 1) school_settings: ventana de fecha + cuentas destino registradas.
    //    Solo columnas garantizadas por migración (daviplata_number es drift → se omite).
    let dateWindowDays = 5;
    let registeredAccounts: string[] = [];
    try {
        const { data: settings } = await supabase
            .from('school_settings')
            .select('receipt_date_window_days, bank_account_number, nequi_number, breb_key')
            .eq('school_id', schoolId)
            .single();
        if (settings) {
            if (typeof settings.receipt_date_window_days === 'number') {
                dateWindowDays = settings.receipt_date_window_days;
            }
            registeredAccounts = [settings.bank_account_number, settings.nequi_number, settings.breb_key]
                .map((a) => normalizeDestination(a))
                .filter((a): a is string => a !== null);
        }
    } catch {
        // Sin settings legibles: ventana default, sin cuentas → check 4 se salta.
    }

    // 1.b) Cuentas destino que viven en columnas DRIFT (existen en la base pero
    //      ninguna migración las crea: transfer_key, breb_number, daviplata_number).
    //      Van en un select APARTE a propósito: si se mezclan con el de arriba y
    //      una columna no existe, PostgREST falla la query entera, `registeredAccounts`
    //      queda vacío y el check 4 se salta por completo — o sea, dejaríamos de
    //      detectar destinos ajenos por un problema de esquema.
    //      Sin esto, la Llave de Transferencia de la escuela no se compara y un
    //      pago legítimo hecho a esa llave sale ROJO (falso positivo que ahora
    //      además rechazaría el pago).
    try {
        const { data: drift } = await supabase
            .from('school_settings')
            .select('transfer_key, breb_number, daviplata_number')
            .eq('school_id', schoolId)
            .single();
        if (drift) {
            const extra = [drift.transfer_key, drift.breb_number, drift.daviplata_number]
                .map((a) => normalizeDestination(a))
                .filter((a): a is string => a !== null);
            registeredAccounts = Array.from(new Set([...registeredAccounts, ...extra]));
        }
    } catch {
        // Columnas ausentes en este esquema: se comparan solo las garantizadas.
    }

    // 2) Dedup de referencia normalizada en la escuela. Usamos .eq parametrizado
    //    (no .or con string interpolado) para no exponer un filtro PostgREST a
    //    referencias con comas/paréntesis. El valor crudo (ocr_reference) sigue
    //    protegido por el índice único vivo uq_payments_school_ocr_reference al
    //    insertar, así que no perdemos cobertura de dedup.
    let referenceAlreadyUsed = false;
    if (args.referenceNorm) {
        referenceAlreadyUsed = await existsPayment(schoolId, args.paymentId, (q) =>
            q.eq('receipt_reference_norm', args.referenceNorm),
        );
    }

    // 3) Dedup de hash de imagen. Solo cuenta contra pagos NO rechazados/cancelados/fallidos
    //    (espeja el índice único parcial: un rechazo libera el comprobante para reintento).
    let imageHashDuplicate = false;
    if (args.imageSha256) {
        imageHashDuplicate = await existsPayment(schoolId, args.paymentId, (q) =>
            q
                .eq('receipt_image_sha256', args.imageSha256!)
                .not('status', 'in', '(rejected,cancelled,failed)'),
        );
    }

    return {
        expectedAmount: args.expectedAmount ?? null,
        registeredAccounts,
        dateWindowDays,
        today,
        referenceAlreadyUsed,
        imageHashDuplicate,
    };
}

/**
 * ¿Existe algún pago de la escuela que matchee el filtro (excluyendo paymentId)?
 * Degrada a false si la query falla.
 */
async function existsPayment(
    schoolId: string,
    excludePaymentId: string | null | undefined,
    applyFilter: (q: any) => any,
): Promise<boolean> {
    try {
        let q = supabase.from('payments').select('id').eq('school_id', schoolId);
        q = applyFilter(q);
        if (excludePaymentId) q = q.neq('id', excludePaymentId);
        const { data, error } = await q.limit(1);
        if (error) return false;
        return Array.isArray(data) && data.length > 0;
    } catch {
        return false;
    }
}