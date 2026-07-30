/**
 * paymentOrigin — Cómo entró la plata, resuelto en UN solo lugar.
 *
 * Existe porque cada pantalla lo inventaba distinto y ninguna decía la verdad:
 *   · FinancesPage tenía `method: 'Transferencia'` HARDCODEADO para toda fila.
 *   · PaymentsAutomationPage hacía `payment_method || 'TRANSFER'`, así que los
 *     pagos sin método registrado (55 en la base) se mostraban como transferencia.
 *
 * Reglas, en orden de confianza:
 *
 * 1. `payment_provider` NO se usa para decidir si hubo pasarela. La columna tiene
 *    DEFAULT 'wompi' (mig 20260504000001), así que los 3.205 pagos de la base
 *    dicen 'wompi' incluyendo efectivo y transferencias manuales. Lo que sí es
 *    señal es una referencia de pasarela o el canal 'online': eso solo lo escribe
 *    el checkout/webhook.
 * 2. Para NOMBRAR la pasarela sí se lee `payment_provider`, pero solo se cree el
 *    valor cuando NO es el default: 'mercadopago' alguien lo escribió a propósito.
 *    Con 'wompi' se asume Wompi, que es la única otra pasarela integrada.
 * 3. Un pago sin método registrado se dice "sin registrar". No se rellena.
 */

export type PaymentOriginKind =
    | 'gateway'
    | 'cash'
    | 'transfer_receipt'
    | 'transfer_manual'
    | 'card_manual'
    | 'pse_manual'
    | 'other'
    | 'unknown';

export interface PaymentOriginInput {
    payment_method?: string | null;
    payment_channel?: string | null;
    payment_provider?: string | null;
    receipt_url?: string | null;
    wompi_reference?: string | null;
    wompi_transaction_id?: string | null;
    provider_transaction_id?: string | null;
    qr_id?: string | null;
}

export interface PaymentOrigin {
    kind: PaymentOriginKind;
    /**
     * Etiqueta del badge. Corta a propósito (una palabra donde se pueda): vive en
     * una celda de tabla, y una etiqueta larga partía la pastilla en dos líneas
     * dejando el texto cruzado por el borde inferior, como si estuviera tachado.
     */
    label: string;
    /** Matiz que va DEBAJO del badge, no dentro ("sin soporte", "Tarjeta"). */
    qualifier: string | null;
    /** Explicación completa para el tooltip/title. */
    detail: string;
    /** El cobro nació de una inscripción por QR. */
    viaQr: boolean;
}

/** ¿Lo confirmó una pasarela? Ver regla 1 del encabezado. */
export function isGatewayPayment(p: PaymentOriginInput): boolean {
    // Un comprobante subido implica validación manual: lo sube una persona, no un
    // webhook. Gana sobre cualquier sello de provider (había comprobantes marcados
    // 'wompi' por el DEFAULT de la columna).
    if (p.receipt_url) return false;
    return (
        p.payment_channel === 'online' ||
        !!p.wompi_reference ||
        !!p.wompi_transaction_id ||
        !!p.provider_transaction_id
    );
}

/** Nombre de la pasarela. Ver regla 2 del encabezado. */
function gatewayName(provider?: string | null): string {
    return provider === 'mercadopago' ? 'MercadoPago' : 'Wompi';
}

const METHOD_LABEL: Record<string, string> = {
    card: 'Tarjeta',
    pse: 'PSE',
    transfer: 'Transferencia',
    cash: 'Efectivo',
    nequi: 'Nequi',
    bancolombia: 'Bancolombia',
};

export function resolvePaymentOrigin(p: PaymentOriginInput): PaymentOrigin {
    const viaQr = !!p.qr_id;
    const method = (p.payment_method || '').toLowerCase();

    if (isGatewayPayment(p)) {
        const gw = gatewayName(p.payment_provider);
        const via = METHOD_LABEL[method] ?? null;
        return {
            kind: 'gateway',
            label: gw,
            qualifier: via,
            detail: `Pago en línea confirmado por ${gw}${via ? ` (${via})` : ''}. No requiere validación de la escuela.`,
            viaQr,
        };
    }

    if (method === 'cash' || p.payment_channel === 'cash') {
        return {
            kind: 'cash',
            label: 'Efectivo',
            qualifier: null,
            detail: 'Efectivo recibido y registrado por la escuela.',
            viaQr,
        };
    }

    if (method === 'transfer' || p.payment_channel === 'transfer') {
        return p.receipt_url
            ? {
                kind: 'transfer_receipt',
                label: 'Transferencia',
                qualifier: 'con comprobante',
                detail: 'Transferencia con comprobante adjunto, validada por la escuela.',
                viaQr,
            }
            : {
                kind: 'transfer_manual',
                label: 'Transferencia',
                qualifier: 'sin soporte',
                detail: 'Transferencia registrada a mano por la escuela, sin comprobante adjunto.',
                viaQr,
            };
    }

    if (method === 'card') {
        return {
            kind: 'card_manual',
            label: 'Tarjeta',
            qualifier: 'registrada a mano',
            detail: 'Tarjeta registrada a mano por la escuela (no pasó por la pasarela).',
            viaQr,
        };
    }

    if (method === 'pse') {
        return {
            kind: 'pse_manual',
            label: 'PSE',
            qualifier: 'registrado a mano',
            detail: 'PSE registrado a mano por la escuela (no pasó por la pasarela).',
            viaQr,
        };
    }

    if (method === 'other') {
        return {
            kind: 'other',
            label: 'Otro',
            qualifier: null,
            detail: 'Otro medio de pago registrado por la escuela.',
            viaQr,
        };
    }

    if (method) {
        return {
            kind: 'other',
            label: METHOD_LABEL[method] ?? p.payment_method!,
            qualifier: null,
            detail: `Método registrado: ${p.payment_method}.`,
            viaQr,
        };
    }

    return {
        kind: 'unknown',
        label: 'Sin registrar',
        qualifier: null,
        detail: 'El pago no tiene medio registrado. Antes se mostraba como "Transferencia" sin serlo.',
        viaQr,
    };
}

/** Clases del badge por tipo de origen. La pasarela se distingue a propósito. */
export const ORIGIN_BADGE_CLASS: Record<PaymentOriginKind, string> = {
    gateway: 'bg-violet-50 text-violet-700 border-violet-300',
    cash: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    transfer_receipt: 'bg-blue-50 text-blue-700 border-blue-300',
    transfer_manual: 'bg-sky-50 text-sky-700 border-sky-200',
    card_manual: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pse_manual: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    other: 'bg-gray-100 text-gray-700 border-gray-300',
    unknown: 'bg-amber-50 text-amber-700 border-amber-300',
};

/** Opciones para un filtro por origen. */
export const ORIGIN_FILTERS: { value: PaymentOriginKind | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos los orígenes' },
    { value: 'gateway', label: 'Pasarela (Wompi / MercadoPago)' },
    { value: 'transfer_receipt', label: 'Transferencia con comprobante' },
    { value: 'transfer_manual', label: 'Transferencia sin soporte' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'card_manual', label: 'Tarjeta registrada' },
    { value: 'pse_manual', label: 'PSE registrado' },
    { value: 'other', label: 'Otro' },
    { value: 'unknown', label: 'Sin registrar' },
];
