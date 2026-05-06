import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { createMpPayment, type MpCreatePaymentResult } from '@/lib/api/mercadopago';

interface Props {
    publicKey: string;
    sandbox?: boolean;
    transactionAmount: number;
    externalReference: string;
    payerEmail: string;
    payerFirstName?: string;
    payerLastName?: string;
    description?: string;
    schoolId?: string | null;
    vendorId?: string | null;
    authToken?: string;
    onSuccess?: (result: MpCreatePaymentResult) => void;
    onError?: (err: Error) => void;
    onPending?: (result: MpCreatePaymentResult) => void;
}

/**
 * Wrapper del Payment Brick de MercadoPago.
 * Renderiza el componente unificado que cubre tarjeta + PSE + efectivo + wallet
 * MP. La SDK se inicializa una sola vez por publicKey.
 *
 * Flujo:
 *  1. initMercadoPago(publicKey) — global SDK init.
 *  2. <Payment /> renderiza el componente.
 *  3. onSubmit → llama createMpPayment al BFF con { token, paymentMethodId, ... }.
 *  4. onSuccess/onPending/onError segun status retornado.
 */
export function MercadoPagoBrick({
    publicKey,
    sandbox = true,
    transactionAmount,
    externalReference,
    payerEmail,
    payerFirstName,
    payerLastName,
    description,
    schoolId,
    vendorId,
    authToken,
    onSuccess,
    onError,
    onPending,
}: Props) {
    const initialized = useRef(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!initialized.current) {
            initMercadoPago(publicKey, { locale: 'es-CO' });
            initialized.current = true;
        }
    }, [publicKey]);

    // Memoizar initialization y customization para que no cambien la referencia
    // en cada render — sino el SDK MP re-monta el iframe y el form pierde lo
    // que el usuario haya escrito (numero de tarjeta, etc.).
    const initialization = useMemo(() => ({
        amount: transactionAmount,
        payer: {
            email: payerEmail,
            firstName: payerFirstName,
            lastName: payerLastName,
        },
    }), [transactionAmount, payerEmail, payerFirstName, payerLastName]);

    const customization = useMemo(() => ({
        paymentMethods: {
            creditCard: 'all' as const,
            debitCard: 'all' as const,
            bankTransfer: 'all' as const,         // PSE en CO
            ticket: 'all' as const,               // Efectivo (Efecty/Baloto)
            mercadoPago: 'all' as const,          // Wallet MP
            maxInstallments: 12,
        },
        visual: {
            style: {
                theme: 'default' as const,
            },
        },
    }), []);

    const onSubmit = useCallback(async (formData: any) => {
        if (submitting) return;
        setSubmitting(true);

        try {
            const result = await createMpPayment(
                {
                    token: formData.formData?.token ?? formData.token,
                    paymentMethodId: formData.formData?.payment_method_id ?? formData.payment_method_id,
                    installments: formData.formData?.installments ?? formData.installments ?? 1,
                    payerEmail: formData.formData?.payer?.email ?? payerEmail,
                    payerFirstName,
                    payerLastName,
                    transactionAmount,
                    description: description ?? `SportMaps ${externalReference}`,
                    externalReference,
                    schoolId,
                    vendorId,
                },
                authToken,
            );

            if (result.internalStatus === 'paid') {
                onSuccess?.(result);
            } else if (result.internalStatus === 'pending') {
                onPending?.(result);
            } else {
                onError?.(new Error(`MP rechazo: ${result.statusDetail}`));
            }
        } catch (err: any) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setSubmitting(false);
        }
    }, [submitting, payerEmail, payerFirstName, payerLastName, transactionAmount, description, externalReference, schoolId, vendorId, authToken, onSuccess, onPending, onError]);

    const onErrorBrick = useCallback((err: any) => {
        console.error('[MercadoPagoBrick] error', err);
        onError?.(new Error(err?.message ?? 'Error en el Brick'));
    }, [onError]);

    return (
        <div className="mp-brick-wrapper">
            {sandbox && (
                <p className="mb-2 text-xs text-yellow-600">
                    Modo sandbox MercadoPago. Usa tarjetas de prueba.
                </p>
            )}
            <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmit}
                onError={onErrorBrick}
            />
        </div>
    );
}

export default MercadoPagoBrick;
