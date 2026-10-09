import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    ADJUST_MOTIVES, buildAdjustNote, motiveReasonCode, variantAvailable, type VendorProduct,
} from '@/lib/store/inventory';
import { adjustStock } from '@/lib/store/vendorProductsApi';

interface Props {
    product: VendorProduct | null;
    /** Variante preseleccionada (si el producto tiene variantes). */
    variantId?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDone: () => void;
}

/**
 * Ajuste rápido de stock con motivo. Llama POST /api/v1/vendor/products/:id/inventory
 * (inventory_adjust): deja kardex y no permite bajar de lo reservado.
 */
export function StockAdjustDialog({ product, variantId, open, onOpenChange, onDone }: Props) {
    const { session } = useAuth();
    const { toast } = useToast();
    const [selVariant, setSelVariant] = useState<string>('');
    const [mode, setMode] = useState<'add' | 'set'>('add');
    const [qty, setQty] = useState<string>('');
    const [motive, setMotive] = useState<string>(ADJUST_MOTIVES[0].id);
    const [detail, setDetail] = useState('');
    const [saving, setSaving] = useState(false);

    const variants = useMemo(
        () => (product?.product_variants ?? []).filter((v) => v.is_active !== false),
        [product],
    );

    useEffect(() => {
        if (!open) return;
        setSelVariant(variantId ?? variants[0]?.id ?? '');
        setMode('add');
        setQty('');
        setMotive(ADJUST_MOTIVES[0].id);
        setDetail('');
    }, [open, variantId, variants]);

    if (!product) return null;
    const hasVariants = variants.length > 0;
    const variant = hasVariants ? variants.find((v) => v.id === selVariant) ?? null : null;
    const current = hasVariants ? Number(variant?.stock ?? 0) : Number(product.stock_total ?? 0);
    const reserved = hasVariants ? Number(variant?.reserved ?? 0) : Number(product.reserved_total ?? 0);
    const n = qty === '' ? NaN : Number(qty);
    const target = Number.isInteger(n) ? (mode === 'add' ? current + n : n) : NaN;
    const valid = Number.isInteger(target) && target >= 0 && target >= reserved && target !== current
        && (!hasVariants || !!variant);

    async function save() {
        if (!product || !valid) return;
        setSaving(true);
        try {
            await adjustStock(session?.access_token, product.id, {
                variant_id: hasVariants ? variant!.id : null,
                new_stock: target,
                reason_code: motiveReasonCode(motive),
                note: buildAdjustNote(motive, detail),
            });
            toast({
                title: 'Stock actualizado',
                description: `${product.name}${variant ? ` · ${variant.name}` : ''}: ${current} → ${target}`,
            });
            onOpenChange(false);
            onDone();
        } catch (e) {
            toast({ title: 'No se pudo ajustar', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ajustar stock</DialogTitle>
                    <DialogDescription>{product.name}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {hasVariants && (
                        <div>
                            <Label htmlFor="adj-variant">Variante</Label>
                            <Select value={selVariant} onValueChange={setSelVariant}>
                                <SelectTrigger id="adj-variant" aria-label="Variante"><SelectValue placeholder="Elige la variante" /></SelectTrigger>
                                <SelectContent>
                                    {variants.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.name} · {v.stock} u.
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="rounded-md bg-muted/50 p-3 text-sm flex justify-between">
                        <span>Stock actual: <strong data-testid="adjust-current">{current}</strong></span>
                        {reserved > 0 && <span className="text-muted-foreground">Reservado: {reserved} · Disponible: {variant ? variantAvailable(variant) : Math.max(0, current - reserved)}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={mode === 'add' ? 'default' : 'outline'} size="sm" onClick={() => setMode('add')}>
                            Sumar / restar
                        </Button>
                        <Button type="button" variant={mode === 'set' ? 'default' : 'outline'} size="sm" onClick={() => setMode('set')}>
                            Fijar cantidad
                        </Button>
                    </div>

                    <div>
                        <Label htmlFor="adj-qty">{mode === 'add' ? 'Unidades (usa − para restar)' : 'Nuevo stock'}</Label>
                        <Input id="adj-qty" type="number" inputMode="numeric" value={qty}
                               onChange={(e) => setQty(e.target.value)} placeholder={mode === 'add' ? 'Ej: 10 o -2' : 'Ej: 25'} />
                        {Number.isInteger(target) && (
                            <p className={`text-xs mt-1 ${valid ? 'text-muted-foreground' : 'text-destructive'}`}>
                                {target < 0 ? 'El stock no puede quedar negativo.'
                                    : target < reserved ? `No puede quedar por debajo de lo reservado (${reserved}).`
                                    : target === current ? 'Es el mismo stock que hay hoy.'
                                    : `Quedará en ${target} unidades.`}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="adj-motive">Motivo</Label>
                        <Select value={motive} onValueChange={setMotive}>
                            <SelectTrigger id="adj-motive" aria-label="Motivo"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ADJUST_MOTIVES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="adj-note">Detalle (opcional)</Label>
                        <Textarea id="adj-note" rows={2} maxLength={400} value={detail} onChange={(e) => setDetail(e.target.value)}
                                  placeholder="Ej: factura 1234 del proveedor" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={save} disabled={!valid || saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        Guardar ajuste
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
