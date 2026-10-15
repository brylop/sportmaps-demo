/**
 * Medios de cobro que se pueden ofrecer en un torneo INTERNO de la escuela.
 *
 * Salen de lo que la escuela ya tiene configurado en `school_settings` (mismos
 * campos que lee el checkout del padre): solo se ofrece lo que existe, para no
 * prometerle a una familia un Nequi que la escuela nunca cargó.
 * Spec docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md (D3, D4).
 */

export interface MedioDeCobro {
    key: string;
    label: string;
}

const tiene = (v: unknown): boolean => typeof v === 'string' ? v.trim() !== '' : !!v;

const ETIQUETAS: Record<string, string> = {
    wompi: 'Pago en línea (Wompi)', nequi: 'Nequi', daviplata: 'Daviplata', breb: 'Bre-B',
    transferencia: 'Transferencia bancaria', efectivo: 'Efectivo en la escuela',
};

/** Nombre legible de una clave de medio (si no la conoce, la deja tal cual). */
export function etiquetaDelMedio(key: string): string {
    return ETIQUETAS[key] ?? key;
}

/** ¿Con los medios del torneo la familia solo puede pagar en efectivo en la escuela? */
export function soloEfectivo(metodos: string[] | null | undefined): boolean {
    return !!metodos && metodos.length > 0 && metodos.every((k) => k === 'efectivo');
}

/** Medios disponibles según la configuración de pago de la escuela. El efectivo siempre. */
export function mediosDeCobroDeLaEscuela(settings: Record<string, unknown> | null | undefined): MedioDeCobro[] {
    const s = settings ?? {};
    const medios: Array<MedioDeCobro & { disponible: boolean }> = [
        { key: 'wompi', label: 'Pago en línea (Wompi)', disponible: s.wompi_enabled === true },
        { key: 'nequi', label: 'Nequi', disponible: tiene(s.nequi_number) },
        { key: 'daviplata', label: 'Daviplata', disponible: tiene(s.daviplata_number) },
        { key: 'breb', label: 'Bre-B', disponible: tiene(s.breb_key) || tiene(s.breb_number) },
        { key: 'transferencia', label: 'Transferencia bancaria', disponible: tiene(s.bank_account_number) },
        { key: 'efectivo', label: 'Efectivo en la escuela', disponible: true },
    ];
    return medios.filter((m) => m.disponible).map(({ key, label }) => ({ key, label }));
}

/**
 * Valida el cobro de un torneo interno. Devuelve el mensaje de error o null.
 * Gratis no pide nada; con costo exige tarifa mayor que cero, un medio de pago
 * y una fecha límite de la tarifa (la RPC toma la fase con `valid_until` vigente).
 */
export function validarCobroDelTorneo(c: {
    is_paid: boolean;
    price: string;
    payment_methods: string[];
    valid_until: string;
}): string | null {
    if (!c.is_paid) return null;
    const precio = Number(c.price);
    if (!c.price.trim() || !Number.isFinite(precio) || precio <= 0) {
        return 'Un torneo con costo necesita una tarifa mayor que cero. Si es gratis, desmarca «El torneo tiene costo».';
    }
    if (c.payment_methods.length === 0) return 'Elige al menos un medio de pago.';
    if (!c.valid_until) return 'Pon la fecha del torneo o el cierre de inscripciones: de ahí sale la vigencia de la tarifa.';
    return null;
}
