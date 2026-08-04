/**
 * AccountDeletionCard — solicitud de eliminación de cuenta (derecho de supresión).
 *
 * Google Play exige que toda app que permita crear cuenta ofrezca un camino
 * IN-APP para eliminarla, más una URL web pública para pedirlo sin instalar la
 * app (ver /eliminar-cuenta). Hasta 2026-08-01 el botón "Eliminar Cuenta" de
 * SecuritySection existía pero no tenía onClick: no hacía absolutamente nada.
 *
 * El backend ya estaba construido (BFF `/api/v1/me/data-deletion-request` sobre
 * los RPCs request_account_deletion / cancel_account_deletion, migración
 * 20260522141000_security_hardening_p1.sql). Esto solo lo cablea.
 *
 * Semántica: NO borra en el acto. Programa el borrado a 30 días y de inmediato
 * cancela las suscripciones recurrentes y desactiva los medios de pago. El
 * usuario puede arrepentirse dentro de esos 30 días. El borrado físico lo
 * ejecuta un job aparte.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Loader2, Clock } from 'lucide-react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';

const CSRF_HEADERS = { 'X-Requested-With': 'SportMaps' };

interface DeletionRequest {
    id: string;
    reason: string | null;
    requested_at: string;
    scheduled_for: string;
    status: string;
    cancelled_at: string | null;
    completed_at: string | null;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

export function AccountDeletionCard() {
    const { toast } = useToast();
    const [request, setRequest] = useState<DeletionRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [reason, setReason] = useState('');

    // Solo una solicitud viva bloquea la UI; las canceladas no cuentan.
    const pending = request && request.status === 'pending';

    const loadRequest = async () => {
        try {
            const data = await bffClient.get<{ request: DeletionRequest | null }>(
                '/api/v1/me/data-deletion-request',
            );
            setRequest(data.request);
        } catch {
            // Si no se puede consultar, dejamos la tarjeta en su estado por
            // defecto: es preferible ofrecer el botón que ocultarlo.
            setRequest(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadRequest();
    }, []);

    const handleRequest = async () => {
        setSubmitting(true);
        try {
            await bffClient.post(
                '/api/v1/me/data-deletion-request',
                { reason: reason.trim() || undefined },
                CSRF_HEADERS,
            );
            toast({
                title: 'Solicitud registrada',
                description:
                    'Tu cuenta quedó programada para eliminación en 30 días. Cancelamos tus cobros recurrentes y desactivamos tus medios de pago.',
            });
            setConfirmOpen(false);
            setReason('');
            await loadRequest();
        } catch (err: any) {
            toast({
                title: 'No se pudo registrar la solicitud',
                description: err?.message ?? 'Intenta de nuevo o escríbenos a privacidad@sportmaps.co.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        setSubmitting(true);
        try {
            await bffClient.delete('/api/v1/me/data-deletion-request', CSRF_HEADERS);
            toast({
                title: 'Solicitud cancelada',
                description:
                    'Tu cuenta ya no se eliminará. Ojo: tus medios de pago siguen desactivados, tendrás que agregarlos de nuevo.',
            });
            await loadRequest();
        } catch (err: any) {
            toast({
                title: 'No se pudo cancelar',
                description: err?.message ?? 'Escríbenos a privacidad@sportmaps.co.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Zona de Peligro
                </CardTitle>
                <CardDescription>
                    Acciones irreversibles sobre tu cuenta de SportMaps.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Consultando el estado de tu cuenta…
                    </div>
                ) : pending ? (
                    <div className="space-y-4">
                        <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertTitle>Eliminación programada</AlertTitle>
                            <AlertDescription>
                                Pediste eliminar tu cuenta el {formatDate(request!.requested_at)}. Se
                                borrará el <strong>{formatDate(request!.scheduled_for)}</strong>. Tus
                                cobros recurrentes ya están cancelados y tus medios de pago
                                desactivados. Puedes cancelar la solicitud hasta esa fecha.
                            </AlertDescription>
                        </Alert>
                        <Button variant="outline" onClick={handleCancel} disabled={submitting} className="gap-2">
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cancelar la eliminación
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="font-medium">Eliminar mi cuenta</p>
                            <p className="text-sm text-muted-foreground">
                                Se programa el borrado de todos tus datos, perfiles y membresías en 30
                                días. Cancelamos tus cobros recurrentes de inmediato.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmOpen(true)}
                            className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0"
                        >
                            Eliminar Cuenta
                        </Button>
                    </div>
                )}
            </CardContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar tu cuenta de SportMaps?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    Programaremos el borrado de tu cuenta y de tus datos en{' '}
                                    <strong>30 días</strong>. De inmediato cancelamos tus cobros
                                    recurrentes y desactivamos tus medios de pago.
                                </p>
                                <p>
                                    Si eres acudiente, esto también afecta los perfiles de los
                                    deportistas que registraste a tu cargo.
                                </p>
                                <p className="text-muted-foreground">
                                    Podrás cancelar la solicitud desde esta misma pantalla mientras no
                                    se cumpla el plazo.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="deletion-reason">Motivo (opcional)</Label>
                        <Textarea
                            id="deletion-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value.slice(0, 500))}
                            placeholder="Nos ayuda a mejorar, pero puedes dejarlo vacío."
                            rows={3}
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>Conservar mi cuenta</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                // Evita que el dialog se cierre antes de saber si funcionó.
                                e.preventDefault();
                                void handleRequest();
                            }}
                            disabled={submitting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                        >
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Sí, eliminar mi cuenta
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
