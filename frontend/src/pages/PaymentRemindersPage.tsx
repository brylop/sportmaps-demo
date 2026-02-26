import React, { useState, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { paymentRemindersAPI, PaymentReminder, ReminderBatch } from '@/lib/api/payment-reminders';
import {
    Bell, DollarSign, AlertTriangle, Clock, Send, CheckCircle2, Users,
    ChevronDown, ChevronUp, Mail, Loader2, RefreshCw, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { toast } from 'sonner';

export default function PaymentRemindersPage() {
    const { schoolId, activeBranchId, activeBranchName } = useSchoolContext();
    const [batch, setBatch] = useState<ReminderBatch | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue'>('all');
    const [expandedParent, setExpandedParent] = useState<string | null>(null);

    useEffect(() => {
        if (schoolId) loadReminders();
    }, [schoolId, activeBranchId]);

    async function loadReminders() {
        if (!schoolId) return;
        try {
            setLoading(true);
            // First, mark overdue payments
            const overdueCount = await paymentRemindersAPI.markOverduePayments(schoolId);
            if (overdueCount > 0) {
                toast.info(`${overdueCount} pagos marcados como vencidos`);
            }
            // Then generate the reminder list
            const data = await paymentRemindersAPI.generateReminders(schoolId, activeBranchId);
            setBatch(data);
        } catch (error: any) {
            toast.error(error.message || 'Error al cargar recordatorios');
        } finally {
            setLoading(false);
        }
    }

    const filteredReminders = batch?.reminders.filter(r =>
        filterStatus === 'all' || r.status === filterStatus
    ) || [];

    // Group by parent for grouped view
    const groupedByParent = filteredReminders.reduce<Record<string, PaymentReminder[]>>((acc, r) => {
        if (!acc[r.parentId]) acc[r.parentId] = [];
        acc[r.parentId].push(r);
        return acc;
    }, {});

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredReminders.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSendReminders = async () => {
        if (selectedIds.size === 0) {
            toast.warning('Selecciona al menos un recordatorio para enviar');
            return;
        }
        setSending(true);
        try {
            // Simulate sending -- in production this would call a backend endpoint/edge function
            await new Promise(resolve => setTimeout(resolve, 1500));

            const count = selectedIds.size;
            toast.success(`✅ ${count} recordatorio${count > 1 ? 's' : ''} enviado${count > 1 ? 's' : ''}`);
            setSelectedIds(new Set());
        } catch (error: any) {
            toast.error(error.message || 'Error al enviar recordatorios');
        } finally {
            setSending(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-64 bg-muted animate-pulse rounded" />
                <div className="grid gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
                </div>
                <div className="h-96 bg-muted animate-pulse rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Bell className="h-8 w-8 text-primary" />
                        Recordatorios de Cobro
                    </h1>
                    <div className="text-muted-foreground mt-1">
                        Gestiona y envía recordatorios a padres con pagos pendientes
                        {activeBranchName && activeBranchName !== 'General' && (
                            <Badge variant="outline" className="ml-2 text-[10px]">{activeBranchName}</Badge>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadReminders}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    <Button
                        onClick={handleSendReminders}
                        disabled={selectedIds.size === 0 || sending}
                    >
                        {sending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                            <><Send className="h-4 w-4 mr-2" /> Enviar ({selectedIds.size})</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {batch && (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Padres</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{Object.keys(groupedByParent).length}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-muted-foreground">Pendientes</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{batch.byStatus.pending}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">Vencidos</span>
                        </div>
                        <p className="text-2xl font-bold mt-1 text-red-600">{batch.byStatus.overdue}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-muted-foreground">Total Pendiente</span>
                        </div>
                        <p className="text-xl font-bold mt-1">{formatCurrency(batch.totalAmount)}</p>
                    </Card>
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos ({batch?.totalReminders || 0})</SelectItem>
                        <SelectItem value="pending">Pendientes ({batch?.byStatus.pending || 0})</SelectItem>
                        <SelectItem value="overdue">Vencidos ({batch?.byStatus.overdue || 0})</SelectItem>
                    </SelectContent>
                </Select>

                {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="animate-in fade-in">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            {/* Content */}
            {filteredReminders.length === 0 ? (
                <Card className="border-dashed flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 className="h-14 w-14 text-emerald-400 mb-4 opacity-50" />
                    <CardTitle className="text-xl">¡Todo al día!</CardTitle>
                    <CardDescription className="max-w-sm mt-2">
                        No hay pagos pendientes ni vencidos en este momento.
                    </CardDescription>
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedIds.size === filteredReminders.length && filteredReminders.length > 0}
                                        onCheckedChange={toggleAll}
                                    />
                                </TableHead>
                                <TableHead>Padre / Acudiente</TableHead>
                                <TableHead>Estudiante</TableHead>
                                <TableHead>Programa</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(groupedByParent).map(([parentId, reminders]) => {
                                const isExpanded = expandedParent === parentId || Object.keys(groupedByParent).length <= 5;
                                const parentTotal = reminders.reduce((s, r) => s + r.amount, 0);
                                const first = reminders[0];

                                if (reminders.length === 1) {
                                    return (
                                        <TableRow key={first.id} className="group">
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(first.id)}
                                                    onCheckedChange={() => toggleOne(first.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{first.parentName}</p>
                                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {first.parentEmail || 'Sin email'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{first.childName}</TableCell>
                                            <TableCell className="text-sm">{first.programName}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                {formatCurrency(first.amount)}
                                            </TableCell>
                                            <TableCell className="text-sm">{formatDate(first.dueDate)}</TableCell>
                                            <TableCell>
                                                {first.status === 'overdue' ? (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                                        {first.daysOverdue}d vencido
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                                                        Pendiente
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                // Multiple payments for this parent — render grouped
                                return (
                                    <React.Fragment key={parentId}>
                                        <TableRow
                                            className="cursor-pointer hover:bg-muted/60"
                                            onClick={() => setExpandedParent(isExpanded ? null : parentId)}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={reminders.every(r => selectedIds.has(r.id))}
                                                    onCheckedChange={(checked) => {
                                                        const next = new Set(selectedIds);
                                                        reminders.forEach(r => {
                                                            if (checked) next.add(r.id);
                                                            else next.delete(r.id);
                                                        });
                                                        setSelectedIds(next);
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    <div>
                                                        <p className="font-medium text-sm">{first.parentName}</p>
                                                        <p className="text-[11px] text-muted-foreground">{reminders.length} pagos pendientes</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell colSpan={2} className="text-sm text-muted-foreground">
                                                {reminders.map(r => r.childName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">
                                                {formatCurrency(parentTotal)}
                                            </TableCell>
                                            <TableCell />
                                            <TableCell>
                                                {reminders.some(r => r.status === 'overdue') ? (
                                                    <Badge variant="destructive" className="text-[10px]">Vencidos</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">Pendientes</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && reminders.map(r => (
                                            <TableRow key={r.id} className="bg-muted/20">
                                                <TableCell className="pl-8">
                                                    <Checkbox
                                                        checked={selectedIds.has(r.id)}
                                                        onCheckedChange={() => toggleOne(r.id)}
                                                    />
                                                </TableCell>
                                                <TableCell />
                                                <TableCell className="text-sm">{r.childName}</TableCell>
                                                <TableCell className="text-sm">{r.programName}</TableCell>
                                                <TableCell className="text-right text-sm">{formatCurrency(r.amount)}</TableCell>
                                                <TableCell className="text-sm">{formatDate(r.dueDate)}</TableCell>
                                                <TableCell>
                                                    {r.status === 'overdue' ? (
                                                        <Badge variant="destructive" className="text-[10px]">
                                                            {r.daysOverdue}d
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-[10px]">Pend.</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
