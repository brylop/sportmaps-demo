/**
 * StoreOrdersPage — pedidos de la tienda para quien la administra (tienda v2 §5.4).
 *
 * Lista con filtros por estado, detalle con cliente e ítems (antes salían
 * "Cliente" y "Items 0", B7), y las acciones del contrato §2.4:
 * aprobar / rechazar comprobante (con motivo), preparar, listo para retirar,
 * enviado (guía), entregado (con código de retiro) y cobrar en efectivo.
 * Todo cambio de estado va por el BFF → RPC; la base decide quién puede qué.
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, CheckCircle2, ChevronRight, ExternalLink, FileSearch, KeyRound, Loader2, Package, RefreshCw,
  Search, School, ShoppingCart, Truck, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { OrderStatusBadge } from '@/components/store/OrderStatusBadge';
import { OrderTimeline } from '@/components/store/OrderTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import {
  ORDER_STATUS_GROUPS, isValidPickupCode, orderShortRef, orderStatusGroup, paymentMethodLabel, sellerActions,
  type OrderStatusGroup, type SellerAction,
} from '@/lib/store/orderStatus';
import { storeErrorView } from '@/lib/store/storeErrors';
import {
  approveReceipt, confirmCash, fetchOrderHistory, fetchSellerOrders, rejectReceipt, sellerReceiptUrl,
  sellerTransition, type StoreOrder,
} from '@/lib/api/storeApi';

function customerName(o: StoreOrder): string {
  return o.customer_name || o.buyer_snapshot?.name || 'Cliente sin nombre';
}

function itemCount(o: StoreOrder): number {
  return (o.order_items ?? []).reduce((s, i) => s + i.quantity, 0);
}

type PendingAction = { order: StoreOrder; action: SellerAction } | null;

export default function StoreOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [group, setGroup] = useState<OrderStatusGroup | null>(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');

  const ordersQ = useQuery({
    queryKey: ['store', 'seller-orders', user?.id],
    queryFn: () => fetchSellerOrders(user!.id),
    enabled: !!user,
  });
  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);

  const branchIds = useMemo(() => [...new Set(orders.map((o) => o.pickup_branch_id).filter(Boolean))] as string[], [orders]);
  const { data: branches = {} } = useQuery({
    queryKey: ['store', 'branches-by-id', branchIds],
    queryFn: async () => {
      const { data } = await supabase.from('school_branches').select('id, name').in('id', branchIds);
      return Object.fromEntries((data ?? []).map((b: { id: string; name: string }) => [b.id, b.name])) as Record<string, string>;
    },
    enabled: branchIds.length > 0,
  });

  const open = orders.find((o) => o.id === openId) ?? null;
  const historyQ = useQuery({
    queryKey: ['store', 'order-history', openId],
    queryFn: () => fetchOrderHistory(openId!),
    enabled: !!openId,
  });

  const filtered = orders.filter((o) => {
    if (group && orderStatusGroup(o.status) !== group) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return orderShortRef(o).toLowerCase().includes(q) || customerName(o).toLowerCase().includes(q);
  });
  const countGroup = (g: OrderStatusGroup) => orders.filter((o) => orderStatusGroup(o.status) === g).length;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['store', 'seller-orders'] }),
      qc.invalidateQueries({ queryKey: ['store', 'order-history'] }),
      qc.invalidateQueries({ queryKey: ['store-orders'] }),
    ]);
  };

  const startAction = (order: StoreOrder, action: SellerAction) => {
    setCode(''); setReason(''); setTracking(''); setCarrier('');
    const needsDialog = action.kind === 'reject_receipt' || action.kind === 'confirm_cash' || action.kind === 'cancel'
      || (action.kind === 'transition' && (action.needsPickupCode || action.needsTracking));
    if (needsDialog) setPending({ order, action });
    else runAction(order, action);
  };

  const runAction = async (order: StoreOrder, action: SellerAction) => {
    setBusy(true);
    try {
      switch (action.kind) {
        case 'approve_receipt':
          await approveReceipt(order.id);
          toast({ title: 'Pago aprobado', description: `${orderShortRef(order)} quedó pagado.` });
          break;
        case 'reject_receipt':
          await rejectReceipt(order.id, reason.trim());
          toast({ title: 'Comprobante rechazado', description: 'El comprador tiene 24 horas para subir otro.' });
          break;
        case 'confirm_cash':
          await confirmCash(order.id, code);
          toast({ title: 'Cobrado y entregado', description: `${orderShortRef(order)} quedó entregado.` });
          break;
        case 'cancel':
          await sellerTransition(order.id, { to: 'cancelled', note: reason.trim() || undefined });
          toast({ title: 'Pedido cancelado', description: 'Los productos reservados quedaron libres.' });
          break;
        case 'transition':
          await sellerTransition(order.id, {
            to: action.to,
            pickupCode: action.needsPickupCode ? code.trim() : undefined,
            trackingNumber: action.needsTracking ? tracking.trim() || undefined : undefined,
            carrier: action.needsTracking ? carrier.trim() || undefined : undefined,
          });
          toast({ title: 'Pedido actualizado', description: action.label });
          break;
      }
      setPending(null);
      await refresh();
    } catch (err) {
      const v = storeErrorView(err);
      toast({ title: v.title, description: v.description, variant: 'destructive' });
      if (v.action === 'reload_order') await refresh();
    } finally {
      setBusy(false);
    }
  };

  const viewReceipt = async (order: StoreOrder) => {
    try {
      const url = await sellerReceiptUrl(order.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      const v = storeErrorView(err);
      toast({ title: 'No se pudo abrir el comprobante', description: v.description, variant: 'destructive' });
    }
  };

  const dialogValid = (() => {
    if (!pending) return false;
    const a = pending.action;
    if (a.kind === 'reject_receipt') return reason.trim().length >= 3;
    if (a.kind === 'confirm_cash') return isValidPickupCode(code);
    if (a.kind === 'transition' && a.needsPickupCode) return isValidPickupCode(code);
    return true;
  })();

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground text-sm">Aprueba pagos, prepara y entrega los pedidos de tu tienda.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => ordersQ.refetch()} disabled={ordersQ.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${ordersQ.isFetching ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      <StatFilterBar
        columns={6}
        value={group}
        onChange={(v) => setGroup((v as OrderStatusGroup | null) ?? null)}
        items={[
          { key: null, label: 'Todos', value: orders.length, tone: 'neutral' },
          { key: 'awaiting_payment', label: ORDER_STATUS_GROUPS.awaiting_payment.label, value: countGroup('awaiting_payment'), tone: 'yellow' },
          { key: 'to_prepare', label: ORDER_STATUS_GROUPS.to_prepare.label, value: countGroup('to_prepare'), tone: 'blue' },
          { key: 'in_progress', label: ORDER_STATUS_GROUPS.in_progress.label, value: countGroup('in_progress'), tone: 'violet' },
          { key: 'delivered', label: ORDER_STATUS_GROUPS.delivered.label, value: countGroup('delivered'), tone: 'emerald' },
          { key: 'closed', label: ORDER_STATUS_GROUPS.closed.label, value: countGroup('closed'), tone: 'rose' },
        ]}
      />

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por referencia o cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {ordersQ.isLoading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : ordersQ.isError ? (
        <div className="rounded-xl border p-6 text-center space-y-2">
          <p className="font-medium">No pudimos cargar los pedidos.</p>
          <Button size="sm" variant="outline" onClick={() => ordersQ.refetch()}>Reintentar</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-14 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-medium">No hay pedidos {group ? 'en este estado' : 'todavía'}</p>
          <p className="text-sm text-muted-foreground">Los pedidos aparecen aquí cuando las familias compran.</p>
        </div>
      ) : (
        <ul className="rounded-xl border bg-card divide-y" data-testid="seller-orders">
          {filtered.map((o) => {
            const actions = sellerActions(o);
            const main = actions.find((a) => a.kind !== 'cancel' && a.kind !== 'reject_receipt');
            return (
              <li key={o.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="seller-order-row" data-ref={orderShortRef(o)}>
                <button type="button" className="flex-1 min-w-0 text-left flex items-start gap-3" onClick={() => setOpenId(o.id)} aria-label={`Ver pedido ${orderShortRef(o)}`}>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    {o.payment_method === 'cash_pickup' ? <Banknote className="h-5 w-5 text-primary" /> : o.status === 'awaiting_approval' ? <FileSearch className="h-5 w-5 text-amber-600" /> : <Package className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{customerName(o)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{orderShortRef(o)}</p>
                    <p className="text-xs text-muted-foreground">
                      {itemCount(o)} {itemCount(o) === 1 ? 'producto' : 'productos'} · {paymentMethodLabel(o.payment_method)} · {new Date(o.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="font-semibold tabular-nums mr-auto sm:mr-2">{formatCurrency(Number(o.total_amount))}</span>
                  {main && (
                    <Button size="sm" onClick={() => startAction(o, main)} disabled={busy}>{main.label}</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setOpenId(o.id)} aria-label="Ver detalle"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Detalle */}
      <Sheet open={!!open} onOpenChange={(v) => { if (!v) setOpenId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {open && (
            <div className="space-y-5" data-testid="seller-order-detail">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{orderShortRef(open)}</span>
                  <OrderStatusBadge status={open.status} />
                </SheetTitle>
                <SheetDescription>{new Date(open.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</SheetDescription>
              </SheetHeader>

              <section className="space-y-1 text-sm">
                <h3 className="font-semibold">Cliente</h3>
                <p data-testid="detail-customer">{customerName(open)}</p>
                {open.customer_document && <p className="text-muted-foreground">Documento: {open.customer_document}</p>}
                {(open.contact_phone || open.buyer_snapshot?.phone) && <p className="text-muted-foreground">Celular: {open.contact_phone || open.buyer_snapshot?.phone}</p>}
                {(open.contact_email || open.buyer_snapshot?.email) && <p className="text-muted-foreground">Correo: {open.contact_email || open.buyer_snapshot?.email}</p>}
                {open.notes && <p className="rounded-md bg-muted p-2 mt-1">Nota: {open.notes}</p>}
              </section>

              <section className="space-y-2 text-sm">
                <h3 className="font-semibold">Productos</h3>
                <ul className="divide-y rounded-lg border" data-testid="detail-items">
                  {(open.order_items ?? []).map((it) => (
                    <li key={it.id} className="p-2.5 flex justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block">{it.quantity} × {it.products?.name ?? 'Producto'}</span>
                        {it.product_variants?.name && <span className="block text-xs text-muted-foreground">{it.product_variants.name}</span>}
                      </span>
                      <span className="tabular-nums shrink-0">{formatCurrency(Number(it.unit_price) * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{formatCurrency(Number(open.total_amount))}</span></div>
                {Number(open.tax_total) > 0 && <p className="text-xs text-muted-foreground text-right">Incluye IVA {formatCurrency(Number(open.tax_total))}</p>}
              </section>

              <section className="space-y-1 text-sm">
                <h3 className="font-semibold">Entrega y pago</h3>
                <p className="flex items-center gap-1.5">
                  {open.fulfillment_mode === 'shipping' ? <Truck className="h-4 w-4" /> : <School className="h-4 w-4" />}
                  {open.fulfillment_mode === 'shipping'
                    ? `Envío a ${[open.shipping_address?.direccion, open.shipping_address?.ciudad, open.shipping_address?.departamento].filter(Boolean).join(', ')}`
                    : `Retiro en ${open.pickup_branch_id ? branches[open.pickup_branch_id] ?? 'la sede' : 'la sede principal'}`}
                </p>
                <p>{paymentMethodLabel(open.payment_method)}</p>
                {open.tracking_number && <p>Guía: {open.shipping_carrier ? `${open.shipping_carrier} · ` : ''}{open.tracking_number}</p>}
                {open.rejection_reason && open.status === 'pending_payment' && (
                  <p className="text-amber-700 dark:text-amber-400">Comprobante rechazado: {open.rejection_reason}</p>
                )}
                {open.receipt_path && (
                  <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => viewReceipt(open)}>
                    <ExternalLink className="h-4 w-4" /> Ver comprobante
                  </Button>
                )}
              </section>

              {sellerActions(open).length > 0 && (
                <section className="flex flex-wrap gap-2" data-testid="detail-actions">
                  {sellerActions(open).map((a) => (
                    <Button
                      key={`${a.kind}-${'to' in a ? a.to : ''}`}
                      variant={a.kind === 'cancel' || a.kind === 'reject_receipt' ? 'outline' : 'default'}
                      className={a.kind === 'cancel' || a.kind === 'reject_receipt' ? 'text-destructive' : ''}
                      disabled={busy}
                      onClick={() => startAction(open, a)}
                    >
                      {a.kind === 'approve_receipt' && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                      {(a.kind === 'reject_receipt' || a.kind === 'cancel') && <XCircle className="h-4 w-4 mr-1.5" />}
                      {(a.kind === 'confirm_cash' || ('needsPickupCode' in a && a.needsPickupCode)) && <KeyRound className="h-4 w-4 mr-1.5" />}
                      {a.label}
                    </Button>
                  ))}
                </section>
              )}

              <section>
                <h3 className="font-semibold text-sm mb-3">Historial</h3>
                <OrderTimeline order={open} history={historyQ.data ?? []} />
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Diálogo de la acción (motivo, código, guía) */}
      <Dialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <DialogContent className="max-w-md">
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{pending.action.label}</DialogTitle>
                <DialogDescription>{orderShortRef(pending.order)} · {customerName(pending.order)} · {formatCurrency(Number(pending.order.total_amount))}</DialogDescription>
              </DialogHeader>
              {pending.action.kind === 'reject_receipt' || pending.action.kind === 'cancel' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="reason">{pending.action.kind === 'reject_receipt' ? 'Motivo del rechazo' : 'Motivo (opcional)'}</Label>
                  <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder={pending.action.kind === 'reject_receipt' ? 'Ej.: el valor transferido no coincide' : ''} />
                  {pending.action.kind === 'reject_receipt' && <p className="text-xs text-muted-foreground">El comprador lo ve y puede subir otro comprobante.</p>}
                </div>
              ) : null}
              {(pending.action.kind === 'confirm_cash' || (pending.action.kind === 'transition' && pending.action.needsPickupCode)) && (
                <div className="space-y-1.5">
                  <Label htmlFor="pcode">Código de retiro del comprador</Label>
                  <Input id="pcode" inputMode="numeric" maxLength={6} autoComplete="off" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 dígitos" className="text-lg tracking-[0.3em] font-mono" />
                  {pending.action.kind === 'confirm_cash' && (
                    <p className="text-xs text-muted-foreground">Recibe {formatCurrency(Number(pending.order.total_amount))} en efectivo y entrega el pedido.</p>
                  )}
                </div>
              )}
              {pending.action.kind === 'transition' && pending.action.needsTracking && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="carrier">Transportadora</Label><Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="track">Número de guía</Label><Input id="track" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPending(null)}>Volver</Button>
                <Button disabled={!dialogValid || busy} onClick={() => runAction(pending.order, pending.action)}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
