/**
 * PedidoInvitadoPage — pedido hecho SIN cuenta (/pedido/:token), tienda v2 §2.1.
 *
 * El token del enlace (llega por correo y al terminar el checkout) es la única
 * credencial: va al BFF en el header X-Pedido-Token y la base solo guarda su
 * sha256 (mig. 20261013170553). Desde aquí el socio ve el estado y la línea de
 * tiempo, las cuentas REALES de la tienda para transferir, sube el
 * comprobante, ve/genera su código de retiro, paga en línea o cancela. Abajo,
 * la invitación a crear su cuenta con el mismo correo.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CheckCircle2, Copy, FileUp, KeyRound, Loader2, Mail, Package, RefreshCw, School, Truck, UserPlus, XCircle,
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
  buyerCanCancel, buyerCanRetryGateway, buyerCanUploadReceipt, buyerStatusMessage, normalizeOrderStatus,
  orderShortRef, paymentMethodLabel,
} from '@/lib/store/orderStatus';
import { orderLoadError, storeErrorView } from '@/lib/store/storeErrors';
import { buyerCopy } from '@/lib/store/buyerCopy';
import { receiptFileProblem, pickupCodeRegenerations, type TransferInfo } from '@/lib/api/storeApi';
import {
  GUEST_TOKEN_RE, cancelGuestOrder, fetchGuestOrder, fetchGuestPayment, recallGuestPickupCode, regenerateGuestPickupCode,
  rememberGuestPickupCode, uploadGuestReceipt,
} from '@/lib/api/storeGuestApi';
import { openWompiCheckout } from '@/lib/api/wompi';
import { OrderStatusBadge } from '@/components/store/OrderStatusBadge';
import { OrderTimeline } from '@/components/store/OrderTimeline';

export default function PedidoInvitadoPage() {
  const { token = '' } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const validToken = GUEST_TOKEN_RE.test(token);

  // El checkout llega con { created, transfer, emailSent }: banner SOLO en esa llegada.
  const navState = (location.state as { created?: boolean; transfer?: TransferInfo | null; emailSent?: string | null } | null) ?? null;
  const [justCreated] = useState(() => !!navState?.created);
  const [emailSent] = useState(() => navState?.emailSent ?? null);
  useEffect(() => {
    if (navState?.created) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // Solo al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<'cancel' | 'pay' | 'code' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [freshCode, setFreshCode] = useState<{ code: string; left: number } | null>(null);
  const copyFor = buyerCopy(null);

  const q = useQuery({
    queryKey: ['store', 'guest-order', token],
    queryFn: () => fetchGuestOrder(token),
    enabled: validToken,
    retry: (count, err) => {
      const kind = orderLoadError(err);
      return (kind === 'network' || kind === 'other') && count < 2;
    },
    // Mientras la tienda revisa el comprobante, se actualiza solo.
    refetchInterval: (query) => (query.state.data?.order.status === 'awaiting_approval' ? 30_000 : false),
  });
  const view = q.data;
  const order = view?.order;

  const refresh = () => qc.invalidateQueries({ queryKey: ['store', 'guest-order', token] });

  const fail = (err: unknown) => {
    const v = storeErrorView(err);
    toast({ title: v.title, description: v.description, variant: 'destructive' });
    if (v.action === 'reload_order') refresh();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = receiptFileProblem(file);
    if (problem) { toast({ title: 'Archivo no permitido', description: problem, variant: 'destructive' }); return; }
    setUploading(true);
    try {
      await uploadGuestReceipt(token, file);
      toast({ title: 'Comprobante enviado', description: 'La tienda lo va a revisar. Vuelve a este enlace para ver cómo va.' });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onCancel = async () => {
    setBusy('cancel');
    try {
      await cancelGuestOrder(token, cancelReason.trim() || undefined);
      toast({ title: 'Pedido cancelado', description: 'Liberamos los productos que tenías reservados.' });
      setCancelOpen(false);
      await refresh();
    } catch (err) { fail(err); } finally { setBusy(null); }
  };

  const onRetryPay = async () => {
    setBusy('pay');
    try {
      const p = await fetchGuestPayment(token);
      if (p.provider === 'wompi' && p.publicKey && p.signature && p.reference && p.amountInCents) {
        await openWompiCheckout({
          reference: p.reference, amountInCents: p.amountInCents, publicKey: p.publicKey, signature: p.signature,
          redirectUrl: `${window.location.origin}/pedido/${token}`,
        } as Parameters<typeof openWompiCheckout>[0]);
        await refresh();
      } else {
        toast({ title: 'Pago en línea no disponible', description: 'Escríbele a la tienda o cancela el pedido.' });
      }
    } catch (err) { fail(err); } finally { setBusy(null); }
  };

  const onRegenerateCode = async () => {
    if (!order) return;
    setBusy('code');
    try {
      const r = await regenerateGuestPickupCode(token);
      rememberGuestPickupCode(order.id, r.pickup_code, r.regenerations_used);
      setFreshCode({ code: r.pickup_code, left: r.regenerations_left });
      setCodeOpen(false);
      toast({ title: 'Código nuevo listo', description: 'El código anterior ya no sirve para retirar.' });
      await refresh();
    } catch (err) {
      setCodeOpen(false);
      fail(err);
    } finally { setBusy(null); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Copiado', description: text }); } catch { /* nada */ }
  };

  if (!validToken || q.isError || (!q.isLoading && !order)) {
    const kind = !validToken ? 'not_found' : q.isError ? orderLoadError(q.error) : 'not_found';
    const v = kind === 'rate_limited'
      ? { title: 'Demasiadas solicitudes', text: 'Demasiadas solicitudes, intenta en un minuto.' }
      : kind === 'network'
        ? { title: 'Sin conexión', text: 'No pudimos comunicarnos. Revisa tu internet e intenta de nuevo.' }
        : kind === 'other'
          ? { title: 'No pudimos cargar el pedido', text: 'Intenta de nuevo en un momento.' }
          : { title: 'Enlace no válido', text: 'Este enlace no existe o ya venció. Busca el correo más reciente de tu pedido o escríbele a la tienda.' };
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-16">
        <div className="max-w-md mx-auto text-center space-y-3" data-testid="order-load-error" data-kind={kind}>
          <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h1 className="text-xl font-bold">{v.title}</h1>
          <p className="text-sm text-muted-foreground">{v.text}</p>
          {kind !== 'not_found' && (
            <Button onClick={() => q.refetch()} disabled={q.isFetching} className="gap-1.5">
              {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (q.isLoading || !view || !order) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const status = normalizeOrderStatus(order.status);
  const pickup = order.fulfillment_mode !== 'shipping';
  const closed = status === 'delivered' || status === 'cancelled' || status === 'expired'
    || status === 'refunded' || status === 'partially_refunded';
  const stored = pickup ? recallGuestPickupCode(order.id) : null;
  const regenerations = Math.max(view.pickup?.regenerations_used ?? 0, pickupCodeRegenerations(view.history));
  const storedStale = !!stored && regenerations > stored.gen;
  const pickupCode = freshCode?.code ?? (stored && !storedStale ? stored.code : null);
  const canRegenerate = !!view.pickup?.can_regenerate;
  const showPickupBox = pickup && !closed && (!!pickupCode || canRegenerate || order.payment_method === 'cash_pickup');
  const needsReceipt = buyerCanUploadReceipt(order);
  const transfer: TransferInfo | null = view.transfer ?? navState?.transfer ?? null;
  const showCreatedBanner = justCreated && (status === 'pending_payment' || status === 'awaiting_approval');
  const storeName = view.store?.display_name ?? 'la tienda';

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-24">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Package className="h-4 w-4" /> Pedido en <span className="font-medium text-foreground">{storeName}</span>
        </p>

        {showCreatedBanner && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-4 flex gap-3" role="status" data-testid="order-created-banner">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">¡Pedido creado!</p>
              <p className="text-sm text-muted-foreground">
                Te guardamos los productos mientras completas el pago.{' '}
                {emailSent === 'failed'
                  ? 'No pudimos enviarte el correo: guarda esta página en tus favoritos.'
                  : <>Te enviamos este enlace a <span className="font-medium break-all">{order.email_masked}</span>.</>}
              </p>
            </div>
          </div>
        )}

        <header className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold font-mono break-all">{orderShortRef(order)}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm" data-testid="buyer-status-message">{buyerStatusMessage(order)}</p>
          {status === 'pending_payment' && order.expires_at && (
            <p className="text-xs text-muted-foreground">Reservado hasta el {new Date(order.expires_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</p>
          )}
          {order.customer_name && <p className="text-xs text-muted-foreground">A nombre de {order.customer_name}</p>}
        </header>

        {showPickupBox && (
          <section id="codigo" className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-2" aria-labelledby="pickup-code-title" data-testid="pickup-code-box">
            <h2 id="pickup-code-title" className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> Código de retiro</h2>
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
            ) : canRegenerate ? (
              <p className="text-sm" data-testid="pickup-code-missing">
                {storedStale
                  ? 'Generaste un código nuevo en otro dispositivo, así que el que estaba guardado aquí ya no sirve. Usa el nuevo o genera otro aquí.'
                  : 'Genera tu código de retiro aquí. Si ya tenías uno, el anterior deja de servir.'}
              </p>
            ) : (
              <p className="text-sm" data-testid="pickup-code-missing">
                {order.payment_method === 'cash_pickup'
                  ? 'Tu código de retiro está en el correo del pedido y en el dispositivo donde compraste. Como pagas en efectivo al retirar, escríbele a la tienda si no lo encuentras.'
                  : 'Cuando la tienda confirme el pago, aquí generas tu código de retiro.'}
              </p>
            )}
            {canRegenerate && (
              <Button variant={pickupCode ? 'outline' : 'default'} size="sm" className="gap-1.5"
                onClick={() => setCodeOpen(true)} disabled={busy === 'code'} data-testid="pickup-code-generate">
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
            ) : (
              <p className="text-sm text-amber-700">La tienda no tiene cuentas registradas. Escríbele antes de transferir.</p>
            )}
            {transfer?.instructions && <p className="text-sm text-muted-foreground whitespace-pre-line">{transfer.instructions}</p>}
            <p className="text-xs text-muted-foreground">En la descripción de la transferencia escribe la referencia <button type="button" className="font-mono underline break-all" onClick={() => copy(orderShortRef(order))}>{orderShortRef(order)}</button>.</p>
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
            <Loader2 className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <p>Comprobante enviado{order.receipt_submitted_at ? ` el ${new Date(order.receipt_submitted_at).toLocaleDateString('es-CO')}` : ''}. Esperando que la tienda lo apruebe. Mientras tanto tus productos siguen reservados.</p>
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Seguimiento</h2>
          <OrderTimeline order={order} history={view.history} />
        </section>

        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Productos</h2>
          <ul className="divide-y">
            {view.items.map((it) => (
              <li key={it.id} className="py-2 flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block">{it.quantity} × {it.name}</span>
                  {it.variant_name && <span className="block text-xs text-muted-foreground">{it.variant_name}</span>}
                </span>
                <span className="tabular-nums shrink-0">{formatCurrency(Number(it.unit_price) * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t pt-2 text-sm space-y-1">
            {Number(order.discount_total) > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Descuento</span><span className="tabular-nums">−{formatCurrency(Number(order.discount_total))}</span></div>
            )}
            <div className="flex justify-between text-muted-foreground"><span>Envío</span><span>{pickup ? 'Retiro en sede' : formatCurrency(Number(order.shipping_cost ?? 0))}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums" data-testid="order-total">{formatCurrency(Number(order.total_amount))}</span></div>
            {Number(order.tax_total) > 0 && <p className="text-xs text-muted-foreground text-right">Incluye IVA {formatCurrency(Number(order.tax_total))}</p>}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5">{pickup ? <School className="h-4 w-4 shrink-0" /> : <Truck className="h-4 w-4 shrink-0" />}
              {pickup
                ? `Retiro en ${view.pickup_branch?.name ?? 'la sede'}${view.pickup_branch?.address ? ` · ${view.pickup_branch.address}` : ''}`
                : `Envío a ${[order.shipping_address?.direccion, order.shipping_address?.ciudad, order.shipping_address?.departamento].filter(Boolean).join(', ')}`}
            </p>
            <p>Pago: {paymentMethodLabel(order.payment_method)}</p>
            {order.tracking_number && <p>Guía: {order.shipping_carrier ? `${order.shipping_carrier} · ` : ''}{order.tracking_number}</p>}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-2">
          {buyerCanRetryGateway(order) && (
            <Button onClick={onRetryPay} disabled={busy === 'pay'}>{busy === 'pay' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Pagar ahora</Button>
          )}
          {buyerCanCancel(order) && (
            <Button variant="outline" className="gap-1.5 text-destructive" onClick={() => setCancelOpen(true)} data-testid="guest-cancel"><XCircle className="h-4 w-4" /> Cancelar pedido</Button>
          )}
        </div>

        {/* Crear cuenta después: con el mismo correo, los pedidos aparecen solos en Mis compras. */}
        <section className="rounded-xl border border-dashed bg-card p-4 space-y-2" data-testid="guest-create-account">
          {order.linked_to_account || user ? (
            <>
              <p className="text-sm font-semibold flex items-center gap-1.5"><Mail className="h-4 w-4" /> {order.linked_to_account ? 'Este pedido ya está en tu cuenta' : 'Tienes sesión iniciada'}</p>
              <p className="text-xs text-muted-foreground">Si la cuenta usa el mismo correo del pedido ({order.email_masked}), lo ves también en «Mis compras».</p>
              {user && <Button asChild size="sm" variant="outline"><Link to="/mis-compras">Ir a Mis compras</Link></Button>}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold flex items-center gap-1.5"><UserPlus className="h-4 w-4" /> ¿Quieres tus compras siempre a mano?</p>
              <p className="text-xs text-muted-foreground">
                Crea tu cuenta con el mismo correo del pedido ({order.email_masked}). Cuando lo confirmes, este pedido y los siguientes aparecen en «Mis compras». Mientras tanto, este enlace sigue funcionando.
              </p>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to={`/register?redirectTo=${encodeURIComponent('/mis-compras')}`}><UserPlus className="h-4 w-4" /> Crear mi cuenta</Link>
              </Button>
            </>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center">Este enlace es tu acceso al pedido: no lo compartas.</p>

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
    </div>
  );
}
