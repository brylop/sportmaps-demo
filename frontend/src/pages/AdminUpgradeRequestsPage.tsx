/**
 * AdminUpgradeRequestsPage — Bandeja del super_admin.
 *
 * Ruta: /admin/upgrade-requests
 * Acceso: solo role='admin' (super_admin).
 *
 * Permite ver:
 *   - Lista de plan_upgrade_requests con filtros (pending / contacted / processed)
 *   - Detalle por request (escuela, tipo, plan/addon pedido, fecha, contexto)
 *   - Acciones: marcar como contactado, procesar (aplica el upgrade), rechazar
 *   - Link directo de WhatsApp con mensaje pre-armado
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Inbox,
    CheckCircle2,
    XCircle,
    Clock,
    MessageSquare,
    Phone,
    Building2,
    Sparkles,
    AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';
import { ACADEMY_TIERS, ADDONS, formatCop, type TierCode, type AddonKey } from '@/config/saas-plans';

// ============================================================
// Tipos
// ============================================================

type RequestStatus = 'pending' | 'contacted' | 'processed' | 'rejected' | 'cancelled';
type RequestType =
    | 'plan_upgrade'
    | 'plan_downgrade'
    | 'addon_activate'
    | 'addon_deactivate'
    | 'payment_update'
    | 'contact_sales';

interface UpgradeRequest {
    id: string;
    school_id: string;
    requested_by: string | null;
    request_type: RequestType;
    requested_plan_code: TierCode | null;
    requested_addon_key: AddonKey | null;
    requested_billing_cycle: 'monthly' | 'annual' | null;
    current_plan_code: string | null;
    current_status: string | null;
    status: RequestStatus;
    contact_method: string | null;
    processed_by: string | null;
    processed_at: string | null;
    processed_amount_cents: number | null;
    processed_notes: string | null;
    source: string;
    source_url: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    schools?: {
        id: string;
        name: string;
        school_type: string;
        is_demo: boolean;
    };
    requester?: {
        id: string;
        email: string;
    };
}

// ============================================================
// Componente
// ============================================================

export default function AdminUpgradeRequestsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<RequestStatus | 'all'>('pending');
    const [processingRequest, setProcessingRequest] = useState<UpgradeRequest | null>(null);
    const [processNotes, setProcessNotes] = useState('');
    const [processAmount, setProcessAmount] = useState<string>('');

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['upgrade-requests', activeTab],
        queryFn: async () => {
            const params = activeTab !== 'all' ? `?status=${activeTab}` : '';
            const res = await bffClient.get<{ requests: UpgradeRequest[] }>(`/api/v1/upgrade-requests${params}`);
            return res.requests;
        },
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000, // poll cada minuto por nuevos requests
    });

    const counts = useMemo(() => {
        return {
            pending:   requests.filter((r) => r.status === 'pending').length,
            contacted: requests.filter((r) => r.status === 'contacted').length,
            processed: requests.filter((r) => r.status === 'processed').length,
            rejected:  requests.filter((r) => r.status === 'rejected').length,
        };
    }, [requests]);

    const processMutation = useMutation({
        mutationFn: async ({ id, notes, amountCents }: { id: string; notes?: string; amountCents?: number }) => {
            return bffClient.post(`/api/v1/upgrade-requests/${id}/process`, {
                notes,
                amount_cents: amountCents,
                contact_method: 'whatsapp',
            });
        },
        onSuccess: () => {
            toast({ title: 'Request procesado', description: 'El plan/addon fue activado correctamente.' });
            queryClient.invalidateQueries({ queryKey: ['upgrade-requests'] });
            setProcessingRequest(null);
            setProcessNotes('');
            setProcessAmount('');
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'No se pudo procesar', variant: 'destructive' });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, notes }: { id: string; status: RequestStatus; notes?: string }) => {
            return bffClient.patch(`/api/v1/upgrade-requests/${id}`, {
                status,
                processed_notes: notes,
                contact_method: 'whatsapp',
            });
        },
        onSuccess: () => {
            toast({ title: 'Estado actualizado' });
            queryClient.invalidateQueries({ queryKey: ['upgrade-requests'] });
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'No se pudo actualizar', variant: 'destructive' });
        },
    });

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Inbox className="w-8 h-8 text-primary" />
                        Solicitudes de upgrade
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Procesa manualmente las solicitudes de plan y addons que recibes desde el admin app y la landing.
                    </p>
                </div>
                <Badge variant="outline" className="text-base px-3 py-1">
                    {counts.pending} pendientes
                </Badge>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="mb-4">
                    <TabsTrigger value="pending">Pendientes ({counts.pending})</TabsTrigger>
                    <TabsTrigger value="contacted">Contactados ({counts.contacted})</TabsTrigger>
                    <TabsTrigger value="processed">Procesados ({counts.processed})</TabsTrigger>
                    <TabsTrigger value="rejected">Rechazados ({counts.rejected})</TabsTrigger>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ) : requests.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No hay solicitudes con este estado.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((req) => (
                                <RequestCard
                                    key={req.id}
                                    request={req}
                                    onProcess={() => setProcessingRequest(req)}
                                    onMarkContacted={() =>
                                        updateStatusMutation.mutate({ id: req.id, status: 'contacted' })
                                    }
                                    onReject={() => {
                                        const note = window.prompt('Motivo del rechazo:');
                                        if (note !== null) {
                                            updateStatusMutation.mutate({ id: req.id, status: 'rejected', notes: note });
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Dialog para procesar (aplicar el upgrade) ───────── */}
            <Dialog open={!!processingRequest} onOpenChange={(o) => !o && setProcessingRequest(null)}>
                <DialogContent className="max-w-md">
                    {processingRequest && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Procesar solicitud</DialogTitle>
                                <DialogDescription>
                                    Al confirmar se aplicará el cambio en la suscripción de{' '}
                                    <strong>{processingRequest.schools?.name}</strong>.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3 py-2">
                                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                                    <p>
                                        <strong>Tipo:</strong> {labelForRequestType(processingRequest.request_type)}
                                    </p>
                                    {processingRequest.requested_plan_code && (
                                        <p>
                                            <strong>Plan:</strong>{' '}
                                            {ACADEMY_TIERS[processingRequest.requested_plan_code]?.name ||
                                                processingRequest.requested_plan_code}
                                        </p>
                                    )}
                                    {processingRequest.requested_addon_key && (
                                        <p>
                                            <strong>Addon:</strong>{' '}
                                            {ADDONS[processingRequest.requested_addon_key]?.name ||
                                                processingRequest.requested_addon_key}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="amount">Monto cobrado (COP, opcional)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="149000"
                                        value={processAmount}
                                        onChange={(e) => setProcessAmount(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Si el cliente pagó, registra el monto. Se guarda como referencia para conciliar.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="notes">Notas internas</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Ej: pagó por transferencia. Referencia #12345"
                                        rows={3}
                                        value={processNotes}
                                        onChange={(e) => setProcessNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <DialogFooter className="flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={() => setProcessingRequest(null)}>
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={() => {
                                        const amountCents = processAmount
                                            ? Math.round(parseFloat(processAmount) * 100)
                                            : undefined;
                                        processMutation.mutate({
                                            id: processingRequest.id,
                                            notes: processNotes || undefined,
                                            amountCents,
                                        });
                                    }}
                                    disabled={processMutation.isPending}
                                >
                                    {processMutation.isPending ? 'Procesando...' : 'Aplicar upgrade'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================
// RequestCard — card individual
// ============================================================

function RequestCard({
    request,
    onProcess,
    onMarkContacted,
    onReject,
}: {
    request: UpgradeRequest;
    onProcess: () => void;
    onMarkContacted: () => void;
    onReject: () => void;
}) {
    const isPending = request.status === 'pending';
    const isContacted = request.status === 'contacted';

    const planName = request.requested_plan_code
        ? ACADEMY_TIERS[request.requested_plan_code]?.name
        : null;
    const addonName = request.requested_addon_key
        ? ADDONS[request.requested_addon_key]?.name
        : null;
    const priceCents =
        request.requested_plan_code != null
            ? ACADEMY_TIERS[request.requested_plan_code]?.priceCents
            : request.requested_addon_key != null
                ? ADDONS[request.requested_addon_key]?.priceCents
                : 0;

    const whatsappLink = useMemo(() => {
        const phone = '573128463555';
        const schoolName = request.schools?.name || 'tu escuela';
        const email = request.requester?.email || '';
        const item = planName || addonName || request.request_type;
        const message = `Hola! 👋 Soy del equipo de SportMaps. Vi tu solicitud de ${item} para ${schoolName}. ¿Te puedo ayudar con la activación?`;
        return `https://wa.me/${email ? phone : phone}?text=${encodeURIComponent(message)}`;
    }, [request, planName, addonName]);

    return (
        <Card className={isPending ? 'border-primary/40' : ''}>
            <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            {request.schools?.name || 'Escuela'}
                            {request.schools?.is_demo && (
                                <Badge variant="outline" className="text-xs">DEMO</Badge>
                            )}
                            <StatusBadge status={request.status} />
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {request.requester?.email || 'Sin email'} ·{' '}
                            {new Date(request.created_at).toLocaleString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                            {' · '}
                            <span className="capitalize">{request.source.replace('_', ' ')}</span>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg bg-muted/30 p-3 mb-3 text-sm space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        {labelForRequestType(request.request_type)}
                    </p>
                    {planName && (
                        <p>
                            Plan: <strong>{planName}</strong>
                            {priceCents != null && priceCents > 0 && (
                                <span className="text-muted-foreground">
                                    {' '}— {formatCop(priceCents)}/mes
                                </span>
                            )}
                        </p>
                    )}
                    {addonName && (
                        <p>
                            Addon: <strong>{addonName}</strong>
                            {priceCents != null && priceCents > 0 && (
                                <span className="text-muted-foreground">
                                    {' '}— {formatCop(priceCents)}/mes
                                </span>
                            )}
                        </p>
                    )}
                    {request.current_plan_code && (
                        <p className="text-muted-foreground text-xs">
                            Plan actual: {ACADEMY_TIERS[request.current_plan_code as TierCode]?.name || request.current_plan_code}
                            {' · '}Estado: {request.current_status}
                        </p>
                    )}
                </div>

                {request.processed_notes && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm mb-3">
                        <p className="text-xs uppercase text-muted-foreground mb-1">Notas</p>
                        <p>{request.processed_notes}</p>
                    </div>
                )}

                {(isPending || isContacted) && (
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-500/30 hover:bg-green-500/5"
                        >
                            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="w-3 h-3 mr-1.5" />
                                WhatsApp
                            </a>
                        </Button>
                        {isPending && (
                            <Button size="sm" variant="outline" onClick={onMarkContacted}>
                                <Phone className="w-3 h-3 mr-1.5" />
                                Marcar contactado
                            </Button>
                        )}
                        <Button size="sm" onClick={onProcess}>
                            <CheckCircle2 className="w-3 h-3 mr-1.5" />
                            Procesar upgrade
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onReject}>
                            <XCircle className="w-3 h-3 mr-1.5" />
                            Rechazar
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Helpers
// ============================================================

function StatusBadge({ status }: { status: RequestStatus }) {
    const map: Record<RequestStatus, { label: string; className: string; Icon: typeof Clock }> = {
        pending:   { label: 'Pendiente',  className: 'bg-amber-500/10 text-amber-700 border-amber-500/30',     Icon: Clock },
        contacted: { label: 'Contactado', className: 'bg-blue-500/10 text-blue-700 border-blue-500/30',         Icon: Phone },
        processed: { label: 'Procesado',  className: 'bg-green-500/10 text-green-700 border-green-500/30',      Icon: CheckCircle2 },
        rejected:  { label: 'Rechazado',  className: 'bg-destructive/10 text-destructive border-destructive/30', Icon: XCircle },
        cancelled: { label: 'Cancelado',  className: 'bg-muted text-muted-foreground',                          Icon: AlertCircle },
    };
    const config = map[status];
    const Icon = config.Icon;
    return (
        <Badge variant="outline" className={`text-xs ${config.className}`}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
        </Badge>
    );
}

function labelForRequestType(type: RequestType): string {
    const map: Record<RequestType, string> = {
        plan_upgrade:     'Upgrade de plan',
        plan_downgrade:   'Cambio de plan',
        addon_activate:   'Activación de addon',
        addon_deactivate: 'Baja de addon',
        payment_update:   'Actualización de método de pago',
        contact_sales:    'Lead de ventas',
    };
    return map[type] || type;
}
