import React, { useState, useEffect } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { paymentRemindersAPI, PaymentReminder, ReminderBatch } from '@/lib/api/payment-reminders';
import { daysDiffFromToday } from '@/lib/dateUtils';
import {
    Bell, DollarSign, AlertTriangle, Clock, Send, CheckCircle2, Users,
    ChevronDown, ChevronUp, Mail, Loader2, RefreshCw, Filter, MessageCircle, Phone, FileText
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
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { emailClient } from '@/lib/email-client';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { ReminderHistoryModal } from '@/components/finances/ReminderHistoryModal';

export default function PaymentRemindersPage() {
    const { schoolId, activeBranchId, activeBranchName, schoolName } = useSchoolContext();
    const [batch, setBatch] = useState<ReminderBatch | null>(null);
    const [loading, setLoading] = useState(true);
    // F-01: distinguir "error de carga" de "sin datos" (no mostrar "¡Todo al día!" ante un fallo).
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue'>('all');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [expandedParent, setExpandedParent] = useState<string | null>(null);
    const [sendingAuto, setSendingAuto] = useState(false);
    const [templates, setTemplates] = useState<{ id: string; name: string; template_type: string }[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('auto');
    const [athletesWithoutPayment, setAthletesWithoutPayment] = useState<any[]>([]);
    const [loadingWithout, setLoadingWithout] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (schoolId) {
            loadReminders();
            loadTemplates();
        }
    }, [schoolId, activeBranchId]);

    async function loadTemplates() {
        // Load WhatsApp templates available to this school (school-specific + global defaults)
        const { data } = await supabase
            .from('payment_message_templates')
            .select('id, name, template_type, is_default, school_id')
            .eq('channel', 'whatsapp')
            .eq('is_active', true)
            .or(`school_id.eq.${schoolId},school_id.is.null`)
            .order('template_type')
            .order('sort_order');
        setTemplates(data || []);
    }

    async function loadReminders() {
        if (!schoolId) return;
        try {
            setLoading(true);
            setLoadError(null);
            // First, mark overdue payments
            const overdueCount = await paymentRemindersAPI.markOverduePayments(schoolId);
            if (overdueCount > 0) {
                toast.info(`${overdueCount} pagos marcados como vencidos`);
            }
            // Then generate the reminder list
            const data = await paymentRemindersAPI.generateReminders(schoolId, activeBranchId);
            setBatch(data);
            // Cargar atletas sin cobro
            setLoadingWithout(true);
            const without = await paymentRemindersAPI.getAthletesWithoutPayment(schoolId);
            setAthletesWithoutPayment(without);
        } catch (error: any) {
            setLoadError(error.message || 'Error al cargar recordatorios');
            toast.error(error.message || 'Error al cargar recordatorios');
        } finally {
            setLoading(false);
            setLoadingWithout(false);
        }
    }

    // Unique plan names for dynamic filter
    const planOptions = [...new Set((batch?.reminders || []).map(r => r.teamName).filter(Boolean))];

    const filteredReminders = batch?.reminders.filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (filterPlan !== 'all' && r.teamName !== filterPlan) return false;
        return true;
    }) || [];

    // Stats based on filtered results
    const filteredStats = {
        parents: new Set(filteredReminders.map(r => r.parentId)).size,
        pending: filteredReminders.filter(r => r.status === 'pending').length,
        overdue: filteredReminders.filter(r => r.status === 'overdue').length,
        total: filteredReminders.reduce((s, r) => s + r.amount, 0),
    };

    // Cobros que sí se pueden reclamar: los posibles duplicados quedan fuera de
    // toda selección hasta que la escuela resuelva la ficha repetida.
    const duplicados = filteredReminders.filter(r => r.posibleDuplicado);
    const selectableCount = filteredReminders.length - duplicados.length;

    // Group by parent for grouped view
    const groupedByParent = filteredReminders.reduce<Record<string, PaymentReminder[]>>((acc, r) => {
        if (!acc[r.parentId]) acc[r.parentId] = [];
        acc[r.parentId].push(r);
        return acc;
    }, {});

    // «Seleccionar todo» nunca incluye los posibles duplicados: si la persona ya
    // pagó ese periodo en su ficha gemela, hay que revisarlo, no reclamarlo.
    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredReminders.filter(r => !r.posibleDuplicado).map(r => r.id)));
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
        let sent = 0;
        let failed = 0;
        try {
            const selected = batch?.reminders.filter(r => selectedIds.has(r.id)) || [];
            // Último cortafuegos: nunca reclamarle a quien ya pagó ese periodo en
            // su ficha gemela, ni siquiera si quedó seleccionado a mano.
            const duplicados = selected.filter(r => r.posibleDuplicado);
            for (const reminder of selected.filter(r => !r.posibleDuplicado)) {
                if (!reminder.parentEmail) { failed++; continue; }
                try {
                    await emailClient.send({
                        type: 'payment_reminder',
                        to: reminder.parentEmail,
                        data: {
                            userName: reminder.parentName,
                            schoolName: schoolName || '',
                            // El concepto del COBRO, no el del equipo.
                            concept: reminder.concept || reminder.teamName,
                            amount: formatCurrency(reminder.amount),
                            dueDate: formatDate(reminder.dueDate),
                            // Sin esto cae al default '/payments', que no existe:
                            // la ruta del acudiente es '/my-payments'.
                            paymentUrl: `${window.location.origin}/my-payments`,
                        },
                    });
                    sent++;
                } catch {
                    failed++;
                }
            }
            if (sent > 0) toast.success(`✅ ${sent} recordatorio${sent > 1 ? 's' : ''} enviado${sent > 1 ? 's' : ''}`);
            if (failed > 0) toast.warning(`${failed} sin email registrado, no enviado${failed > 1 ? 's' : ''}`);
            if (duplicados.length > 0) {
                toast.warning(
                    `${duplicados.length} no se enviaron: ya pagaron ese periodo en otra ficha. Revisar el duplicado antes de reclamar.`,
                );
            }
            setSelectedIds(new Set());
        } catch (error: any) {
            toast.error(error.message || 'Error al enviar recordatorios');
        } finally {
            setSending(false);
        }
    };

    const handleAutoSend = async () => {
        if (!schoolId) return;
        setSendingAuto(true);
        try {
            const { data, error } = await supabase.functions.invoke('payment-reminders-cron', {
                body: { school_id: schoolId },
            });
            if (error) throw error;
            const result = data as { sent?: number; failed?: number };
            if (result.sent && result.sent > 0) {
                toast.success(`${result.sent} recordatorio${result.sent > 1 ? 's' : ''} enviado${result.sent > 1 ? 's' : ''} por email`);
            } else {
                toast.info('No hay recordatorios pendientes para enviar hoy');
            }
            if (result.failed && result.failed > 0) {
                toast.warning(`${result.failed} no pudieron enviarse`);
            }
            loadReminders();
        } catch (err: any) {
            toast.error(err.message || 'Error al ejecutar envio automatico');
        } finally {
            setSendingAuto(false);
        }
    };

    const [sendingWA, setSendingWA] = useState<string | null>(null);

    const sendWhatsApp = async (reminder: PaymentReminder) => {
        if (!reminder.parentPhone) {
            toast.warning('Este padre no tiene teléfono registrado');
            return;
        }
        if (!reminder.paymentId) {
            toast.error('Pago sin ID, no se puede renderizar plantilla');
            return;
        }

        setSendingWA(reminder.id);
        try {
            // Determine template type from payment status
            const templateType = reminder.status === 'overdue' ? 'overdue'
                : daysDiffFromToday(reminder.dueDate) <= 0 ? 'reminder_due'
                : 'reminder_before';

            // Build render request — use specific template if selected, otherwise auto-detect
            const renderBody: Record<string, string> = {
                payment_id: reminder.paymentId,
                template_type: templateType,
                channel: 'whatsapp',
            };
            if (selectedTemplateId !== 'auto') {
                renderBody.template_id = selectedTemplateId;
            }

            const { message } = await bffClient.post<{ message: { body: string } }>(
                '/api/v1/templates/render',
                renderBody,
            );

            // Clean phone number
            const cleanPhone = reminder.parentPhone.replace(/[\s\-()]/g, '');
            const phone = cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `57${cleanPhone.replace(/^0+/, '')}`;

            // Registrar en historial
            const { data: { user } } = await supabase.auth.getUser();
            await paymentRemindersAPI.logReminder({
                school_id: schoolId!,
                payment_id: reminder.paymentId || undefined,
                contact_name: reminder.parentName,
                contact_email: reminder.parentEmail || undefined,
                contact_phone: reminder.parentPhone || undefined,
                amount: reminder.amount,
                channel: 'whatsapp',
                sent_by: user?.id || '',
            });

            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message.body)}`, '_blank');
        } catch (err: any) {
            // Fallback: use hardcoded message if BFF fails
            const cleanPhone = reminder.parentPhone.replace(/[\s\-()]/g, '');
            const phone = cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `57${cleanPhone.replace(/^0+/, '')}`;
            const isOverdue = reminder.status === 'overdue';
            const msg = isOverdue
                ? `Hola ${reminder.parentName}, le informamos que el pago de *${reminder.childName}* en *${schoolName || 'la academia'}* (${formatCurrency(reminder.amount)}) esta vencido desde el ${formatDate(reminder.dueDate)}. Por favor realice el pago lo antes posible.`
                : `Hola ${reminder.parentName}, le recordamos que el pago de *${reminder.childName}* en *${schoolName || 'la academia'}* (${formatCurrency(reminder.amount)}) vence el ${formatDate(reminder.dueDate)}. Gracias por su puntualidad.`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            console.warn('Template render failed, used fallback:', err.message);
        } finally {
            setSendingWA(null);
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
        <>
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
                        variant="outline"
                        onClick={handleAutoSend}
                        disabled={sendingAuto || !batch || batch.totalReminders === 0}
                        className="text-green-700 border-green-200 hover:bg-green-50"
                    >
                        {sendingAuto ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                            <><Bell className="h-4 w-4 mr-2" /> Enviar todos por email</>
                        )}
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
                    <Button variant="outline" onClick={() => setShowHistory(true)}>
                        <Clock className="h-4 w-4 mr-2" />
                        Historial
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {batch && (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Contactos</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{filteredStats.parents}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-muted-foreground">Pendientes</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{filteredStats.pending}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">Vencidos</span>
                        </div>
                        <p className="text-2xl font-bold mt-1 text-red-600">{filteredStats.overdue}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-muted-foreground">Total Pendiente</span>
                        </div>
                        <p className="text-xl font-bold mt-1">{formatCurrency(filteredStats.total)}</p>
                    </Card>
                </div>
            )}

            {/* Sin cobro */}
            {athletesWithoutPayment.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            {athletesWithoutPayment.length} atleta{athletesWithoutPayment.length > 1 ? 's' : ''} sin cobro generado
                        </CardTitle>
                        <CardDescription>
                            Tienen inscripción activa pero no tienen pago pendiente registrado
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Atleta</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Equipo / Plan</TableHead>
                                    <TableHead className="text-right">Tarifa</TableHead>
                                    <TableHead>Contacto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {athletesWithoutPayment.map(a => (
                                    <TableRow key={a.athlete_id}>
                                        <TableCell className="font-medium text-sm">{a.full_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px]">
                                                {a.athlete_type === 'child' ? 'Menor' : a.athlete_type === 'adult' ? 'Adulto' : 'No registrado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {a.team_name || a.plan_name || '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-semibold">
                                            {a.price_monthly > 0
                                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a.price_monthly)
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {a.contact_email || a.contact_phone || 'Sin contacto'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <TableRefreshBar
                            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
                            onRefresh={loadReminders}
                            loading={loading || loadingWithout}
                            summary={`${athletesWithoutPayment.length} atleta(s) sin cobro`}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Filtro por estado en tarjetas */}
            <StatFilterBar
                columns={3}
                value={filterStatus === 'all' ? null : filterStatus}
                onChange={(v) => setFilterStatus((v as 'pending' | 'overdue') ?? 'all')}
                items={[
                    { key: null, label: 'Todos', value: batch?.totalReminders || 0, tone: 'neutral' },
                    { key: 'pending', label: 'Pendientes', value: batch?.byStatus.pending || 0, tone: 'yellow' },
                    { key: 'overdue', label: 'Vencidos', value: batch?.byStatus.overdue || 0, tone: 'rose' },
                ]}
            />

            {/* Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />

                {planOptions.length > 0 && (
                    <Select value={filterPlan} onValueChange={setFilterPlan}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Plan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los planes</SelectItem>
                            {planOptions.map(plan => (
                                <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Template selector */}
                <div className="flex items-center gap-1.5 ml-auto">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Plantilla" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Plantilla automatica</SelectItem>
                            {templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                    <span className="text-muted-foreground text-[10px] ml-1">
                                        ({t.template_type.replace('_', ' ')})
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="animate-in fade-in">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            {/* Ficha repetida: la persona ya pagó ese periodo en su otra ficha.
                No se reclama hasta resolver el duplicado. */}
            {duplicados.length > 0 && (
                <Card className="border-amber-300 bg-amber-50/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                            <AlertTriangle className="h-4 w-4" />
                            {duplicados.length} cobro{duplicados.length > 1 ? 's' : ''} bloqueado{duplicados.length > 1 ? 's' : ''}: ya pagaron ese periodo
                        </CardTitle>
                        <CardDescription className="text-amber-900/80">
                            Estas personas existen más de una vez en la escuela y ya pagaron el mes en
                            su otra ficha. Reclamarles sería cobrarles dos veces, así que quedan fuera
                            del envío. Hay que fusionar las fichas repetidas y anular el cobro sobrante.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <ul className="space-y-1 text-sm text-amber-900">
                            {duplicados.map(r => (
                                <li key={r.id}>
                                    <span className="font-medium">{r.childName}</span> — {r.duplicadoMotivo}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Content */}
            {loadError ? (
                // F-01: error de carga != "todo al día". No dar falsa tranquilidad.
                <Card className="border-dashed border-destructive/50 flex flex-col items-center justify-center py-16 text-center">
                    <AlertTriangle className="h-14 w-14 text-destructive mb-4 opacity-70" />
                    <CardTitle className="text-xl">No se pudieron cargar los recordatorios</CardTitle>
                    <CardDescription className="max-w-sm mt-2">
                        Ocurrió un error de conexión. Esto <strong>no</strong> significa que no
                        haya pagos pendientes. Reintenta.
                    </CardDescription>
                    <Button variant="outline" size="sm" className="mt-4" onClick={loadReminders}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reintentar
                    </Button>
                </Card>
            ) : filteredReminders.length === 0 ? (
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
                                        checked={selectableCount > 0 && selectedIds.size === selectableCount}
                                        onCheckedChange={toggleAll}
                                    />
                                </TableHead>
                                <TableHead>Padre / Acudiente</TableHead>
                                <TableHead>Deportista</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-20 text-center">Acciones</TableHead>
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
                                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                        <span className="flex items-center gap-0.5">
                                                            <Mail className="h-3 w-3" />
                                                            {first.parentEmail || 'Sin email'}
                                                        </span>
                                                        {first.parentPhone && (
                                                            <span className="flex items-center gap-0.5 text-green-600">
                                                                <Phone className="h-3 w-3" />
                                                                {first.parentPhone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{first.childName}</TableCell>
                                            <TableCell className="text-sm">{first.teamName}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                {formatCurrency(first.amount)}
                                            </TableCell>
                                            <TableCell className="text-sm">{formatDate(first.dueDate)}</TableCell>
                                            <TableCell>
                                                {first.status === 'overdue' ? (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                                        {Math.max(0, daysDiffFromToday(first.dueDate))}d vencido
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                                                        Pendiente
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => sendWhatsApp(first)}
                                                    title={first.parentPhone ? `WhatsApp: ${first.parentPhone}` : 'Sin telefono'}
                                                    disabled={!first.parentPhone || sendingWA === first.id}
                                                >
                                                    {sendingWA === first.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                                </Button>
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
                                                    checked={reminders.filter(r => !r.posibleDuplicado).length > 0
                                                        && reminders.filter(r => !r.posibleDuplicado).every(r => selectedIds.has(r.id))}
                                                    onCheckedChange={(checked) => {
                                                        const next = new Set(selectedIds);
                                                        reminders.forEach(r => {
                                                            if (r.posibleDuplicado) return;   // ya pagó en su ficha gemela
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
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={(e) => { e.stopPropagation(); sendWhatsApp(first); }}
                                                    title={first.parentPhone ? `WhatsApp: ${first.parentPhone}` : 'Sin telefono'}
                                                    disabled={!first.parentPhone || sendingWA === first.id}
                                                >
                                                    {sendingWA === first.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && reminders.map(r => (
                                            <TableRow key={r.id} className="bg-muted/20">
                                                <TableCell className="pl-8">
                                                    <Checkbox
                                                        checked={selectedIds.has(r.id)}
                                                        onCheckedChange={() => toggleOne(r.id)}
                                                        disabled={r.posibleDuplicado}
                                                        title={r.duplicadoMotivo}
                                                    />
                                                </TableCell>
                                                <TableCell />
                                                <TableCell className="text-sm">
                                                    {r.childName}
                                                    {r.posibleDuplicado && (
                                                        <span
                                                            className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                                                            title={r.duplicadoMotivo}
                                                        >
                                                            <AlertTriangle className="h-3 w-3" /> ya pagó
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">{r.teamName}</TableCell>
                                                <TableCell className="text-right text-sm">{formatCurrency(r.amount)}</TableCell>
                                                <TableCell className="text-sm">{formatDate(r.dueDate)}</TableCell>
                                                <TableCell>
                                                    {r.status === 'overdue' ? (
                                                        <Badge variant="destructive" className="text-[10px]">
                                                            {Math.max(0, daysDiffFromToday(r.dueDate))}d
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-[10px]">Pend.</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => sendWhatsApp(r)}
                                                        disabled={!r.parentPhone || sendingWA === r.id}
                                                    >
                                                        {sendingWA === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <TableRefreshBar
                        onRefresh={loadReminders}
                        loading={loading}
                        summary={`${filteredReminders.length} recordatorio(s) · ${filteredStats.parents} acudiente(s)`}
                    />
                </Card>
            )}
        </div>

        <ReminderHistoryModal
            open={showHistory}
            onOpenChange={setShowHistory}
            schoolId={schoolId ?? ''}
        />
        </>
    );
}
