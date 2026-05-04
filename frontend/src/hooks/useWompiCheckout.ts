/**
 * useWompiCheckout — Hook unificado para abrir el Widget de Wompi.
 *
 * Reemplaza al antiguo useEPaycoCheckout.
 *
 * Uso:
 *   const { startSchoolPayment, startServiceCheckout, startEventCheckout,
 *           startSubscriptionCheckout, startCartCheckout, startGenericPay,
 *           loading, error } = useWompiCheckout({ onSuccess, onError, onClosed });
 *
 * Cada `start*` hace dos pasos:
 *   1. Llama al BFF para crear la transaccion logica → recibe { reference, amountInCents }
 *   2. Llama a `openWompiCheckout` (lib/api/wompi) que pide la firma a la
 *      Edge Function `wompi-sign` y abre el Widget.
 *
 * El estado real de pago llega via webhook al BFF; el frontend solo navega
 * a la pagina de resultado y hace polling sobre Supabase si lo necesita.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { openWompiCheckout, type WompiTransactionResult } from '@/lib/api/wompi';
import { useAuth } from '@/contexts/AuthContext';

// ── Payloads aceptados por cada flujo ────────────────────────────────────────

interface SchoolPaymentPayload {
    paymentId: string;
    enrollmentId?: string;
    schoolId?: string;
    schoolName?: string;
    studentName?: string;
    teamName?: string;
}

interface ServiceCheckoutPayload {
    appointmentId: string;
    serviceListingId?: string;
    serviceVariationId?: string;
    description?: string;
}

interface EventCheckoutPayload {
    eventRegistrationId: string;
    description?: string;
}

interface SubscriptionCheckoutPayload {
    planId: string;
    description?: string;
}

interface GenericPayPayload {
    transactionId: string;
    description?: string;
}

interface CartItem {
    productId: string;
    variantId?: string;
    quantity: number;
}

interface ShippingAddress {
    line1: string;
    line2?: string;
    city: string;
    department: string;
    postalCode?: string;
}

interface SessionBookingCheckoutPayload {
    bookingId: string;
}

interface CartCheckoutPayload {
    items: CartItem[];
    shippingAddress: ShippingAddress;
    contactPhone: string;
    contactEmail: string;
    customerName: string;
    customerDocument?: string;
    notes?: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseWompiCheckoutOptions {
    onSuccess?: (tx: WompiTransactionResult) => void;
    onError?: (err: Error) => void;
    onClosed?: () => void;
}

export function useWompiCheckout({ onSuccess, onError, onClosed }: UseWompiCheckoutOptions = {}) {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onClosedRef = useRef(onClosed);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        onClosedRef.current = onClosed;
    }, [onSuccess, onError, onClosed]);

    // Helper interno: dispara el Widget Wompi con la reference + monto recibidos del BFF
    const launchWidget = useCallback(async (params: {
        reference: string;
        amountInCents: number;
        customerEmail?: string;
        customerName?: string;
        customerPhone?: string;
        schoolId?: string;
        schoolName?: string;
        studentName?: string;
        teamName?: string;
    }): Promise<WompiTransactionResult | null> => {
        const tx = await openWompiCheckout({
            reference: params.reference,
            amountInCents: params.amountInCents,
            customerEmail: params.customerEmail || user?.email || '',
            customerName: params.customerName || profile?.full_name || 'Cliente',
            customerPhone: params.customerPhone,
            schoolId: params.schoolId,
            schoolName: params.schoolName,
            studentName: params.studentName,
            teamName: params.teamName,
        });

        if (tx?.status === 'APPROVED') {
            onSuccessRef.current?.(tx);
        } else if (tx?.status === 'DECLINED' || tx?.status === 'ERROR') {
            onErrorRef.current?.(new Error(`Pago ${tx.status.toLowerCase()}`));
        } else {
            onClosedRef.current?.();
        }
        return tx;
    }, [user, profile]);

    // ── Flujos publicos ─────────────────────────────────────────────────────

    const startSchoolPayment = useCallback(async (payload: SchoolPaymentPayload) => {
        setLoading(true);
        setError(null);
        try {
            const data = await bffClient.post<{
                reference: string;
                amountInCents: number;
                grossAmount: number;
                baseAmount: number;
                sportmapsFee: number;
                feePct: number;
            }>('/api/v1/payments/create-session', {
                paymentId: payload.paymentId,
                ...(payload.enrollmentId ? { enrollmentId: payload.enrollmentId } : {}),
            });

            return await launchWidget({
                reference: data.reference,
                amountInCents: data.amountInCents,
                schoolId: payload.schoolId,
                schoolName: payload.schoolName,
                studentName: payload.studentName,
                teamName: payload.teamName,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startServiceCheckout = useCallback(async (payload: ServiceCheckoutPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: { reference: string; amountInCents: number; is_courtesy?: boolean };
                error?: string;
            }>('/api/v1/marketplace/checkout/service', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error creando checkout de servicio.');
            }

            if (res.data.is_courtesy) {
                onSuccessRef.current?.({} as WompiTransactionResult);
                return null;
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startEventCheckout = useCallback(async (payload: EventCheckoutPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: { reference: string; amountInCents: number; is_free?: boolean };
                error?: string;
            }>('/api/v1/marketplace/checkout/event', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error creando checkout de evento.');
            }

            if (res.data.is_free) {
                onSuccessRef.current?.({} as WompiTransactionResult);
                return null;
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startSubscriptionCheckout = useCallback(async (payload: SubscriptionCheckoutPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: { reference: string; amountInCents: number; is_trial?: boolean };
                error?: string;
            }>('/api/v1/marketplace/checkout/subscription', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error creando suscripcion.');
            }

            if (res.data.is_trial) {
                onSuccessRef.current?.({} as WompiTransactionResult);
                return null;
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando la suscripcion.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startGenericPay = useCallback(async (payload: GenericPayPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: { reference: string; amountInCents: number };
                error?: string;
            }>('/api/v1/marketplace/checkout/pay', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error iniciando pago.');
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startSessionBookingCheckout = useCallback(async (payload: SessionBookingCheckoutPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: { reference: string; amountInCents: number; is_free?: boolean; bookingId: string };
                error?: string;
            }>('/api/v1/marketplace/checkout/session-booking', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error creando checkout de reserva.');
            }

            if (res.data.is_free) {
                onSuccessRef.current?.({} as WompiTransactionResult);
                return null;
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago de la reserva.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    const startCartCheckout = useCallback(async (payload: CartCheckoutPayload) => {
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.post<{
                ok: boolean;
                data?: {
                    orderId: string;
                    reference: string;
                    amountInCents: number;
                    grossAmount: number;
                    subtotal: number;
                    taxTotal: number;
                    shippingCost: number;
                };
                error?: string;
            }>('/api/v1/marketplace/checkout/cart', payload);

            if (!res.ok || !res.data) {
                throw new Error(res.error || 'Error creando orden.');
            }

            return await launchWidget({
                reference: res.data.reference,
                amountInCents: res.data.amountInCents,
                customerEmail: payload.contactEmail,
                customerName: payload.customerName,
                customerPhone: payload.contactPhone,
            });
        } catch (err: any) {
            const msg = err?.message || 'Error iniciando el pago de la orden.';
            setError(msg);
            onErrorRef.current?.(new Error(msg));
            return null;
        } finally {
            setLoading(false);
        }
    }, [launchWidget]);

    return {
        loading,
        error,
        startSchoolPayment,
        startServiceCheckout,
        startEventCheckout,
        startSubscriptionCheckout,
        startGenericPay,
        startCartCheckout,
        startSessionBookingCheckout,
    };
}
