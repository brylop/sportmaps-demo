import { useState } from 'react';
import { useVendorBalance, useVendorPayouts, useBankAccounts, usePayoutMutations, PAYOUT_STATUS_LABEL, PAYOUT_STATUS_COLOR, ACCOUNT_TYPE_LABEL, BankAccount } from '@/hooks/usePayouts';
import { BankAccountForm } from '@/components/vendor/BankAccountForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Plus, ArrowDownToLine, Loader2, Building2, CheckCircle2, AlertTriangle, Edit, Trash2, Star } from 'lucide-react';

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

export default function VendorPayoutsPage() {
    const { toast } = useToast();
    const { data: balance, isLoading: balanceLoading } = useVendorBalance();
    const { data: payouts = [], isLoading: payoutsLoading } = useVendorPayouts();
    const { data: bankAccounts = [], isLoading: banksLoading } = useBankAccounts();
    const { requestPayout, deleteBankAccount, setDefaultBankAccount } = usePayoutMutations();

    const [bankFormOpen, setBankFormOpen]   = useState(false);
    const [editingBank, setEditingBank]     = useState<BankAccount | null>(null);

    const summary = balance && !('error' in balance) ? balance : null;

    const handleRequestPayout = async () => {
        try {
            await requestPayout.mutateAsync(undefined);
            toast({ title: 'Liquidación solicitada', description: 'Recibirás tu pago en máx. 3 días hábiles.' });
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        }
    };

    if (balanceLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-5xl">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-primary" />
                    Mis liquidaciones
                </h1>
                <p className="text-sm text-muted-foreground">Cobra lo que has vendido. SportMaps retiene 10% como comisión.</p>
            </header>

            {/* Balance cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Disponible</p>
                            <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCOP(summary.available_balance)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Listo para retirar</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">En espera</p>
                            <p className="text-2xl font-bold mt-1 text-amber-600">{formatCOP(summary.pending_balance)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Tras periodo escrow (7d)</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total ganado</p>
                            <p className="text-2xl font-bold mt-1">{formatCOP(summary.total_earned)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Bruto histórico</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Retirado</p>
                            <p className="text-2xl font-bold mt-1">{formatCOP(summary.total_withdrawn)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Pagado a tu cuenta</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* CTA request payout */}
            {summary && (
                <Card className={summary.can_request_payout ? 'border-emerald-300 bg-emerald-50/40' : ''}>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <ArrowDownToLine className="h-5 w-5" />
                                    Solicitar liquidación
                                </h3>
                                {!summary.has_bank_account ? (
                                    <p className="text-sm text-muted-foreground">Agrega una cuenta bancaria primero.</p>
                                ) : summary.available_balance < summary.min_payout_amount ? (
                                    <p className="text-sm text-muted-foreground">
                                        Mínimo {formatCOP(summary.min_payout_amount)}. Te faltan {formatCOP(summary.min_payout_amount - summary.available_balance)}.
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Tienes {formatCOP(summary.available_balance)} disponibles. Se transfieren en máx. 3 días hábiles.
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={handleRequestPayout}
                                disabled={!summary.can_request_payout || requestPayout.isPending}
                                size="lg"
                            >
                                {requestPayout.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-1.5" />}
                                Cobrar {formatCOP(summary.available_balance)}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bank accounts */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-5 w-5" />
                        Cuentas bancarias
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => { setEditingBank(null); setBankFormOpen(true); }}>
                        <Plus className="h-4 w-4 mr-1" /> Agregar cuenta
                    </Button>
                </CardHeader>
                <CardContent>
                    {banksLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : bankAccounts.length === 0 ? (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Sin cuentas bancarias</AlertTitle>
                            <AlertDescription>
                                Agrega al menos una cuenta para poder solicitar liquidaciones.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-2">
                            {bankAccounts.map(b => (
                                <div key={b.id} className="flex items-center justify-between rounded-md border p-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{b.bank_name}</span>
                                            <Badge variant="outline" className="text-[10px]">{ACCOUNT_TYPE_LABEL[b.account_type]}</Badge>
                                            {b.is_default && <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">Predeterminada</Badge>}
                                            {b.verified_at && <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Verificada</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {b.account_holder} · {b.document_type} {b.document_number} · ****{b.account_number.slice(-4)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!b.is_default && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                                title="Hacer predeterminada"
                                                onClick={() => setDefaultBankAccount.mutate(b.id)}>
                                                <Star className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingBank(b); setBankFormOpen(true); }}>
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                            onClick={() => { if (confirm('¿Eliminar esta cuenta?')) deleteBankAccount.mutate(b.id); }}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lista de payouts */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Historial de liquidaciones</CardTitle>
                </CardHeader>
                <CardContent>
                    {payoutsLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : payouts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Aún no has solicitado liquidaciones.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Referencia</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString('es-CO')}</TableCell>
                                        <TableCell className="text-sm font-medium">{formatCOP(p.net_amount)}</TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] ${PAYOUT_STATUS_COLOR[p.status]}`}>
                                                {PAYOUT_STATUS_LABEL[p.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{p.bank_reference || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <BankAccountForm open={bankFormOpen} onOpenChange={setBankFormOpen} initial={editingBank} />
        </div>
    );
}
