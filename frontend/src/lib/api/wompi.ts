// Wompi Payment Gateway Integration Service
// La firma de integridad se genera en el servidor (Edge Function)
// El cliente NUNCA debe tener acceso al WOMPI_INTEGRITY_SECRET

import { supabase } from '@/integrations/supabase/client';

const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

if (!WOMPI_PUBLIC_KEY) {
    console.error('❌ VITE_WOMPI_PUBLIC_KEY no configurado. Agrega la variable de entorno.');
}

/**
 * Genera una referencia única para iniciar un checkout de Wompi.
 * Prefijo `SCH-` indica pago de escuela (ver bff/src/routes/wompi.ts:128).
 */
export function generatePaymentReference(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `SCH-${ts}-${rand}`;
}

export interface WompiCheckoutConfig {
    reference: string;
    amountInCents: number;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    redirectUrl?: string;
    // SportMaps metadata
    studentName?: string;
    teamName?: string;
    schoolName?: string;
    schoolId?: string;
}

export interface WompiTransactionResult {
    id: string;
    status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'PENDING';
    reference: string;
    amountInCents: number;
    currency: string;
    paymentMethodType: string;
    createdAt: string;
}

/**
 * Obtiene la firma de integridad DESDE EL SERVIDOR.
 * La Edge Function usa el WOMPI_INTEGRITY_SECRET que nunca sale del servidor.
 *
 * ⚠️ Si la Edge Function no está desplegada, el pago no puede proceder en producción.
 */
/**
 * Resultado autoritativo del servidor: firma + monto que DEBE pasarse al Widget.
 * El monto puede diferir del que envió el cliente si fue tampered — el EF
 * siempre devuelve el monto real de la BD.
 */
interface IntegritySignatureResult {
    signature: string;
    amountInCents: number;
    currency: string;
}

async function getIntegritySignature(
    reference: string,
    currency: string = 'COP',
): Promise<IntegritySignatureResult> {
    if (!SUPABASE_URL) {
        throw new Error('VITE_SUPABASE_URL no configurado');
    }

    // Necesitamos el JWT de la sesión del usuario (NO la anon key) para que
    // el Edge Function pueda verificar ownership de la referencia.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Sesión de usuario expirada. Vuelve a iniciar sesión.');
    }
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

    const response = await fetch(`${SUPABASE_URL}/functions/v1/wompi-sign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': anonKey,
        },
        body: JSON.stringify({ reference, currency }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error generando firma: ${response.status} — ${errorBody}`);
    }

    const data = await response.json();
    if (!data.signature || typeof data.amount_in_cents !== 'number') {
        throw new Error('Respuesta de firma inválida desde el servidor');
    }

    return {
        signature: data.signature,
        amountInCents: data.amount_in_cents,
        currency: data.currency ?? currency,
    };
}

/**
 * Abre el Widget de Checkout de Wompi.
 * La firma se solicita al servidor; el WOMPI_INTEGRITY_SECRET nunca está en el cliente.
 */
export async function openWompiCheckout(
    config: WompiCheckoutConfig
): Promise<WompiTransactionResult | null> {
    const {
        reference,
        amountInCents,
        customerEmail,
        customerName,
        customerPhone,
        redirectUrl,
        schoolId,
    } = config;

    if (!WOMPI_PUBLIC_KEY) {
        console.error('❌ WOMPI_PUBLIC_KEY no configurada. Verifica las variables de entorno.');
        return null;
    }

    let signature: string;
    // El servidor es la fuente de verdad para el monto. Si el cliente envió
    // un monto tampered, lo sobreescribimos con el que devuelve el EF.
    let effectiveAmountInCents = amountInCents;
    try {
        const result = await getIntegritySignature(reference, 'COP');
        signature = result.signature;
        effectiveAmountInCents = result.amountInCents;
        if (result.amountInCents !== amountInCents) {
            console.warn(
                `⚠️ amountInCents del cliente (${amountInCents}) difiere del servidor ` +
                `(${result.amountInCents}). Usando el del servidor.`,
            );
        }
    } catch (err) {
        console.error('❌ No se pudo generar la firma de integridad:', err);
        // En sandbox se puede continuar sin firma (modo de prueba)
        // En producción: retornar null para bloquear el pago
        if (import.meta.env.PROD) {
            return null;
        }
        // Fallback SOLO sandbox — nunca llega a producción
        console.warn('⚠️ Usando modo sandbox sin firma (solo desarrollo)');
        signature = '';
    }

    return new Promise((resolve) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const WidgetCheckout = (window as any).WidgetCheckout;

            if (!WidgetCheckout) {
                console.error('❌ Wompi WidgetCheckout no cargado. Verifica el script en index.html.');
                resolve(null);
                return;
            }

            const widgetConfig: Record<string, unknown> = {
                currency: 'COP',
                amountInCents: effectiveAmountInCents,
                reference,
                publicKey: WOMPI_PUBLIC_KEY,
                redirectUrl: redirectUrl || `${window.location.origin}/payment-result`,
                customerData: {
                    email: customerEmail,
                    fullName: customerName,
                    phoneNumber: customerPhone || '',
                    phoneNumberPrefix: '+57',
                },
            };

            // Solo incluir firma si se obtuvo del servidor
            if (signature) {
                widgetConfig.signature = { integrity: signature };
            }

            const checkout = new WidgetCheckout(widgetConfig);

            checkout.open((result: { transaction: WompiTransactionResult }) => {
                const transaction = result.transaction;
                console.log('📦 Wompi transaction result:', transaction.status, transaction.reference);
                resolve(transaction);
            });
        } catch (error) {
            console.error('❌ Error abriendo Wompi checkout:', error);
            resolve(null);
        }
    });
}

/**
 * Verifica el status de una transacción vía API de Wompi.
 * Útil para polling desde la página /payment-result.
 * Usa sandbox o producción según la PUBLIC_KEY configurada.
 */
export async function checkTransactionStatus(transactionId: string): Promise<WompiTransactionResult | null> {
    // Detectar entorno por la public key
    const isSandbox = WOMPI_PUBLIC_KEY?.startsWith('pub_test_') ?? true;
    const baseUrl = isSandbox
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1';

    try {
        const response = await fetch(`${baseUrl}/transactions/${transactionId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return {
            id: data.data.id,
            status: data.data.status,
            reference: data.data.reference,
            amountInCents: data.data.amount_in_cents,
            currency: data.data.currency,
            paymentMethodType: data.data.payment_method_type || 'UNKNOWN',
            createdAt: data.data.created_at,
        };
    } catch (error) {
        console.error('Error verificando status de transacción:', error);
        return null;
    }
}
