import { useState } from 'react';
import {
    useVendorRecurringSubscribers,
    type RecurringSubStatus,
} from '@/hooks/useVendorRecurringSubscribers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Users, AlertCircle, CalendarClock } from 'lucide-react';

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(iso));
}

const PERIOD_LABEL: Record<string, string> = {
    weekly:    'Semanal',
    biweekly:  'Quincenal',
    monthly:   'Mensual',
    quarterly: 'Trimestral',
    yearly:    'Anual',
};

const STATUS_VARIANT: Record<RecurringSubStatus, { label: string; className: string }> = {
    active:    { label: 'Activo',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    paused:    { label: 'Pausado',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
    suspended: { label: 'Suspendido (fallo cobro)', className: 'bg-red-100 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelado', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

export default function VendorSubscribersPage() {
    const [tab, setTab] = useState<'all' | RecurringSubStatus>('all');
    const { data: subs = [], isLoading, error } = useVendorRecurringSubscribers(
        tab === 'all' ? undefined : tab,
    );

    const activeCount = subs.filter(s => s.status === 'active').length;
    const monthlyRecurring = subs
        .filter(s => s.status === 'active' && s.billing_period === 'monthly')
        .reduce((acc, s) => acc + Number(s.amount), 0);

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-5xl">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Mis suscriptores
                </h1>
                <p className="text-sm text-muted-foreground">
                    Clientes que tienen tarjeta guardada para cobrarte automáticamente cada periodo.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Suscriptores activos</p>
                        <p className="text-2xl font-bold mt-1">{activeCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingreso mensual recurrente</p>
                        <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCOP(monthlyRecurring)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Solo subs mensuales activas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total registrados</p>
                        <p className="text-2xl font-bold mt-1">{subs.length}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="active">Activos</TabsTrigger>
                    <TabsTrigger value="paused">Pausados</TabsTrigger>
                    <TabsTrigger value="suspended">Suspendidos</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                </TabsList>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Listado</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : error ? (
                        <div className="p-6 flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">{(error as Error).message}</span>
                        </div>
                    ) : subs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            Aún no tienes suscriptores. Cuando alguien active un plan
                            recurrente con tu servicio aparecerá aquí.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Periodo</TableHead>
                                    <TableHead>Próximo cobro</TableHead>
                                    <TableHead>Último cobro</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subs.map((s) => {
                                    const variant = STATUS_VARIANT[s.status];
                                    return (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">
                                                {s.subscription_plan?.name ?? s.concept}
                                            </TableCell>
                                            <TableCell>{formatCOP(Number(s.amount))}</TableCell>
                                            <TableCell>{PERIOD_LABEL[s.billing_period] ?? s.billing_period}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {formatDate(s.next_charge_at)}
                                                </span>
                                            </TableCell>
                                            <TableCell>{formatDate(s.last_charge_at)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={variant.className}>
                                                    {variant.label}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
