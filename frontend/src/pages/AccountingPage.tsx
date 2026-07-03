import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
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
import {
    BookOpen, TrendingUp, TrendingDown, Scale, Plus, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

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
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);

    // ─── Libro de caja (ingresos + egresos) ───────────────────────────────────
    const ledgerQuery = useQuery({
        queryKey: ['cash-ledger', schoolId, activeBranchId],
        enabled: !!schoolId,
        queryFn: async () => {
            let q = supabase
                .from('cash_ledger')
                .select('*')
                .eq('school_id', schoolId)
                .order('movement_date', { ascending: false });
            if (activeBranchId) q = q.eq('branch_id', activeBranchId);
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
                .or(`school_id.is.null,school_id.eq.${schoolId}`)
                .order('name');
            if (error) throw error;
            return (data ?? []) as Category[];
        },
    });

    const rows = ledgerQuery.data ?? [];
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
                        const { error } = await supabase.from('expenses').insert({
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
                        });
                        if (error) {
                            toast({ title: 'Error al registrar el gasto', description: error.message, variant: 'destructive' });
                            return;
                        }
                        toast({ title: 'Gasto registrado', description: `${payload.concept} · ${formatCurrency(payload.amount)}` });
                        setDialogOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['cash-ledger', schoolId, activeBranchId] });
                    }}
                />
            </div>

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
                    {ledgerQuery.isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <BookOpen className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Aún no hay movimientos. Registra un gasto o confirma un pago.</p>
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
                                {rows.map((r) => (
                                    <TableRow key={`${r.source}-${r.id}`}>
                                        <TableCell className="text-sm">
                                            {r.movement_date ? new Date(r.movement_date).toLocaleDateString('es-CO') : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {r.direction === 'income' ? (
                                                <Badge className="bg-emerald-500 text-white">Ingreso</Badge>
                                            ) : (
                                                <Badge variant="destructive">Egreso</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{r.concept}</TableCell>
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
                </CardContent>
            </Card>
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
    payment_method: string;
    reference: string;
    notes: string;
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
    const [paymentMethod, setPaymentMethod] = useState('transfer');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    const mutation = useMutation({
        mutationFn: async () => {
            const amt = Number(amount);
            if (!categoryId) throw new Error('Selecciona una categoría');
            if (!concept.trim()) throw new Error('Escribe un concepto');
            if (!Number.isFinite(amt) || amt <= 0) throw new Error('Monto inválido');
            await onSubmit({
                category_id: categoryId,
                concept: concept.trim(),
                amount: amt,
                expense_date: expenseDate,
                paid_date: expenseDate,
                payment_method: paymentMethod,
                reference,
                notes,
            });
        },
        onError: (err: any) => {
            toast({ title: 'No se pudo registrar', description: err.message, variant: 'destructive' });
        },
        onSuccess: () => {
            setCategoryId(''); setConcept(''); setAmount(''); setExpenseDate(todayIso());
            setPaymentMethod('transfer'); setReference(''); setNotes('');
        },
    });

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
                        <Label>Categoría</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Concepto</Label>
                        <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Arriendo julio sede norte" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Monto (COP)</Label>
                            <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha</Label>
                            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Método de pago</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Guardar gasto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
