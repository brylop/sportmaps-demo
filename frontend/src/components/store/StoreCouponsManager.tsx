/**
 * StoreCouponsManager — «Tu tienda → Cupones» (tienda v2 F3b).
 *
 * Lista los códigos de la tienda con su estado (activo, pausado, vencido,
 * agotado…) y sus usos; crea uno nuevo, lo pausa / reactiva y muestra quién lo
 * usó. Lo usan la tienda de la escuela (/tienda-escuela/cupones) y el vendedor
 * externo (/vendor/promotions). La base aplica el descuento al cobrar; aquí no
 * se calcula nada. Quién puede: can_manage_store_as (dueño / owner / admin, no coach).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pause, Play, Plus, Tag, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import {
    createStoreCoupon, fetchCouponRedemptions, fetchStoreCoupons, updateStoreCoupon,
} from '@/lib/api/storeApi';
import {
    COUPON_STATE_LABEL, EMPTY_COUPON_FORM, couponAdminErrorText, couponConditions, couponPayload, couponValueLabel,
    type CouponForm, type StoreCoupon,
} from '@/lib/store/coupons';

const STATE_STYLE: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    scheduled: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    expired: 'bg-muted text-muted-foreground',
    exhausted: 'bg-muted text-muted-foreground',
    archived: 'bg-muted text-muted-foreground',
};

const REDEMPTION_LABEL: Record<string, string> = { reserved: 'Pedido sin pagar', consumed: 'Usado', released: 'Liberado' };

export function StoreCouponsManager({ vendorProfileId }: { vendorProfileId: string }) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState<CouponForm>(EMPTY_COUPON_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [usesOf, setUsesOf] = useState<StoreCoupon | null>(null);

    const key = ['store', 'coupons', vendorProfileId];
    const couponsQ = useQuery({ queryKey: key, queryFn: () => fetchStoreCoupons(vendorProfileId) });
    const usesQ = useQuery({
        queryKey: ['store', 'coupon-uses', usesOf?.id],
        queryFn: () => fetchCouponRedemptions(vendorProfileId, usesOf!.id),
        enabled: !!usesOf,
    });

    const create = useMutation({
        mutationFn: (body: Record<string, unknown>) => createStoreCoupon(vendorProfileId, body),
        onSuccess: (c) => {
            qc.invalidateQueries({ queryKey: key });
            setCreateOpen(false);
            setForm(EMPTY_COUPON_FORM);
            toast({ title: `Cupón ${c.code} creado`, description: 'Compártelo: tus compradores lo escriben al pagar.' });
        },
        onError: (err) => setFormError(couponAdminErrorText(err)),
    });

    const setStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) => updateStoreCoupon(vendorProfileId, id, { status }),
        onSuccess: (c) => {
            qc.invalidateQueries({ queryKey: key });
            toast({ title: c.status === 'paused' ? `${c.code} pausado` : `${c.code} activo de nuevo` });
        },
        onError: (err) => toast({ title: 'No se pudo cambiar', description: couponAdminErrorText(err), variant: 'destructive' }),
    });

    const submit = () => {
        const p = couponPayload(form);
        if ('error' in p) { setFormError(p.error); return; }
        setFormError(null);
        create.mutate(p.body);
    };

    const coupons = couponsQ.data ?? [];

    return (
        <div className="space-y-4" data-testid="store-coupons">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground max-w-xl">
                    Crea códigos de descuento para tus compradores (por ejemplo, para los socios de un club). El descuento lo
                    asume tu tienda y se aplica solo al pagar: el IVA y la comisión se calculan sobre el precio con descuento.
                </p>
                <Button onClick={() => { setFormError(null); setCreateOpen(true); }} className="gap-1.5" data-testid="coupon-new">
                    <Plus className="h-4 w-4" /> Nuevo cupón
                </Button>
            </div>

            {couponsQ.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : couponsQ.isError ? (
                <p className="text-sm text-destructive" role="alert">No pudimos cargar los cupones. {couponAdminErrorText(couponsQ.error)}</p>
            ) : coupons.length === 0 ? (
                <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Todavía no tienes cupones. Crea el primero con «Nuevo cupón».
                </CardContent></Card>
            ) : (
                <ul className="grid gap-2">
                    {coupons.map((c) => {
                        const used = c.usage.consumed + c.usage.reserved;
                        return (
                            <li key={c.id} className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3" data-testid="coupon-row" data-code={c.code}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-semibold">{c.code}</span>
                                        <span className="text-sm font-medium">{couponValueLabel(c)}</span>
                                        <Badge variant="secondary" className={cn('font-normal', STATE_STYLE[c.state])} data-testid="coupon-state">
                                            {COUPON_STATE_LABEL[c.state]}
                                        </Badge>
                                    </div>
                                    {c.description && <p className="text-sm line-clamp-1">{c.description}</p>}
                                    <p className="text-xs text-muted-foreground">{couponConditions(c)}</p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground tabular-nums" data-testid="coupon-usage">
                                    <p><span className="font-semibold text-foreground">{used}</span>{c.max_redemptions ? ` / ${c.max_redemptions}` : ''} {used === 1 && !c.max_redemptions ? 'uso' : 'usos'}</p>
                                    <p>{formatCurrency(c.usage.discountGiven)} descontados</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setUsesOf(c)} aria-label={`Ver usos de ${c.code}`}>
                                        <Users className="h-4 w-4" /> Usos
                                    </Button>
                                    {c.status === 'active' ? (
                                        <Button variant="outline" size="sm" className="gap-1" disabled={setStatus.isPending}
                                            onClick={() => setStatus.mutate({ id: c.id, status: 'paused' })} aria-label={`Pausar ${c.code}`}>
                                            <Pause className="h-4 w-4" /> Pausar
                                        </Button>
                                    ) : c.status === 'paused' ? (
                                        <Button variant="outline" size="sm" className="gap-1" disabled={setStatus.isPending}
                                            onClick={() => setStatus.mutate({ id: c.id, status: 'active' })} aria-label={`Activar ${c.code}`}>
                                            <Play className="h-4 w-4" /> Activar
                                        </Button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Crear */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nuevo cupón</DialogTitle>
                        <DialogDescription>El comprador escribe el código al pagar. Puedes pausarlo cuando quieras.</DialogDescription>
                    </DialogHeader>
                    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-code">Código</Label>
                            <Input id="c-code" value={form.code} maxLength={30} className="uppercase font-mono" placeholder="SOCIOS10"
                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-desc">Descripción (opcional)</Label>
                            <Input id="c-desc" value={form.description} maxLength={200} placeholder="Para los socios del club"
                                onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Tipo</Label>
                                <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Tipo de descuento">
                                    {(['percent', 'fixed'] as const).map((k) => (
                                        <button key={k} type="button" role="radio" aria-checked={form.kind === k}
                                            onClick={() => setForm({ ...form, kind: k })}
                                            className={cn('rounded-md border px-2 py-2 text-sm', form.kind === k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50')}>
                                            {k === 'percent' ? '%' : '$ fijo'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-value">{form.kind === 'percent' ? 'Porcentaje (1–90)' : 'Monto en pesos'}</Label>
                                <Input id="c-value" inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-min">Compra mínima (opcional)</Label>
                                <Input id="c-min" inputMode="numeric" value={form.minSubtotal} placeholder="0" onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-max">Tope de descuento (opcional)</Label>
                                <Input id="c-max" inputMode="numeric" value={form.maxDiscount} placeholder="Sin tope" onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-uses">Usos en total (opcional)</Label>
                                <Input id="c-uses" inputMode="numeric" value={form.maxRedemptions} placeholder="Sin límite" onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="c-buyer">Usos por comprador</Label>
                                <Input id="c-buyer" inputMode="numeric" value={form.maxPerBuyer} placeholder="Sin límite" onChange={(e) => setForm({ ...form, maxPerBuyer: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="c-ends">Vence (opcional)</Label>
                            <Input id="c-ends" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                        </div>
                        {formError && <p className="text-sm text-destructive" role="alert" data-testid="coupon-form-error">{formError}</p>}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={create.isPending} data-testid="coupon-save">
                                {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Crear cupón
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Usos */}
            <Dialog open={!!usesOf} onOpenChange={(v) => { if (!v) setUsesOf(null); }}>
                <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Usos de {usesOf?.code}</DialogTitle>
                        <DialogDescription>Pedidos que aplicaron este código. «Pedido sin pagar» cuenta para el límite hasta que se pague o se libere.</DialogDescription>
                    </DialogHeader>
                    {usesQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (usesQ.data ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nadie lo ha usado todavía.</p>
                    ) : (
                        <ul className="divide-y text-sm" data-testid="coupon-uses">
                            {(usesQ.data ?? []).map((r) => (
                                <li key={r.id} className="py-2 flex justify-between gap-2">
                                    <span className="min-w-0">
                                        <span className="block font-mono text-xs">{r.orders?.reference ?? r.order_id.slice(0, 8)}</span>
                                        <span className="block text-muted-foreground">{r.orders?.customer_name ?? 'Comprador'} · {new Date(r.created_at).toLocaleDateString('es-CO')}</span>
                                    </span>
                                    <span className="text-right shrink-0">
                                        <span className="block tabular-nums">−{formatCurrency(Number(r.discount_amount))}</span>
                                        <span className="block text-xs text-muted-foreground">{REDEMPTION_LABEL[r.status]}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
