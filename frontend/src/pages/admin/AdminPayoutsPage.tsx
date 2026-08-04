import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PAYOUT_STATUS_COLOR, PAYOUT_STATUS_LABEL, type VendorPayout } from '@/hooks/usePayouts';
import { Loader2, ShieldCheck, RefreshCw, Wand2, CheckCircle2, PauseCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatCOP(n: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function AdminPayoutsPage() {
    const { session } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [selected, setSelected]         = useState<VendorPayout | null>(null);
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [bankRef, setBankRef]           = useState('');
    const [notes, setNotes]               = useState('');
    const [processing, setProcessing]     = useState(false);

    const { data: payouts = [], isLoading } = useQuery({
        queryKey: ['admin-payouts', statusFilter],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<VendorPayout[]> => {
            const url = `${API_URL}/api/v1/admin/payouts?status=${statusFilter}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
            if (!res.ok) throw new Error('Error');
            const json = await res.json();
            return (json.data as VendorPayout[]) || [];
        },
    });

    const markPaid = async () => {
        if (!selected) return;
        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/payouts/${selected.id}/mark-paid`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ bankReference: bankRef, notes }),
            });
            if (!res.ok) {
                const json = await res.json();
                toast({ title: 'Error', description: json.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'Pago confirmado' });
            setMarkPaidOpen(false);
            setSelected(null);
            setBankRef('');
            setNotes('');
            qc.invalidateQueries({ queryKey: ['admin-payouts'] });
        } finally {
            setProcessing(false);
        }
    };

    const hold = async (id: string) => {
        const reason = prompt('Motivo para poner en espera:');
        if (!reason) return;
        const res = await fetch(`${API_URL}/api/v1/admin/payouts/${id}/hold`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ notes: reason }),
        });
        if (res.ok) {
            toast({ title: 'En espera' });
            qc.invalidateQueries({ queryKey: ['admin-payouts'] });
        }
    };

    const releaseAll = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/payouts/release-all`, {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            const json = await res.json();
            if (!res.ok) {
                toast({ title: 'Error', description: json.error, variant: 'destructive' });
                return;
            }
            toast({
                title:       'Escrows liberados',
                description: `${json.data?.released_count || 0} settlements movidos a available.`,
            });
            qc.invalidateQueries({ queryKey: ['admin-payouts'] });
        } finally {
            setProcessing(false);
        }
    };

    const generatePayouts = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/payouts/generate`, {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            const json = await res.json();
            if (!res.ok) {
                toast({ title: 'Error', description: json.error, variant: 'destructive' });
                return;
            }
            toast({
                title:       'Payouts generados',
                description: `${json.data?.payouts_created || 0} payouts creados por ${formatCOP(json.data?.total_amount || 0)}.`,
            });
            qc.invalidateQueries({ queryKey: ['admin-payouts'] });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Liquidaciones · Admin
                    </h1>
                    <p className="text-sm text-muted-foreground">Aprueba y confirma pagos a vendors. Corre los jobs de release/generate periódicamente.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={releaseAll} disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Liberar escrows
                    </Button>
                    <Button onClick={generatePayouts} disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                        Auto-generar payouts
                    </Button>
                </div>
            </header>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base">Lista de payouts</CardTitle>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pendientes</SelectItem>
                            <SelectItem value="scheduled">Programados</SelectItem>
                            <SelectItem value="on_hold">En espera</SelectItem>
                            <SelectItem value="paid">Pagados</SelectItem>
                            <SelectItem value="failed">Fallidos</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : payouts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No hay payouts en este estado.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Monto neto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString('es-CO')}</TableCell>
                                        <TableCell className="text-xs font-mono">{p.vendor_id.slice(0, 8)}...</TableCell>
                                        <TableCell className="font-medium">{formatCOP(p.net_amount)}</TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] ${PAYOUT_STATUS_COLOR[p.status]}`}>{PAYOUT_STATUS_LABEL[p.status]}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {(p.status === 'pending' || p.status === 'scheduled' || p.status === 'on_hold') && (
                                                    <>
                                                        <Button size="sm" onClick={() => { setSelected(p); setMarkPaidOpen(true); }}>
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar pago
                                                        </Button>
                                                        {p.status !== 'on_hold' && (
                                                            <Button size="sm" variant="outline" onClick={() => hold(p.id)}>
                                                                <PauseCircle className="h-3.5 w-3.5 mr-1" /> En espera
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                {p.bank_reference && <span className="text-[10px] text-muted-foreground self-center">{p.bank_reference}</span>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar pago manual</DialogTitle>
                    </DialogHeader>
                    {selected && (
                        <div className="space-y-3">
                            <p className="text-sm">Monto: <strong>{formatCOP(selected.net_amount)}</strong></p>
                            <div>
                                <Label>Referencia bancaria *</Label>
                                <Input value={bankRef} onChange={e => setBankRef(e.target.value)} placeholder="Núm. confirmación, FOLIO..." />
                            </div>
                            <div>
                                <Label>Notas (opcional)</Label>
                                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>Cancelar</Button>
                        <Button onClick={markPaid} disabled={processing || !bankRef}>
                            {processing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            Marcar como pagado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
