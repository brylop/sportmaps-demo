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
            // CO requiere entityType. 'individual' = persona natural.
            entityType: 'individual' as const,
        },
    }), [transactionAmount, payerEmail, payerFirstName, payerLastName]);

    // Nota: NO incluir `mercadoPago` aqui — ese campo requiere `preferenceId`
    // que solo se usa con Checkout Pro. Nuestro flujo (Checkout API direct con
    // token tokenizado por el Brick) no necesita preferencia.
    const customization = useMemo(() => ({
        paymentMethods: {
            creditCard: 'all' as const,
            debitCard: 'all' as const,
            bankTransfer: 'all' as const,         // PSE en CO
            ticket: 'all' as const,               // Efectivo (Efecty/Baloto)
            maxInstallments: 12,
        },
        visual: {
            style: {
                theme: 'default' as const,
            },
        },
    }), []);

    const onSubmit = useCallback(async (param: any) => {
        if (submitting) return;
        setSubmitting(true);

        // MP SDK v1.x puede entregar el callback con shape:
        //   ({ selectedPaymentMethod, formData })  → nested
        //   (formData)                              → flat
        // Tomamos el primer shape no-vacio.
        const fd = param?.formData && typeof param.formData === 'object' ? param.formData : param;
        // eslint-disable-next-line no-console
        console.debug('[MP Brick] onSubmit raw param', param);
        // eslint-disable-next-line no-console
        console.debug('[MP Brick] resolved formData', fd);

        try {
            const result = await createMpPayment(
                {
                    token: fd?.token,
                    paymentMethodId: fd?.payment_method_id ?? fd?.paymentMethodId,
                    installments: fd?.installments ?? 1,
                    payerEmail: fd?.payer?.email ?? payerEmail,
                    payerFirstName,
                    payerLastName,
                    payerIdentification: fd?.payer?.identification
                        ? { type: fd.payer.identification.type, number: fd.payer.identification.number }
                        : undefined,
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

    // Guard: no renderizamos el Brick hasta que tengamos un monto valido. MP
    // CO exige minimo aprox 2.500 COP para tarjeta y montos mas altos para
    // PSE/efectivo. Bajo eso el iframe falla con 422 y warnings ruidosos.
    // IMPORTANT: este check va DESPUES de todos los hooks para no violar
    // Rules of Hooks (mismo numero de hooks por render).
    const minAmount = 2500;
    if (!transactionAmount || transactionAmount < minAmount) {
        return (
            <div className="mp-brick-wrapper">
                <p className="text-sm text-orange-600">
                    El monto minimo para pagar con MercadoPago es ${minAmount.toLocaleString('es-CO')} COP.
                </p>
            </div>
        );
    }

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
