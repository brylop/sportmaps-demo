import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { kardexReasonLabel, type VendorProduct } from '@/lib/store/inventory';
import { getKardex } from '@/lib/store/vendorProductsApi';

interface Props {
    product: VendorProduct | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Historial de movimientos de stock (kardex) de un producto. */
export function KardexDialog({ product, open, onOpenChange }: Props) {
    const { session } = useAuth();
    const q = useQuery({
        queryKey: ['vendor-kardex', product?.id],
        queryFn: () => getKardex(session?.access_token, product!.id),
        enabled: open && !!product && !!session?.access_token,
        retry: false,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Historial de stock</DialogTitle>
                    <DialogDescription>{product?.name}</DialogDescription>
                </DialogHeader>
                {q.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : q.error ? (
                    <p className="text-sm text-destructive py-4">{(q.error as Error).message}</p>
                ) : (q.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Este producto todavía no tiene movimientos.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table data-testid="kardex-table">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Variante</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-right">Cambio</TableHead>
                                    <TableHead className="text-right">Queda</TableHead>
                                    <TableHead>Motivo / quién</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(q.data ?? []).map((l) => (
                                    <TableRow key={l.id} data-testid="kardex-row">
                                        <TableCell className="whitespace-nowrap text-xs">
                                            {new Date(l.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                        </TableCell>
                                        <TableCell className="text-xs">{l.variant_name ?? '—'}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[10px]">{kardexReasonLabel(l.reason)}</Badge></TableCell>
                                        <TableCell className={`text-right font-medium ${l.delta > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                            {l.delta > 0 ? `+${l.delta}` : l.delta}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">{l.stock_before} → {l.stock_after}</TableCell>
                                        <TableCell className="text-xs">
                                            {l.note ?? (l.order_id ? 'Pedido' : '—')}
                                            {l.actor_name && <span className="block text-muted-foreground">{l.actor_name}</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
