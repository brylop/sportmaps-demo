import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { usePayoutMutations, BankAccount, BANK_OPTIONS, ACCOUNT_TYPE_LABEL } from '@/hooks/usePayouts';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
    open:         boolean;
    onOpenChange: (open: boolean) => void;
    initial?:     BankAccount | null;
}

export function BankAccountForm({ open, onOpenChange, initial }: Props) {
    const { toast } = useToast();
    const { createBankAccount, updateBankAccount } = usePayoutMutations();

    const [form, setForm] = useState({
        bank_name:       initial?.bank_name || '',
        account_type:    (initial?.account_type || 'ahorros') as BankAccount['account_type'],
        account_number:  initial?.account_number || '',
        account_holder:  initial?.account_holder || '',
        document_type:   (initial?.document_type || 'CC') as BankAccount['document_type'],
        document_number: initial?.document_number || '',
        email:           initial?.email || '',
        phone:           initial?.phone || '',
        is_default:      initial?.is_default ?? true,
    });

    const canSubmit = form.bank_name && form.account_number && form.account_holder && form.document_number;
    const saving = createBankAccount.isPending || updateBankAccount.isPending;

    const submit = async () => {
        try {
            if (initial) {
                await updateBankAccount.mutateAsync({ id: initial.id, ...form });
                toast({ title: 'Cuenta actualizada' });
            } else {
                await createBankAccount.mutateAsync(form as any);
                toast({ title: 'Cuenta agregada', description: 'Ya puedes solicitar liquidaciones.' });
            }
            onOpenChange(false);
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initial ? 'Editar cuenta bancaria' : 'Agregar cuenta bancaria'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Banco / Billetera *</Label>
                        <Select value={form.bank_name} onValueChange={v => setForm(p => ({ ...p, bank_name: v }))}>
                            <SelectTrigger><SelectValue placeholder="Selecciona banco" /></SelectTrigger>
                            <SelectContent>
                                {BANK_OPTIONS.map(b => <SelectItem key={b.value} value={b.label}>{b.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Tipo de cuenta *</Label>
                            <Select value={form.account_type} onValueChange={(v: any) => setForm(p => ({ ...p, account_type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => (
                                        <SelectItem key={v} value={v}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Número *</Label>
                            <Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} placeholder="000-000000-00" />
                        </div>
                    </div>

                    <div>
                        <Label>Titular (nombre completo) *</Label>
                        <Input value={form.account_holder} onChange={e => setForm(p => ({ ...p, account_holder: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Tipo doc. *</Label>
                            <Select value={form.document_type} onValueChange={(v: any) => setForm(p => ({ ...p, document_type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CC">Cédula</SelectItem>
                                    <SelectItem value="CE">Cédula extranjería</SelectItem>
                                    <SelectItem value="NIT">NIT</SelectItem>
                                    <SelectItem value="PASS">Pasaporte</SelectItem>
                                    <SelectItem value="PEP">PEP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Número doc. *</Label>
                            <Input value={form.document_number} onChange={e => setForm(p => ({ ...p, document_number: e.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Email (opcional)</Label>
                            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Teléfono (opcional)</Label>
                            <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+57 300..." />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                        <Checkbox checked={form.is_default} onCheckedChange={c => setForm(p => ({ ...p, is_default: !!c }))} />
                        Usar como cuenta por defecto para liquidaciones
                    </label>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={submit} disabled={!canSubmit || saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        {initial ? 'Guardar' : 'Agregar cuenta'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
