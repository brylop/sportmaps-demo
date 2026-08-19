import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEntitlements } from '@/hooks/useEntitlements';
import { formatCurrency } from '@/lib/utils';
import { dayToLocalDate } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    BookOpen, TrendingUp, TrendingDown, Scale, Plus, Loader2, AlertCircle, RefreshCw, Paperclip, Lock,
} from 'lucide-react';
import { InvoicingTab } from '@/components/accounting/InvoicingTab';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { z } from 'zod';
import { validate, zRequiredText, zAmountPositive } from '@/lib/formValidation';

const expenseSchema = z.object({
    category_id: zRequiredText('La categoría'),
    concept: zRequiredText('El concepto'),
    amount: zAmountPositive('El monto'),
});
const ExpErr = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null);

interface LedgerRow {
    direction: 'income' | 'expense';
    id: string;
    school_id: string;
    branch_id: string | null;
    concept: string;
    category_id: string | null;
    amount: number;
    movement_date: string | null;
    source: string;
    status: string;
}

interface Category {
    id: string;
    name: string;
    is_system: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AccountingPage() {
    const { schoolId, activeBranchId } = useSchoolContext();
    const { user } = useAuth();
    const { toast } = useToast();
    const { hasAddon, isLoading: entLoading } = useEntitlements();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);

    // Fase 1: abrir comprobantes de un gasto (signed URLs; bucket privado).
    const viewReceipts = async (expenseId: string) => {
        const { data, error } = await supabase
            .from('expense_attachments')
            .select('storage_path, file_name')
            .eq('expense_id', expenseId);
        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            return;
        }
        if (!data || data.length === 0) {
            toast({ title: 'Sin comprobante', description: 'Este gasto no tiene soporte adjunto.' });
            return;
        }
        for (const a of data) {
            const signed = await supabase.storage
                .from('accounting-receipts')
                .createSignedUrl(a.storage_path, 60);
            if (signed.data?.signedUrl) window.open(signed.data.signedUrl, '_blank');
        }
    };

    // ─── Libro de caja (ingresos + egresos) ───────────────────────────────────
    const ledgerQuery = useQuery({
        queryKey: ['cash-ledger', schoolId, activeBranchId],
        enabled: !!schoolId,
        queryFn: async () => {
            // Contexto de entidad: esta página es la de la escuela (owner_type='school').
            // Para vendor/organizer se reutiliza la misma lógica cambiando owner_*.
            let q = supabase
                .from('cash_ledger')
                .select('*')
                .eq('owner_type', 'school')
                .eq('owner_id', schoolId)
                .order('movement_date', { ascending: false });
            // Un movimiento con `branch_id` NULL es uno SIN sede asignada, no de otra
            // sede. La mayoría de los ingresos vienen de `payments`, y ahí 266 de 593
            // filas de Dynasty no tienen sede: con `.eq()` el libro de caja escondía
            // la mitad del ingreso al seleccionar una sede.
            if (activeBranchId) q = q.or(`branch_id.is.null,branch_id.eq.${activeBranchId}`);
            const { data, error } = await q;
            if (error) throw error;
            return (data ?? []) as LedgerRow[];
        },
    });

    // ─── Categorías (sistema + de la escuela) ──────────────────────────────────
    const categoriesQuery = useQuery({
        queryKey: ['expense-categories', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('expense_categories')
                .select('id, name, is_system')
                .eq('active', true)
                .or(`owner_id.is.null,owner_id.eq.${schoolId}`)
                .order('name');
            if (error) throw error;
            return (data ?? []) as Category[];
        },
    });

    const rows = ledgerQuery.data ?? [];
    const [directionFilter, setDirectionFilter] = useState<string | null>(null);
    const filteredRows = directionFilter ? rows.filter(r => r.direction === directionFilter) : rows;
    const directionCounts = {
        income: rows.filter(r => r.direction === 'income').length,
        expense: rows.filter(r => r.direction === 'expense').length,
    };
    const totals = useMemo(() => {
        let income = 0, expense = 0;
        for (const r of rows) {
            if (r.direction === 'income') income += Number(r.amount);
            else expense += Number(r.amount);
        }
        return { income, expense, net: income - expense };
    }, [rows]);

    if (ledgerQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-7 w-7 text-primary" /> Contabilidad
                </h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar el libro de caja</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Ocurrió un error de conexión. Esto <strong>no</strong> significa que no haya movimientos.</span>
                        <Button size="sm" variant="outline" onClick={() => ledgerQuery.refetch()}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Módulo de pago: requiere el add-on 'accounting' (incluido en Elite).
    if (!entLoading && !hasAddon('accounting')) {
        return (
            <div className="container mx-auto p-6">
                <div className="max-w-lg mx-auto text-center rounded-2xl border bg-card p-10 mt-8">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Lock className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">Contabilidad</h1>
                    <p className="text-muted-foreground mt-2">
                        Este módulo no está activo en tu plan. La <strong>Contabilidad</strong> viene incluida en el plan <strong>Elite</strong>, o se activa como módulo aparte.
                    </p>
                    <a href="/admin/mi-plan" className="inline-flex mt-6 items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                        Ver planes y activar
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-7 w-7 text-primary" /> Contabilidad
                    </h1>
                    <p className="text-muted-foreground">Libro de caja — ingresos y egresos</p>
                </div>
                <RegisterExpenseDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    categories={categoriesQuery.data ?? []}
                    disabled={!schoolId}
                    onSubmit={async (payload) => {
                        if (!schoolId || !user?.id) return;
                        const { data: created, error } = await supabase.from('expenses').insert({
                            owner_type: 'school',
                            owner_id: schoolId,
                            school_id: schoolId,
                            branch_id: activeBranchId || null,
                            category_id: payload.category_id,
                            kind: 'manual',
                            status: 'paid',
                            concept: payload.concept,
                            amount: payload.amount,
                            expense_date: payload.expense_date,
                            paid_date: payload.paid_date || payload.expense_date,
                            payment_method: payload.payment_method || null,
                            reference: payload.reference || null,
                            notes: payload.notes || null,
                            created_by: user.id,
                        }).select('id').single();
                        if (error || !created) {
                            toast({ title: 'Error al registrar el gasto', description: error?.message, variant: 'destructive' });
                            return;
                        }
                        // Fase 1: subir comprobante opcional y registrar el puntero.
                        if (payload.file) {
                            const safeName = payload.file.name.replace(/[^\w.-]/g, '_');
                            const path = `${created.id}/${Date.now()}-${safeName}`;
                            const up = await supabase.storage
                                .from('accounting-receipts')
                                .upload(path, payload.file, { upsert: false });
                            if (up.error) {
                                toast({ title: 'Gasto guardado, pero el comprobante falló', description: up.error.message, variant: 'destructive' });
                            } else {
                                await supabase.from('expense_attachments').insert({
                                    expense_id: created.id,
                                    storage_path: path,
                                    file_name: payload.file.name,
                                    mime_type: payload.file.type || null,
                                    size_bytes: payload.file.size,
                                    uploaded_by: user.id,
                                });
                            }
                        }
                        toast({ title: 'Gasto registrado', description: `${payload.concept} · ${formatCurrency(payload.amount)}` });
                        setDialogOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['cash-ledger', schoolId, activeBranchId] });
                    }}
                />
            </div>

            <Tabs defaultValue="ledger" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="ledger">Libro de caja</TabsTrigger>
                    <TabsTrigger value="einvoicing">Facturación electrónica</TabsTrigger>
                </TabsList>
                <TabsContent value="ledger" className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.income)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Egresos</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.expense)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Flujo neto</CardTitle>
                        <Scale className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(totals.net)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Movimientos */}
            <Card>
                <CardHeader>
                    <CardTitle>Movimientos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-6 pb-4">
                        <StatFilterBar
                            columns={3}
                            value={directionFilter}
                            onChange={setDirectionFilter}
                            items={[
                                { key: null, label: 'Todos', value: rows.length, tone: 'neutral' },
                                { key: 'income', label: 'Ingresos', value: directionCounts.income, tone: 'emerald' },
                                { key: 'expense', label: 'Egresos', value: directionCounts.expense, tone: 'rose' },
                            ]}
                        />
                    </div>
                    {ledgerQuery.isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <BookOpen className="h-10 w-10 opacity-30" />
                            <p className="text-sm">
                                {directionFilter
                                    ? `No hay ${directionFilter === 'income' ? 'ingresos' : 'egresos'} en este periodo.`
                                    : 'Aún no hay movimientos. Registra un gasto o confirma un pago.'}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Concepto</TableHead>
                                    <TableHead>Origen</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.map((r) => (
                                    <TableRow key={`${r.source}-${r.id}`}>
                                        <TableCell className="text-sm">
                                            {/* `movement_date` es `date`: con `new Date()` se parsea
                                                en UTC y el movimiento se veía un día antes. */}
                                            {r.movement_date ? dayToLocalDate(r.movement_date).toLocaleDateString('es-CO') : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {r.direction === 'income' ? (
                                                <Badge className="bg-emerald-500 text-white">Ingreso</Badge>
                                            ) : (
                                                <Badge variant="destructive">Egreso</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {r.concept}
                                            {r.direction === 'expense' && (
                                                <button
                                                    type="button"
                                                    onClick={() => viewReceipts(r.id)}
                                                    title="Ver comprobante"
                                                    className="ml-2 align-middle text-muted-foreground hover:text-primary"
                                                >
                                                    <Paperclip className="inline h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {r.source === 'payment' ? 'Pago' : 'Gasto'}
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${r.direction === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {r.direction === 'income' ? '+' : '−'}{formatCurrency(Number(r.amount))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <TableRefreshBar
                        onRefresh={() => ledgerQuery.refetch()}
                        loading={ledgerQuery.isFetching}
                        summary={
                            filteredRows.length === rows.length
                                ? `${rows.length} movimiento(s)`
                                : `${filteredRows.length} de ${rows.length} movimiento(s)`
                        }
                    />
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="einvoicing">
                    {!hasAddon('invoicing') ? (
                        <div className="max-w-lg mx-auto text-center rounded-2xl border bg-card p-8">
                            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                                <Lock className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold">Facturación electrónica</h3>
                            <p className="text-muted-foreground text-sm mt-2">
                                Módulo no activo. La facturación electrónica DIAN viene incluida en <strong>Elite</strong> o se activa aparte (cobro por volumen de documentos).
                            </p>
                            <a href="/admin/mi-plan" className="inline-flex mt-5 items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                                Ver planes y activar
                            </a>
                        </div>
                    ) : schoolId
                        ? <InvoicingTab ownerType="school" ownerId={schoolId} />
                        : <p className="text-sm text-muted-foreground">Selecciona una escuela para configurar la facturación.</p>}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Modal: registrar gasto ─────────────────────────────────────────────────
interface ExpensePayload {
    category_id: string;
    concept: string;
    amount: number;
    expense_date: string;
    paid_date: string;
    // El enum pay_method de la base, no un string libre: `expenses.payment_method`
    // lo rechaza si no es uno de estos.
    payment_method: '' | 'pse' | 'card' | 'transfer' | 'cash' | 'other';
    reference: string;
    notes: string;
    file: File | null;
}

function RegisterExpenseDialog({
    open, onOpenChange, categories, disabled, onSubmit,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    categories: Category[];
    disabled?: boolean;
    onSubmit: (p: ExpensePayload) => Promise<void>;
}) {
    const { toast } = useToast();
    const [categoryId, setCategoryId] = useState('');
    const [concept, setConcept] = useState('');
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(todayIso());
    // El enum pay_method de la base, igual que en el pago a proveedores.
    type MetodoPago = 'pse' | 'card' | 'transfer' | 'cash' | 'other';
    const [paymentMethod, setPaymentMethod] = useState<MetodoPago>('transfer');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: async () => {
            await onSubmit({
                category_id: categoryId,
                concept: concept.trim(),
                amount: Number(amount),
                expense_date: expenseDate,
                paid_date: expenseDate,
                payment_method: paymentMethod,
                reference,
                notes,
                file,
            });
        },
        onError: (err: any) => {
            toast({ title: 'No se pudo registrar', description: err.message, variant: 'destructive' });
        },
        onSuccess: () => {
            setCategoryId(''); setConcept(''); setAmount(''); setExpenseDate(todayIso());
            setPaymentMethod('transfer'); setReference(''); setNotes(''); setFile(null); setErrors({});
        },
    });

    const handleSubmit = () => {
        const r = validate(expenseSchema, { category_id: categoryId, concept, amount });
        if (r.errors) { setErrors(r.errors); return; }
        setErrors({}); mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button disabled={disabled}>
                    <Plus className="mr-2 h-4 w-4" /> Registrar gasto
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar gasto</DialogTitle>
                    <DialogDescription>Queda registrado como egreso pagado en el libro de caja.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>Categoría <span className="text-destructive">*</span></Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger aria-invalid={!!errors.category_id}><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <ExpErr msg={errors.category_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Concepto <span className="text-destructive">*</span></Label>
                        <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Arriendo julio sede norte" aria-invalid={!!errors.concept} />
                        <ExpErr msg={errors.concept} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Monto (COP) <span className="text-destructive">*</span></Label>
                            <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-invalid={!!errors.amount} />
                            <ExpErr msg={errors.amount} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha</Label>
                            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Método de pago</Label>
                            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as MetodoPago)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="transfer">Transferencia</SelectItem>
                                    <SelectItem value="cash">Efectivo</SelectItem>
                                    <SelectItem value="card">Tarjeta</SelectItem>
                                    <SelectItem value="pse">PSE</SelectItem>
                                    <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Referencia (opcional)</Label>
                            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="# comprobante" />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Notas (opcional)</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Comprobante (opcional)</Label>
                        <Input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Guardar gasto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
