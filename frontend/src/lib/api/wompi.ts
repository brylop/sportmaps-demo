// Wompi Payment Gateway Integration Service
// Uses the Widget Checkout (custom button) approach for React/SPA

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY || 'pub_test_ggS32tfWAjT9XqfawDcxIuyVhPRslIXJ';

// Integrity secret for TEST/SANDBOX — in production, signature is generated server-side only
const WOMPI_INTEGRITY_SECRET = 'test_integrity_LrN9ny6kwmMjrrT6FHcBcLG7Xab1lOBe';

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
 * Generate a unique payment reference
 * Format: SPM-<timestamp>-<random>
 */
export function generatePaymentReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SPM-${timestamp}-${random}`;
}

/**
 * Generate the integrity signature (SHA-256)
 * In production this should ONLY be done server-side.
 * For the demo/sandbox, we generate it client-side using the test integrity secret.
 */
async function generateIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string = 'COP',
    schoolId?: string
): Promise<string> {
    // Try backend first
    if (BACKEND_URL) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/payments/wompi/create-signature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reference,
                    amount_in_cents: amountInCents,
                    currency,
                    school_id: schoolId
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.signature;
            }
        } catch (e) {
            console.warn('Backend signature failed, using client-side fallback:', e);
        }
    }

    // Client-side fallback for sandbox/demo
    const concatenated = `${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`;
    const encodedText = new TextEncoder().encode(concatenated);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedText);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Open the Wompi Widget Checkout programmatically
 * Returns a promise that resolves with the transaction result
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
    } = config;

    // Generate the integrity signature
    const signature = await generateIntegritySignature(reference, amountInCents);

    return new Promise((resolve) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const WidgetCheckout = (window as any).WidgetCheckout;

            if (!WidgetCheckout) {
                console.error('Wompi WidgetCheckout not loaded. Check index.html script tag.');
                resolve(null);
                return;
            }

            const checkout = new WidgetCheckout({
                currency: 'COP',
                amountInCents,
                reference,
                publicKey: WOMPI_PUBLIC_KEY,
                signature: { integrity: signature },
                redirectUrl: redirectUrl || `${window.location.origin}/payment-result`,
                customerData: {
                    email: customerEmail,
                    fullName: customerName,
                    phoneNumber: customerPhone || '3001234567',
                    phoneNumberPrefix: '+57',
                    legalId: '1234567890',
                    legalIdType: 'CC',
                },
            });

            checkout.open((result: { transaction: WompiTransactionResult }) => {
                const transaction = result.transaction;
                console.log('Wompi transaction result:', transaction);
                resolve(transaction);
            });
        } catch (error) {
            console.error('Error opening Wompi checkout:', error);
            resolve(null);
        }
    });
}

/**
 * Check transaction status via Wompi API
 */
export async function checkTransactionStatus(transactionId: string): Promise<WompiTransactionResult | null> {
    try {
        const response = await fetch(`https://sandbox.wompi.co/v1/transactions/${transactionId}`);
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
        console.error('Error checking transaction status:', error);
        return null;
    }
}
