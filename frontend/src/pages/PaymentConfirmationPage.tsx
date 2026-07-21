/**
 * PaymentConfirmationPage — Página pública post-checkout de Wompi
 *
 * Ruta: /pagos/confirmacion?id=<wompi_tx_id>
 *
 * Flujo:
 * 1. Wompi redirige aquí tras completar el pago (con `id` y `env` query params)
 * 2. Lee los query params de Wompi
 * 3. Consulta al BFF GET /api/v1/payments/link/:token para obtener la data
 * 4. Muestra el resultado: éxito, pendiente o error
 *
 * IMPORTANTE: Esta página es PÚBLICA (sin AuthGuard) porque Wompi redirige
 * aquí y el usuario puede no estar autenticado en ese momento.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, Loader2, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

interface PaymentLinkData {
    linkStatus: 'pending' | 'paid' | 'expired' | 'cancelled' | 'declined';
    wompiReference: string | null;
    grossAmount: number;
    baseAmount: number;
    sportmapsFee: number;
    feePct: number;
    expiresAt: string;
    paidAt: string | null;
    concept: string | null;
    childName: string | null;
    schoolName: string | null;
    paymentStatus: string | null;
    nextDueDate: string | null;
}

type PageState = 'loading' | 'success' | 'pending' | 'error' | 'not_found';

function resolveBffUrl(): string {
    // Prioriza la env var (igual que el resto del código). Imprescindible en
    // nativo: en Capacitor el WebView sirve desde hostname 'localhost', y sin
    // esto la app apuntaría a http://localhost:3000 (roto en el dispositivo).
    const envUrl = import.meta.env.VITE_BFF_URL || import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl as string;
    if (typeof window === 'undefined') return 'http://localhost:3000';
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    return 'https://sportmaps-bff.onrender.com';
}

export default function PaymentConfirmationPage() {
    const [searchParams] = useSearchParams();
    const [state, setState] = useState<PageState>('loading');
    const [data, setData] = useState<PaymentLinkData | null>(null);
    const [wompiTxId, setWompiTxId] = useState<string | null>(null);

    useEffect(() => {
        const fetchPaymentData = async () => {
            try {
                // Wompi redirige con `id` (transaction id) y opcional `env`.
                // Aceptamos tambien `token` legacy + reference para compatibilidad.
                const txId = searchParams.get('id') || searchParams.get('transaction_id');
                const token = searchParams.get('token');
                setWompiTxId(txId);

                // Si tenemos token, lo usamos directamente
                if (token) {
                    const bffUrl = resolveBffUrl();
                    const res = await fetch(`${bffUrl}/api/v1/payments/link/${token}`);
                    if (!res.ok) {
                        setState('not_found');
                        return;
                    }
                    const paymentData: PaymentLinkData = await res.json();
                    setData(paymentData);

                    if (paymentData.linkStatus === 'paid' || paymentData.paymentStatus === 'paid') {
                        setState('success');
                    } else if (paymentData.linkStatus === 'pending') {
                        setState('pending');
                    } else {
                        setState('error');
                    }
                    return;
                }

                // Si no hay token, mostramos un estado basado en lo que Wompi nos dio
                if (txId) {
                    // El webhook puede tardar unos segundos en procesarse.
                    // Mostrar estado "pendiente" es lo más seguro.
                    setState('pending');
                } else {
                    setState('not_found');
                }
            } catch {
                setState('error');
            }
        };

        fetchPaymentData();
    }, [searchParams]);

    // Retry para pagos pendientes (el webhook puede tardar)
    useEffect(() => {
        if (state !== 'pending' || !data) return;

        const token = searchParams.get('token');
        if (!token) return;

        const interval = setInterval(async () => {
            try {
                const bffUrl = resolveBffUrl();
                const res = await fetch(`${bffUrl}/api/v1/payments/link/${token}`);
                if (res.ok) {
                    const updated: PaymentLinkData = await res.json();
                    if (updated.linkStatus === 'paid' || updated.paymentStatus === 'paid') {
                        setData(updated);
                        setState('success');
                        clearInterval(interval);
                    }
                }
            } catch { /* silencioso */ }
        }, 5000); // Cada 5 segundos

        // Máximo 2 minutos de retry
        const timeout = setTimeout(() => clearInterval(interval), 120_000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [state, data, searchParams]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg">
                {/* ── Loading ──────────────────────────────────────────────── */}
                {state === 'loading' && (
                    <CardContent className="py-16 text-center">
                        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">Verificando tu pago...</p>
                    </CardContent>
                )}

                {/* ── Éxito ────────────────────────────────────────────────── */}
                {state === 'success' && data && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                            <CardTitle className="text-2xl text-green-600">¡Pago exitoso!</CardTitle>
                            <CardDescription>
                                Tu pago ha sido procesado correctamente
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.childName && (
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">Atleta</p>
                                    <p className="font-semibold text-lg">{data.childName}</p>
                                </div>
                            )}

                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                {data.concept && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Concepto</span>
                                        <span className="font-medium">{data.concept}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Monto pagado</span>
                                    <span className="font-bold text-lg">{formatCurrency(data.grossAmount)}</span>
                                </div>
                                {(data.wompiReference || wompiTxId) && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Referencia</span>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {data.wompiReference || wompiTxId}
                                        </Badge>
                                    </div>
                                )}
                                {data.schoolName && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Escuela</span>
                                        <span>{data.schoolName}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-2 pt-2">
                                <Button asChild className="w-full" size="lg">
                                    <Link to="/dashboard">
                                        <Home className="mr-2 h-4 w-4" />
                                        Ir al inicio
                                    </Link>
                                </Button>
                                <Button asChild variant="ghost" className="w-full">
                                    <Link to="/my-payments">
                                        Ver mis pagos
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {/* ── Pendiente ────────────────────────────────────────────── */}
                {state === 'pending' && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                                <Clock className="h-12 w-12 text-amber-600" />
                            </div>
                            <CardTitle className="text-2xl text-amber-600">Pago en proceso</CardTitle>
                            <CardDescription>
                                Estamos verificando tu pago con Wompi. Esto puede tardar unos segundos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Verificando automáticamente...</span>
                            </div>

                            {wompiTxId && (
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Transacción Wompi</span>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {wompiTxId}
                                        </Badge>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-center text-muted-foreground">
                                Si tu pago fue exitoso, el estado se actualizará automáticamente.
                                Si no cambia en unos minutos, contacta a tu academia.
                            </p>

                            <Separator />

                            <Button asChild variant="outline" className="w-full">
                                <Link to="/dashboard">
                                    <Home className="mr-2 h-4 w-4" />
                                    Ir al inicio
                                </Link>
                            </Button>
                        </CardContent>
                    </>
                )}

                {/* ── Error ────────────────────────────────────────────────── */}
                {state === 'error' && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <XCircle className="h-12 w-12 text-red-600" />
                            </div>
                            <CardTitle className="text-2xl text-red-600">Pago no completado</CardTitle>
                            <CardDescription>
                                El pago fue rechazado o cancelado. No se realizó ningún cobro.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Button asChild className="w-full" size="lg">
                                    <Link to="/my-payments">
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Volver a mis pagos
                                    </Link>
                                </Button>
                                <Button asChild variant="ghost" className="w-full">
                                    <Link to="/dashboard">Ir al inicio</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {/* ── Not Found ────────────────────────────────────────────── */}
                {state === 'not_found' && (
                    <>
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-xl">Enlace no válido</CardTitle>
                            <CardDescription>
                                No encontramos información sobre este pago. El enlace puede haber expirado.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="w-full">
                                <Link to="/">Ir al inicio</Link>
                            </Button>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
