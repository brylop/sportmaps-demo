/**
 * useEPaycoCheckout — Hook para abrir el checkout de ePayco
 *
 * Flujo:
 * 1. Llama al BFF POST /api/v1/payments/create-session → obtiene sessionId
 * 2. Inyecta dinámicamente checkout-v2.js (solo una vez por sesión)
 * 3. Configura ePayco.checkout y abre el widget onpage
 *
 * Seguridad:
 * - El frontend NUNCA envía el monto → el BFF lo calcula desde la BD
 * - El frontend solo recibe sessionId (temporal) → nunca claves privadas
 * - El status real del pago viene del webhook → el frontend hace polling a Supabase
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { bffClient } from '@/lib/api/bffClient';

const EPAYCO_SCRIPT_URL = 'https://checkout.epayco.co/checkout-v2.js';

// Flag a nivel de módulo para no duplicar el <script>
let scriptLoaded = false;
let scriptLoading = false;

interface CreateSessionResponse {
    sessionId: string;
    token: string;
    grossAmount: number;
    baseAmount: number;
    sportmapsFee: number;
    feePct: number;
}

interface UseEPaycoCheckoutOptions {
    paymentId: string;
    enrollmentId?: string;
    onSuccess?: () => void;
    onError?: (err: Error) => void;
    onClosed?: () => void;
}

interface UseEPaycoCheckoutReturn {
    /** Llama al BFF, carga el script y abre el checkout */
    openCheckout: () => Promise<void>;
    /** Datos de la sesión creada (disponibles después de openCheckout) */
    sessionData: CreateSessionResponse | null;
    /** true mientras se crea la sesión o carga el script */
    loading: boolean;
    /** Error si ocurrió alguno */
    error: string | null;
}

function loadEpaycoScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (scriptLoaded) return resolve();
        if (scriptLoading) {
            // Si ya se está cargando, esperar a que termine
            const interval = setInterval(() => {
                if (scriptLoaded) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
            return;
        }

        scriptLoading = true;
        const script = document.createElement('script');
        script.src = EPAYCO_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            scriptLoaded = true;
            scriptLoading = false;
            resolve();
        };
        script.onerror = () => {
            scriptLoading = false;
            reject(new Error('No se pudo cargar el script de ePayco. Verifica tu conexión a internet.'));
        };
        document.head.appendChild(script);
    });
}

export function useEPaycoCheckout({
    paymentId,
    enrollmentId,
    onSuccess,
    onError,
    onClosed,
}: UseEPaycoCheckoutOptions): UseEPaycoCheckoutReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<CreateSessionResponse | null>(null);

    // Refs para callbacks actualizados (evitar stale closures)
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onClosedRef = useRef(onClosed);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        onClosedRef.current = onClosed;
    }, [onSuccess, onError, onClosed]);

    const openCheckout = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // ── 1. Crear sesión en el BFF ─────────────────────────────────────
            const data = await bffClient.post<CreateSessionResponse>(
                '/api/v1/payments/create-session',
                {
                    paymentId,
                    ...(enrollmentId ? { enrollmentId } : {}),
                },
            );

            setSessionData(data);

            // ── 2. Cargar script de ePayco ────────────────────────────────────
            await loadEpaycoScript();

            // ── 3. Verificar que el objeto global exista ──────────────────────
            const ePayco = (window as any).ePayco;
            if (!ePayco?.checkout) {
                throw new Error('El módulo de checkout de ePayco no se inicializó correctamente.');
            }

            // ── 4. Configurar y abrir el checkout ─────────────────────────────
            const isTestMode = import.meta.env.VITE_EPAYCO_TEST === 'true';

            const checkout = ePayco.checkout.configure({
                sessionId: data.sessionId,
                type: 'onpage', // iframe dentro de la página
                test: isTestMode,
            });

            // Eventos del checkout
            if (checkout.on) {
                checkout.on('onCreated', () => {
                    // La sesión se creó correctamente en ePayco
                });
                checkout.on('onErrors', (err: any) => {
                    const msg = typeof err === 'string' ? err : 'Error en el proceso de pago.';
                    setError(msg);
                    onErrorRef.current?.(new Error(msg));
                });
                checkout.on('onClosed', () => {
                    onClosedRef.current?.();
                });
            }

            checkout.open();
        } catch (err: any) {
            const message = err?.message || 'Error al iniciar el pago online.';
            setError(message);
            onErrorRef.current?.(new Error(message));
        } finally {
            setLoading(false);
        }
    }, [paymentId, enrollmentId]);

    return { openCheckout, sessionData, loading, error };
}
