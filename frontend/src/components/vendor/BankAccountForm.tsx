import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BankAccountFields } from '@/components/payments/BankAccountFields';
import { usePayoutMutations, BankAccount } from '@/hooks/usePayouts';
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
                    <BankAccountFields
                        value={{
                            bank_name:       form.bank_name,
                            account_type:    form.account_type,
                            account_number:  form.account_number,
                            account_holder:  form.account_holder,
                            document_type:   form.document_type,
                            document_number: form.document_number,
                        }}
                        onChange={(next) => setForm(p => ({
                            ...p,
                            bank_name:       next.bank_name,
                            account_type:    next.account_type as BankAccount['account_type'],
                            account_number:  next.account_number,
                            account_holder:  next.account_holder,
                            document_type:   (next.document_type || 'CC') as BankAccount['document_type'],
                            document_number: next.document_number || '',
                        }))}
                    />

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
