/**
 * MiCompraDetallePage — detalle de una compra (/mis-compras/:orderId), tienda v2 §2.6.
 *
 * Estado y línea de tiempo (order_status_history), ítems, código de retiro,
 * transferencia (cuentas REALES de la tienda + subir comprobante →
 * "esperando aprobación"), reabrir el pago en línea, cancelar si no ha pagado
 * y "Ya lo recibí" cuando va en camino.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, CheckCircle2, Copy, FileUp, KeyRound, Loader2, Package, RefreshCw, School, Truck, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  buyerCanCancel, buyerCanConfirmReceived, buyerCanRetryGateway, buyerCanUploadReceipt, buyerStatusMessage,
  normalizeOrderStatus, orderShortRef, paymentMethodLabel,
} from '@/lib/store/orderStatus';
import { orderLoadError, storeErrorView } from '@/lib/store/storeErrors';
import { buyerCanRegeneratePickupCode, buyerCopy } from '@/lib/store/buyerCopy';
import {
  cancelMyOrder, confirmReceived, fetchMyOrder, fetchOrderHistory, fetchOrderPayment, pickupCodeRegenerations,
  receiptFileProblem, recallPickupCodeEntry, regeneratePickupCode, rememberPickupCode, uploadOrderReceipt, type TransferInfo,
} from '@/lib/api/storeApi';
import { openWompiCheckout } from '@/lib/api/wompi';
import { OrderStatusBadge } from '@/components/store/OrderStatusBadge';
import { OrderTimeline } from '@/components/store/OrderTimeline';

export default function MiCompraDetallePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // El checkout llega con { created, transfer } en el estado de navegación. El
  // banner "¡Pedido creado!" es SOLO para esa llegada: el estado se copia una vez
  // y se borra del historial, así que recargar (o volver con atrás) no lo repite.
  const navState = (location.state as { created?: boolean; transfer?: TransferInfo } | null) ?? null;
  const [justCreated] = useState(() => !!navState?.created);
  const [createdTransfer] = useState<TransferInfo | null>(() => navState?.transfer ?? null);
  useEffect(() => {
    if (navState?.created || navState?.transfer) {
      navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
    }
    // Solo al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<'cancel' | 'received' | 'pay' | 'code' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [freshCode, setFreshCode] = useState<{ code: string; left: number } | null>(null);
  const copyFor = buyerCopy(profile?.role);

  const orderQ = useQuery({
    queryKey: ['store', 'my-order', orderId],
    queryFn: () => fetchMyOrder(orderId!),
    enabled: !!orderId,
    // Un 429 o un 404 no se arreglan reintentando en caliente (el 429 empeora).
    retry: (count, err) => {
      const kind = orderLoadError(err);
      return (kind === 'network' || kind === 'other') && count < 2;
    },
  });
  const order = orderQ.data;
  // "Ver/generar código" desde Mis compras llega con #codigo.
  useEffect(() => {
    if (order && location.hash === '#codigo') document.getElementById('codigo')?.scrollIntoView({ block: 'center' });
  }, [order, location.hash]);
  const historyQ = useQuery({
    queryKey: ['store', 'order-history', orderId],
    queryFn: () => fetchOrderHistory(orderId!),
    enabled: !!orderId,
  });

  const needsReceipt = !!order && buyerCanUploadReceipt(order);
  const transferQ = useQuery({
    queryKey: ['store', 'order-payment', orderId],
    queryFn: async () => (await fetchOrderPayment(orderId!)).transfer ?? null,
    enabled: !!order && needsReceipt && !createdTransfer,
    retry: false,
  });
  const transfer: TransferInfo | null = createdTransfer ?? transferQ.data ?? null;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['store', 'my-order', orderId] }),
      qc.invalidateQueries({ queryKey: ['store', 'order-history', orderId] }),
      qc.invalidateQueries({ queryKey: ['store', 'my-orders'] }),
    ]);
  };

  const fail = (err: unknown) => {
    const v = storeErrorView(err);
    toast({ title: v.title, description: v.description, variant: 'destructive' });
    if (v.action === 'reload_order') refresh();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !orderId) return;
    const problem = receiptFileProblem(file);
    if (problem) { toast({ title: 'Archivo no permitido', description: problem, variant: 'destructive' }); return; }
    setUploading(true);
    try {
      await uploadOrderReceipt(orderId, file);
      toast({ title: 'Comprobante enviado', description: 'La tienda lo va a revisar. Te avisamos cuando lo apruebe.' });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onCancel = async () => {
    if (!orderId) return;
    setBusy('cancel');
    try {
      await cancelMyOrder(orderId, cancelReason.trim() || undefined);
      toast({ title: 'Pedido cancelado', description: 'Liberamos los productos que tenías reservados.' });
      setCancelOpen(false);
      await refresh();
    } catch (err) { fail(err); } finally { setBusy(null); }
  };

  const onReceived = async () => {
    if (!orderId) return;
    setBusy('received');
    try { await confirmReceived(orderId); await refresh(); } catch (err) { fail(err); } finally { setBusy(null); }
  };

  const onRetryPay = async () => {
    if (!orderId || !order) return;
    setBusy('pay');
    try {
      const p = await fetchOrderPayment(orderId);
      if (p.provider === 'wompi' && p.publicKey && p.signature && p.reference && p.amountInCents) {
        await openWompiCheckout({
          reference: p.reference, amountInCents: p.amountInCents, publicKey: p.publicKey, signature: p.signature,
          customerEmail: order.contact_email ?? user?.email ?? '',
          redirectUrl: `${window.location.origin}/mis-compras/${orderId}`,
        } as Parameters<typeof openWompiCheckout>[0]);
        await refresh();
      } else {
        toast({ title: 'Pago en línea no disponible', description: 'Escríbele a la tienda o cancela el pedido y elige otro medio.' });
      }
    } catch (err) { fail(err); } finally { setBusy(null); }
  };

  const onRegenerateCode = async () => {
    if (!orderId || !user) return;
    setBusy('code');
    try {
      const r = await regeneratePickupCode(orderId);
      rememberPickupCode(user.id, orderId, r.pickup_code, r.regenerations_used);
      setFreshCode({ code: r.pickup_code, left: r.regenerations_left });
      setCodeOpen(false);
      toast({ title: 'Código nuevo listo', description: 'El código anterior ya no sirve para retirar.' });
      await qc.invalidateQueries({ queryKey: ['store', 'order-history', orderId] });
    } catch (err) {
      setCodeOpen(false);
      fail(err);
    } finally { setBusy(null); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Copiado', description: text }); } catch { /* nada */ }
  };

  if (orderQ.isLoading) {
    return <div className="py-20 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (orderQ.isError || !order) {
    // 429 (límite de operaciones) y fallas de red NO son "no existe".
    const kind = orderQ.isError ? orderLoadError(orderQ.error) : 'not_found';
    const view = kind === 'rate_limited'
      ? { title: 'Demasiadas solicitudes', text: 'Demasiadas solicitudes, intenta en un minuto.' }
      : kind === 'network'
        ? { title: 'Sin conexión', text: 'No pudimos comunicarnos. Revisa tu internet e intenta de nuevo.' }
        : kind === 'other'
          ? { title: 'No pudimos cargar el pedido', text: 'Intenta de nuevo en un momento.' }
          : { title: 'Pedido no encontrado', text: 'Este pedido no existe o no es de tu cuenta.' };
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-3" data-testid="order-load-error" data-kind={kind}>
        <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <h1 className="text-xl font-bold">{view.title}</h1>
        <p className="text-sm text-muted-foreground">{view.text}</p>
        <div className="flex justify-center gap-2">
          {kind !== 'not_found' && (
            <Button onClick={() => orderQ.refetch()} disabled={orderQ.isFetching} className="gap-1.5">
              {orderQ.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reintentar
            </Button>
          )}
          <Button asChild variant="outline"><Link to="/mis-compras">Volver a Mis compras</Link></Button>
        </div>
      </div>
    );
  }

  const status = normalizeOrderStatus(order.status);
  const pickup = order.fulfillment_mode !== 'shipping';
  const closed = status === 'delivered' || status === 'cancelled' || status === 'expired'
    || status === 'refunded' || status === 'partially_refunded';
  // El código guardado en este dispositivo deja de valer si el historial muestra
  // una regeneración posterior (hecha en otro dispositivo).
  const stored = user && pickup ? recallPickupCodeEntry(user.id, order.id) : null;
  const regenerations = pickupCodeRegenerations(historyQ.data ?? []);
  const storedStale = !!stored && historyQ.isSuccess && regenerations > stored.gen;
  const pickupCode = freshCode?.code ?? (stored && !storedStale ? stored.code : null);
  const canRegenerate = buyerCanRegeneratePickupCode(order);
  // Efectivo sin pagar: se muestra el aviso aunque no haya código en este dispositivo
  // (ahí no se regenera: el código es también la prueba del cobro).
  const showPickupBox = pickup && !closed && (!!pickupCode || canRegenerate || order.payment_method === 'cash_pickup');
  // El banner solo acompaña la llegada desde el checkout, y solo si todavía falta pagar.
  const showCreatedBanner = justCreated && (status === 'pending_payment' || status === 'awaiting_approval');
  const items = order.order_items ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
        <Link to="/mis-compras"><ArrowLeft className="h-4 w-4" /> Mis compras</Link>
      </Button>

      {showCreatedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-4 flex gap-3" role="status" data-testid="order-created-banner">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div><p className="font-semibold">¡Pedido creado!</p><p className="text-sm text-muted-foreground">Te guardamos los productos mientras completas el pago.</p></div>
        </div>
      )}

      <header className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold font-mono">{orderShortRef(order)}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm" data-testid="buyer-status-message">{buyerStatusMessage(order)}</p>
        {status === 'pending_payment' && order.expires_at && (
          <p className="text-xs text-muted-foreground">Reservado hasta el {new Date(order.expires_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</p>
        )}
      </header>

      {showPickupBox && (
        <section id="codigo" className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-2" aria-labelledby="pickup-code" data-testid="pickup-code-box">
          <h2 id="pickup-code" className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> Código de retiro</h2>
          {pickupCode ? (
            <>
              <p className="text-3xl font-bold tracking-[0.3em] tabular-nums" data-testid="pickup-code">{pickupCode}</p>
              <p className="text-xs text-muted-foreground">Muéstralo en la sede para recibir tu pedido. {copyFor.pickupShare}</p>
              {freshCode && (
                <p className="text-xs text-muted-foreground" data-testid="pickup-code-left">
                  El código anterior ya no sirve. {freshCode.left > 0 ? `Puedes generar ${freshCode.left} ${freshCode.left === 1 ? 'código más' : 'códigos más'} si lo necesitas.` : 'Ya no puedes generar más códigos para este pedido.'}
                </p>
              )}
            </>
          ) : storedStale && canRegenerate ? (
            <p className="text-sm" data-testid="pickup-code-missing">
              Generaste un código nuevo en otro dispositivo, así que el que estaba guardado aquí ya no sirve. Usa el nuevo o genera otro aquí.
            </p>
          ) : canRegenerate ? (
            <p className="text-sm" data-testid="pickup-code-missing">
              Tu código quedó guardado en el dispositivo donde hiciste la compra. Si no lo tienes a mano, genera uno nuevo aquí: el anterior deja de servir.
            </p>
          ) : (
            <p className="text-sm" data-testid="pickup-code-missing">
              Tu código quedó guardado en el dispositivo donde hiciste el pedido. Como pagas en efectivo al retirar, ábrelo desde ese dispositivo o escríbele a la tienda.
            </p>
          )}
          {canRegenerate && (
            <Button
              variant={pickupCode ? 'outline' : 'default'} size="sm" className="gap-1.5"
              onClick={() => setCodeOpen(true)} disabled={busy === 'code'} data-testid="pickup-code-generate"
            >
              {busy === 'code' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {pickupCode ? 'Generar un código nuevo' : 'Generar código de retiro'}
            </Button>
          )}
        </section>
      )}

      <AlertDialog open={codeOpen} onOpenChange={setCodeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar un código de retiro nuevo?</AlertDialogTitle>
            <AlertDialogDescription>
              El código anterior deja de servir, también si lo tienes en otro celular o se lo pasaste a alguien. Puedes hacerlo hasta 3 veces por pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onRegenerateCode(); }} disabled={busy === 'code'} data-testid="pickup-code-confirm">
              {busy === 'code' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sí, generar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {needsReceipt && (
        <section className="rounded-xl border bg-card p-4 space-y-3" aria-labelledby="transfer-title" data-testid="transfer-box">
          <h2 id="transfer-title" className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Transfiere {formatCurrency(Number(order.total_amount))}</h2>
          {transferQ.isLoading && !transfer ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {transfer && transfer.accounts.length > 0 ? (
            <ul className="space-y-2">
              {transfer.accounts.map((a, i) => (
                <li key={`${a.value}-${i}`} className="rounded-lg border p-3 text-sm flex items-start justify-between gap-2" data-testid="transfer-account">
                  <div className="min-w-0">
                    <p className="font-medium">{a.label || a.bank || 'Cuenta'}{a.account_type ? ` · ${a.account_type}` : ''}</p>
                    <p className="font-mono text-base break-all">{a.value}</p>
                    {(a.holder || a.holder_id) && <p className="text-xs text-muted-foreground">{a.holder}{a.holder_id ? ` · ${a.holder_id}` : ''}</p>}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Copiar número" onClick={() => copy(a.value)}><Copy className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          ) : transfer ? (
            <p className="text-sm text-amber-700">La tienda no tiene cuentas registradas. Escríbele antes de transferir.</p>
          ) : null}
          {transfer?.instructions && <p className="text-sm text-muted-foreground whitespace-pre-line">{transfer.instructions}</p>}
          <p className="text-xs text-muted-foreground">En la descripción de la transferencia escribe la referencia <button type="button" className="font-mono underline" onClick={() => copy(orderShortRef(order))}>{orderShortRef(order)}</button>.</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])} data-testid="receipt-input" />
          <Button className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {uploading ? 'Subiendo…' : order.rejection_reason ? 'Subir otro comprobante' : 'Subir comprobante'}
          </Button>
          <p className="text-xs text-muted-foreground">Foto o PDF, máximo 5 MB.</p>
        </section>
      )}

      {status === 'awaiting_approval' && (
        <section className="rounded-xl border bg-card p-4 text-sm flex gap-2" data-testid="awaiting-approval">
          <Loader2 className="h-4 w-4 mt-0.5 text-amber-600" />
          <p>Comprobante enviado{order.receipt_submitted_at ? ` el ${new Date(order.receipt_submitted_at).toLocaleDateString('es-CO')}` : ''}. Esperando que la tienda lo apruebe. Mientras tanto tus productos siguen reservados.</p>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Seguimiento</h2>
        <OrderTimeline order={order} history={historyQ.data ?? []} />
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Productos</h2>
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id} className="py-2 flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block">{it.quantity} × {it.products?.name ?? 'Producto'}</span>
                {it.product_variants?.name && <span className="block text-xs text-muted-foreground">{it.product_variants.name}</span>}
              </span>
              <span className="tabular-nums shrink-0">{formatCurrency(Number(it.unit_price) * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t pt-2 text-sm space-y-1">
          <div className="flex justify-between text-muted-foreground"><span>Envío</span><span>{pickup ? 'Retiro en sede' : formatCurrency(Number(order.shipping_cost ?? 0))}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums" data-testid="order-total">{formatCurrency(Number(order.total_amount))}</span></div>
          {Number(order.tax_total) > 0 && <p className="text-xs text-muted-foreground text-right">Incluye IVA {formatCurrency(Number(order.tax_total))}</p>}
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">{pickup ? <School className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            {pickup ? 'Retiro en la sede' : `Envío a ${[order.shipping_address?.direccion, order.shipping_address?.ciudad, order.shipping_address?.departamento].filter(Boolean).join(', ')}`}
          </p>
          <p>Pago: {paymentMethodLabel(order.payment_method)}</p>
          {order.tracking_number && <p>Guía: {order.shipping_carrier ? `${order.shipping_carrier} · ` : ''}{order.tracking_number}</p>}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-2">
        {buyerCanRetryGateway(order) && (
          <Button onClick={onRetryPay} disabled={busy === 'pay'}>{busy === 'pay' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pagar ahora</Button>
        )}
        {buyerCanConfirmReceived(order) && (
          <Button onClick={onReceived} disabled={busy === 'received'}>{busy === 'received' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ya lo recibí</Button>
        )}
        {buyerCanCancel(order) && (
          <Button variant="outline" className="gap-1.5 text-destructive" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" /> Cancelar pedido</Button>
        )}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Liberamos los productos reservados. {status === 'awaiting_approval' ? 'Si ya transferiste, escríbele a la tienda para que te devuelva la plata.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Motivo (opcional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onCancel(); }} disabled={busy === 'cancel'}>
              {busy === 'cancel' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
