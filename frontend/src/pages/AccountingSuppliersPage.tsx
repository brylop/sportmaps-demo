import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { dayToLocalDate } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, Plus, Loader2, AlertCircle, RefreshCw, Wallet, CalendarClock, DollarSign } from 'lucide-react';
import { z } from 'zod';
import { validate, zRequiredText, zOptionalText, zEmailOptional, zPhoneOptional, zAmountPositive } from '@/lib/formValidation';

const Err = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null);

const supplierSchema = z.object({
    name: zRequiredText('El nombre'),
    nit: z.string().trim().regex(/^[\d.-]*$/, 'El NIT debe ser numérico').max(20, 'Máximo 20').optional().or(z.literal('')),
    contact: zOptionalText(120),
    email: zEmailOptional(),
    phone: zPhoneOptional(),
});
const billSchema = z.object({
    supplier_id: zRequiredText('El proveedor'),
    invoice_no: zOptionalText(60),
    amount: zAmountPositive('El monto'),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Supplier { id: string; name: string; nit: string | null; contact_name: string | null; email: string | null; phone: string | null; }
interface Bill {
    id: string; supplier_id: string; invoice_no: string | null; amount: number; amount_paid: number;
    issue_date: string; due_date: string; status: string; category_id: string | null;
    suppliers?: { name: string } | null;
}
interface Category { id: string; name: string; }

export default function AccountingSuppliersPage() {
    const { schoolId } = useSchoolContext();
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [supplierOpen, setSupplierOpen] = useState(false);
    const [billOpen, setBillOpen] = useState(false);
    const [payBill, setPayBill] = useState<Bill | null>(null);

    const owner = { owner_type: 'school', owner_id: schoolId };

    const suppliersQuery = useQuery({
        queryKey: ['suppliers', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('suppliers')
                .select('id, name, nit, contact_name, email, phone')
                .eq('owner_type', 'school').eq('owner_id', schoolId).eq('active', true)
                .order('name');
            if (error) throw error;
            return (data ?? []) as Supplier[];
        },
    });

    const billsQuery = useQuery({
        queryKey: ['supplier-bills', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('supplier_bills')
                .select('id, supplier_id, invoice_no, amount, amount_paid, issue_date, due_date, status, category_id, suppliers(name)')
                .eq('owner_type', 'school').eq('owner_id', schoolId)
                .order('due_date', { ascending: true });
            if (error) throw error;
            return (data ?? []) as Bill[];
        },
    });

    const categoriesQuery = useQuery({
        queryKey: ['expense-categories', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('expense_categories')
                .select('id, name').eq('active', true)
                .or(`owner_id.is.null,owner_id.eq.${schoolId}`).order('name');
            if (error) throw error;
            return (data ?? []) as Category[];
        },
    });

    const bills = billsQuery.data ?? [];
    const totals = useMemo(() => {
        const today = todayIso();
        let porPagar = 0, vencido = 0;
        for (const b of bills) {
            if (b.status === 'paid' || b.status === 'void') continue;
            const saldo = Number(b.amount) - Number(b.amount_paid);
            porPagar += saldo;
            if (b.due_date < today) vencido += saldo;
        }
        return { porPagar, vencido };
    }, [bills]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['supplier-bills', schoolId] });
        queryClient.invalidateQueries({ queryKey: ['cash-ledger', schoolId] });
    };

    if (suppliersQuery.isError || billsQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Truck className="h-7 w-7 text-primary" /> Proveedores
                </h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión al cargar proveedores/cuentas por pagar.</span>
                        <Button size="sm" variant="outline" onClick={() => { suppliersQuery.refetch(); billsQuery.refetch(); }}>
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
                        <Truck className="h-7 w-7 text-primary" /> Proveedores y cuentas por pagar
                    </h1>
                    <p className="text-muted-foreground">Registra proveedores, facturas y sus pagos.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" disabled={!schoolId} onClick={() => setSupplierOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Proveedor
                    </Button>
                    <Button disabled={!schoolId || (suppliersQuery.data ?? []).length === 0} onClick={() => setBillOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Factura
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total por pagar</CardTitle>
                        <Wallet className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.porPagar)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vencido</CardTitle>
                        <CalendarClock className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totals.vencido)}</div></CardContent>
                </Card>
            </div>

            {/* Cuentas por pagar */}
            <Card>
                <CardHeader><CardTitle>Cuentas por pagar</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {billsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : bills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Wallet className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No hay facturas registradas.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Factura</TableHead>
                                    <TableHead>Vence</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bills.map((b) => {
                                    const saldo = Number(b.amount) - Number(b.amount_paid);
                                    const overdue = b.due_date < todayIso() && b.status !== 'paid' && b.status !== 'void';
                                    return (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-medium">{b.suppliers?.name ?? '—'}</TableCell>
                                            <TableCell className="text-sm">{b.invoice_no || '—'}</TableCell>
                                            {/* `due_date` es `date`: con `new Date()` se veía un día antes. */}
                                            <TableCell className="text-sm">{dayToLocalDate(b.due_date).toLocaleDateString('es-CO')}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(Number(b.amount))}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(saldo)}</TableCell>
                                            <TableCell>
                                                {b.status === 'paid' ? <Badge className="bg-emerald-500 text-white">Pagada</Badge>
                                                    : overdue ? <Badge variant="destructive">Vencida</Badge>
                                                    : b.status === 'partially_paid' ? <Badge className="bg-amber-500 text-white">Abonada</Badge>
                                                    : <Badge variant="secondary">Abierta</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {b.status !== 'paid' && b.status !== 'void' && (
                                                    <Button size="sm" variant="outline" onClick={() => setPayBill(b)}>
                                                        <DollarSign className="mr-1 h-3.5 w-3.5" /> Pagar
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Proveedores */}
            <Card>
                <CardHeader><CardTitle>Proveedores</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {suppliersQuery.isLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (suppliersQuery.data ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Truck className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Aún no hay proveedores. Agrega el primero.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>NIT/CC</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(suppliersQuery.data ?? []).map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell className="text-sm">{s.nit || '—'}</TableCell>
                                        <TableCell className="text-sm">{s.contact_name || s.email || '—'}</TableCell>
                                        <TableCell className="text-sm">{s.phone || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <SupplierDialog
                open={supplierOpen} onOpenChange={setSupplierOpen}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ['suppliers', schoolId] })}
                owner={owner}
            />
            <BillDialog
                open={billOpen} onOpenChange={setBillOpen}
                suppliers={suppliersQuery.data ?? []} categories={categoriesQuery.data ?? []}
                userId={user?.id} owner={owner} onSaved={invalidate}
            />
            <PayBillDialog bill={payBill} onOpenChange={(v) => !v && setPayBill(null)} onPaid={invalidate} />
        </div>
    );
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────
function SupplierDialog({ open, onOpenChange, onSaved, owner }: {
    open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
    owner: { owner_type: string; owner_id: string | undefined };
}) {
    const { toast } = useToast();
    const [name, setName] = useState(''); const [nit, setNit] = useState('');
    const [contact, setContact] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: async () => {
            if (!owner.owner_id) throw new Error('Sin escuela');
            const { error } = await supabase.from('suppliers').insert({
                owner_type: owner.owner_type, owner_id: owner.owner_id,
                name: name.trim(), nit: nit || null, contact_name: contact || null,
                email: email || null, phone: phone || null,
            });
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
        onSuccess: () => {
            toast({ title: 'Proveedor agregado' });
            setName(''); setNit(''); setContact(''); setEmail(''); setPhone(''); setErrors({});
            onOpenChange(false); onSaved();
        },
    });

    const handleSubmit = () => {
        const r = validate(supplierSchema, { name, nit, contact, email, phone });
        if (r.errors) { setErrors(r.errors); return; }
        setErrors({}); mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Nuevo proveedor</DialogTitle><DialogDescription>Datos del proveedor.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>Nombre <span className="text-destructive">*</span></Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
                        <Err msg={errors.name} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>NIT/CC</Label><Input inputMode="numeric" value={nit} onChange={(e) => setNit(e.target.value)} aria-invalid={!!errors.nit} /><Err msg={errors.nit} /></div>
                        <div className="grid gap-2"><Label>Teléfono</Label><Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} /><Err msg={errors.phone} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Contacto</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
                        <div className="grid gap-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} /><Err msg={errors.email} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BillDialog({ open, onOpenChange, suppliers, categories, userId, owner, onSaved }: {
    open: boolean; onOpenChange: (v: boolean) => void;
    suppliers: Supplier[]; categories: Category[]; userId?: string;
    owner: { owner_type: string; owner_id: string | undefined }; onSaved: () => void;
}) {
    const { toast } = useToast();
    const [supplierId, setSupplierId] = useState(''); const [categoryId, setCategoryId] = useState('');
    const [invoiceNo, setInvoiceNo] = useState(''); const [amount, setAmount] = useState('');
    const [issueDate, setIssueDate] = useState(todayIso()); const [dueDate, setDueDate] = useState(todayIso());
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: async () => {
            if (!owner.owner_id || !userId) throw new Error('Sin escuela/usuario');
            const { error } = await supabase.from('supplier_bills').insert({
                owner_type: owner.owner_type, owner_id: owner.owner_id,
                supplier_id: supplierId, category_id: categoryId || null,
                invoice_no: invoiceNo || null, amount: Number(amount),
                issue_date: issueDate, due_date: dueDate, created_by: userId,
            });
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
        onSuccess: () => {
            toast({ title: 'Factura registrada' });
            setSupplierId(''); setCategoryId(''); setInvoiceNo(''); setAmount(''); setIssueDate(todayIso()); setDueDate(todayIso()); setErrors({});
            onOpenChange(false); onSaved();
        },
    });

    const handleSubmit = () => {
        const base = validate(billSchema, { supplier_id: supplierId, invoice_no: invoiceNo, amount });
        const errs = base.errors ?? {};
        if (dueDate < issueDate) errs.dueDate = 'El vencimiento no puede ser antes de la emisión';
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setErrors({}); mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Nueva factura por pagar</DialogTitle><DialogDescription>Cuenta por pagar a un proveedor.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>Proveedor <span className="text-destructive">*</span></Label>
                        <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger aria-invalid={!!errors.supplier_id}><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                            <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Err msg={errors.supplier_id} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label># Factura</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></div>
                        <div className="grid gap-2"><Label>Monto (COP) <span className="text-destructive">*</span></Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} /><Err msg={errors.amount} /></div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Categoría (opcional)</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                            <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Emisión</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
                        <div className="grid gap-2"><Label>Vence</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!errors.dueDate} /><Err msg={errors.dueDate} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PayBillDialog({ bill, onOpenChange, onPaid }: {
    bill: Bill | null; onOpenChange: (v: boolean) => void; onPaid: () => void;
}) {
    const { toast } = useToast();
    const saldo = bill ? Number(bill.amount) - Number(bill.amount_paid) : 0;
    const [amount, setAmount] = useState('');
    const [paidDate, setPaidDate] = useState(todayIso());
    // El enum pay_method de la base, que es lo que espera pay_supplier_bill. El
    // Select de abajo ofrece exactamente estos cinco, asi que tipar cierra.
    const [method, setMethod] = useState<'pse' | 'card' | 'transfer' | 'cash' | 'other'>('transfer');
    const [reference, setReference] = useState('');

    // Prefill al abrir
    const open = !!bill;
    const currentSaldo = saldo;

    const mutation = useMutation({
        mutationFn: async () => {
            if (!bill) return;
            const amt = amount ? Number(amount) : currentSaldo;
            if (!Number.isFinite(amt) || amt <= 0) throw new Error('Monto inválido');
            if (amt > currentSaldo) throw new Error('El monto supera el saldo');
            const { data, error } = await supabase.rpc('pay_supplier_bill', {
                p_bill_id: bill.id, p_amount: amt, p_paid_date: paidDate,
                p_payment_method: method, p_reference: reference || null,
            });
            if (error) throw error;
            if (data && (data as any).ok === false) throw new Error((data as any).error || 'Error');
        },
        onError: (e: any) => toast({ title: 'No se pudo registrar el pago', description: e.message, variant: 'destructive' }),
        onSuccess: () => {
            toast({ title: 'Pago registrado', description: 'El egreso quedó en el libro de caja.' });
            setAmount(''); setPaidDate(todayIso()); setMethod('transfer'); setReference('');
            onOpenChange(false); onPaid();
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar pago</DialogTitle>
                    <DialogDescription>
                        {bill?.suppliers?.name} · saldo {formatCurrency(currentSaldo)}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Monto (vacío = saldo total)</Label>
                            <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(currentSaldo)} />
                        </div>
                        <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Método</Label>
                            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
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
                        <div className="grid gap-2"><Label>Referencia</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />} Pagar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
