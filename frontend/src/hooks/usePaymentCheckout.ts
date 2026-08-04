/**
 * usePaymentCheckout — Hook provider-aware (Wompi + MercadoPago).
 *
 * El BFF devuelve { provider, publicKey, sandbox, reference, transactionAmount, ... }
 * cuando se inicia una sesion de pago. Este hook expone un objeto `session`
 * que el componente padre usa para decidir como renderizar:
 *
 *  - provider === 'wompi'      → llamar `launchWidget()` que abre el Widget Wompi.
 *  - provider === 'mercadopago' → renderizar <PaymentProviderGate /> o
 *    <MercadoPagoBrick /> con los datos de session.
 *
 * Uso recomendado:
 *
 *   const { initiate, session, loading, error, launchWidget } =
 *       usePaymentCheckout({ onSuccess, onError });
 *
 *   <button onClick={() => initiate('school', { paymentId, ... })}>Pagar</button>
 *   {session?.provider === 'mercadopago' && (
 *       <MercadoPagoBrick {...mpPropsFrom(session)} />
 *   )}
 *   {session?.provider === 'wompi' && (
 *       <button onClick={launchWidget}>Pagar con Wompi</button>
 *   )}
 *
 * Mantiene compatibilidad con `useWompiCheckout` (los flujos existentes
 * pueden seguir usandolo) hasta que se migren a este.
 */

import { useCallback, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { openWompiCheckout, type WompiTransactionResult } from '@/lib/api/wompi';
import type { MpCreatePaymentResult } from '@/lib/api/mercadopago';
import { useAuth } from '@/contexts/AuthContext';
import type { PaymentProvider } from '@/types/payments';

export interface CheckoutSession {
    provider: PaymentProvider;
    publicKey: string | null;
    sandbox: boolean;
    reference: string;
    /** Monto en COP decimal (p.ej. 50000 = 50.000 pesos). */
    transactionAmount: number;
    /** Equivalente en cents (Wompi). */
    amountInCents: number;
    /** Datos de contexto: school/vendor para resolver providers en MP. */
    schoolId?: string | null;
    vendorId?: string | null;
    /** Datos del payer (para el Brick MP). */
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    schoolName?: string;
    studentName?: string;
    teamName?: string;
    description?: string;
    /** Identificador de la entidad raiz (para tracking) */
    orderId?: string;
}

export type CheckoutKind =
    | 'school'
    | 'service'
    | 'event'
    | 'subscription'
    | 'pay'
    | 'session-booking'
    | 'cart';

interface InitiateOptions {
    preferredProvider?: PaymentProvider;
}

interface UseOpts {
    onSuccess?: (result: WompiTransactionResult | MpCreatePaymentResult) => void;
    onError?: (err: Error) => void;
    onClosed?: () => void;
}

export function usePaymentCheckout({ onSuccess, onError, onClosed }: UseOpts = {}) {
    const { user, profile } = useAuth();
    const [session, setSession] = useState<CheckoutSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onClosedRef = useRef(onClosed);
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onClosedRef.current = onClosed;

    const reset = useCallback(() => {
        setSession(null);
        setError(null);
    }, []);

    const initiate = useCallback(async (
        kind: CheckoutKind,
        payload: Record<string, unknown>,
        opts?: InitiateOptions,
    ): Promise<CheckoutSession | null> => {
        setLoading(true);
        setError(null);
        try {
            const body = { ...payload, ...(opts?.preferredProvider ? { preferredProvider: opts.preferredProvider } : {}) };

            let res: any;
            switch (kind) {
                case 'school':
                    res = await bffClient.post<any>('/api/v1/payments/create-session', body);
                    res = { data: res };  // este endpoint no envuelve en {ok,data}
                    break;
                case 'service':
                    res = await bffClient.post('/api/v1/marketplace/checkout/service', body);
                    break;
                case 'event':
                    res = await bffClient.post('/api/v1/marketplace/checkout/event', body);
                    break;
                case 'subscription':
                    res = await bffClient.post('/api/v1/marketplace/checkout/subscription', body);
                    break;
                case 'pay':
                    res = await bffClient.post('/api/v1/marketplace/checkout/pay', body);
                    break;
                case 'session-booking':
                    res = await bffClient.post('/api/v1/marketplace/checkout/session-booking', body);
                    break;
                case 'cart':
                    res = await bffClient.post('/api/v1/marketplace/checkout/cart', body);
                    break;
                default:
                    throw new Error(`Unknown checkout kind: ${kind}`);
            }

            const raw = (res as any)?.data ?? res;

            // Free / courtesy / trial: BFF responde sin reference
            if (!raw?.reference) {
                onSuccessRef.current?.({} as WompiTransactionResult);
                return null;
            }

            const newSession: CheckoutSession = {
                provider: (raw.provider as PaymentProvider) ?? 'wompi',
                publicKey: raw.publicKey ?? null,
                sandbox: raw.sandbox ?? true,
                reference: raw.reference,
                transactionAmount: Number(raw.transactionAmount ?? raw.grossAmount ?? raw.amountInCents / 100),
                amountInCents: Number(raw.amountInCents ?? Math.round((raw.transactionAmount ?? 0) * 100)),
                schoolId: (payload.schoolId as string) ?? null,
                vendorId: (payload.vendorId as string) ?? null,
                customerEmail: (payload.contactEmail as string) ?? user?.email ?? '',
                customerName: (payload.customerName as string) ?? profile?.full_name ?? 'Cliente',
                customerPhone: (payload.contactPhone as string) ?? undefined,
                schoolName: (payload.schoolName as string) ?? undefined,
                studentName: (payload.studentName as string) ?? undefined,
                teamName: (payload.teamName as string) ?? undefined,
                description: (payload.description as string) ?? undefined,
                orderId: raw.orderId ?? raw.bookingId ?? raw.transactionId ?? undefined,
            };

            setSession(newSession);
            return newSession;
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    /**
     * Para Wompi: dispara el Widget. Para MP: no-op (el Brick se renderiza
     * declarativamente por el caller).
     */
    const launchWidget = useCallback(async (): Promise<WompiTransactionResult | null> => {
        if (!session || session.provider !== 'wompi') return null;

        const tx = await openWompiCheckout({
            reference: session.reference,
            amountInCents: session.amountInCents,
            customerEmail: session.customerEmail,
            customerName: session.customerName,
            customerPhone: session.customerPhone,
            schoolId: session.schoolId ?? undefined,
            schoolName: session.schoolName,
            studentName: session.studentName,
            teamName: session.teamName,
        });

        if (tx?.status === 'APPROVED') {
            onSuccessRef.current?.(tx);
        } else if (tx?.status === 'DECLINED' || tx?.status === 'ERROR') {
            onErrorRef.current?.(new Error(`Pago ${tx.status.toLowerCase()}`));
        } else {
            onClosedRef.current?.();
        }
        return tx;
    }, [session]);

    /**
     * Hook para que el caller notifique el resultado del Brick MP.
     */
    const handleMpResult = useCallback((result: MpCreatePaymentResult) => {
        if (result.internalStatus === 'paid' || result.internalStatus === 'pending') {
            onSuccessRef.current?.(result);
        } else {
            onErrorRef.current?.(new Error(`MP ${result.statusDetail}`));
        }
    }, []);

    return {
        session,
        loading,
        error,
        initiate,
        launchWidget,
        handleMpResult,
        reset,
    };
}
