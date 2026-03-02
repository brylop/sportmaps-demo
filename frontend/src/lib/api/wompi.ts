// Wompi Payment Gateway Integration Service
// La firma de integridad se genera en el servidor (Edge Function)
// El cliente NUNCA debe tener acceso al WOMPI_INTEGRITY_SECRET

const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

if (!WOMPI_PUBLIC_KEY) {
    console.error('❌ VITE_WOMPI_PUBLIC_KEY no configurado. Agrega la variable de entorno.');
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
    programName?: string;
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
 * Genera una referencia de pago única.
 * Format: SPM-<timestamp>-<random>
 */
export function generatePaymentReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SPM-${timestamp}-${random}`;
}

/**
 * Obtiene la firma de integridad DESDE EL SERVIDOR.
 * La Edge Function usa el WOMPI_INTEGRITY_SECRET que nunca sale del servidor.
 *
 * ⚠️ Si la Edge Function no está desplegada, el pago no puede proceder en producción.
 */
async function getIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string = 'COP',
    schoolId?: string
): Promise<string> {
    if (!SUPABASE_URL) {
        throw new Error('VITE_SUPABASE_URL no configurado');
    }

    // Supabase anon key para llamar Edge Functions públicas con autenticación
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/wompi-sign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey ?? '',
        },
        body: JSON.stringify({
            reference,
            amount_in_cents: amountInCents,
            currency,
            school_id: schoolId,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error generando firma: ${response.status} — ${errorBody}`);
    }

    const data = await response.json();
    if (!data.signature) {
        throw new Error('Respuesta de firma inválida desde el servidor');
    }

    return data.signature;
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
    try {
        signature = await getIntegritySignature(reference, amountInCents, 'COP', schoolId);
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
                amountInCents,
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
