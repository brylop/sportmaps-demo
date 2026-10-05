/**
 * StoreCheckoutPage — checkout de UNA pantalla (tienda v2 §2.5).
 * Ruta: /checkout/tienda/:vendorProfileId (un checkout por tienda, D-2).
 *
 * 1. Entrega: retiro en sede (por defecto en la tienda escolar) o envío.
 * 2. Datos del comprador, prellenados desde el perfil.
 * 3. Medio de pago: solo los que la tienda tiene habilitados
 *    (GET /api/v1/store/payment-methods/:vp). Transferencia con SUS cuentas
 *    (llegan al crear la orden), efectivo al retirar, Wompi/MP con la llave
 *    pública DEL VENDEDOR que devuelve el BFF.
 *
 * Contrato: docs/specs/tienda-v2-contrato-checkout.md. El cliente nunca manda
 * precios: el total que se muestra es el de `quote_cart` y el que se cobra el
 * de `create_cart_order`. Una idempotency key por intento de pago: un reintento
 * por red caída reusa la misma (devuelve la misma orden); cambiar algo del
 * pedido arranca un intento nuevo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Banknote, Building2, CreditCard, Loader2, Lock, MapPin, School, ShoppingBag, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { useCartQuote } from '@/hooks/useCartQuote';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, cn } from '@/lib/utils';
import { toCheckoutItems } from '@/lib/store/cart';
import { PAYMENT_METHOD_LABELS, type Fulfillment, type StorePaymentMethod } from '@/lib/store/orderStatus';
import { isRetryableWithSameKey, storeErrorView, type StoreErrorView } from '@/lib/store/storeErrors';
import {
  createStoreOrder, fetchPaymentMethods, rememberPickupCode, type CreatedOrder, type PublicPaymentMethod,
} from '@/lib/api/storeApi';
import { openWompiCheckout } from '@/lib/api/wompi';
import { MercadoPagoBrick } from '@/components/checkout/MercadoPagoBrick';

export const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlantico', 'Bogota DC', 'Bolivar', 'Boyaca', 'Caldas', 'Caqueta',
  'Casanare', 'Cauca', 'Cesar', 'Choco', 'Cordoba', 'Cundinamarca', 'Guainia', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Narino', 'Norte de Santander', 'Putumayo', 'Quindio', 'Risaralda',
  'San Andres', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupes', 'Vichada',
];

const METHOD_ICON: Record<StorePaymentMethod, typeof CreditCard> = {
  wompi: CreditCard, mercadopago: CreditCard, transfer: Building2, cash_pickup: Banknote,
};

interface VendorInfo { id: string; display_name: string; vendor_type: string | null; slug: string | null; school_id: string | null }
interface Branch { id: string; name: string; address: string | null; is_main: boolean | null }

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export default function StoreCheckoutPage() {
  const { vendorProfileId } = useParams<{ vendorProfileId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { items, removeItems } = useCart();
  const { toast } = useToast();

  const lines = useMemo(
    () => items.filter((i) => i.type === 'product' && i.metadata.vendorProfileId === vendorProfileId),
    [items, vendorProfileId],
  );

  const { data: vendor } = useQuery<VendorInfo | null>({
    queryKey: ['store', 'vendor-info', vendorProfileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendor_profiles')
        .select('id, display_name, vendor_type, slug, school_id')
        .eq('id', vendorProfileId!)
        .maybeSingle();
      return (data as unknown as VendorInfo | null) ?? null;
    },
    enabled: !!vendorProfileId,
  });
  const isSchoolStore = vendor?.vendor_type === 'school';

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['store', 'branches', vendor?.school_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('school_branches')
        .select('id, name, address, is_main')
        .eq('school_id', vendor!.school_id!)
        .eq('status', 'active')
        .order('is_main', { ascending: false });
      return (data ?? []) as Branch[];
    },
    enabled: !!vendor?.school_id,
  });

  const { data: methodsRes, isLoading: methodsLoading } = useQuery({
    queryKey: ['store', 'payment-methods', vendorProfileId],
    queryFn: () => fetchPaymentMethods(vendorProfileId!),
    enabled: !!vendorProfileId,
    retry: false,
  });

  // ── Estado del formulario ────────────────────────────────────────────────
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [fulfillmentTouched, setFulfillmentTouched] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [departamento, setDepartamento] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [buyer, setBuyer] = useState({ name: '', document: '', email: '', phone: '', notes: '' });
  const [method, setMethod] = useState<StorePaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<(StoreErrorView & { orderId?: string }) | null>(null);
  const [mpOrder, setMpOrder] = useState<CreatedOrder | null>(null);
  const [placed, setPlaced] = useState(false);
  const keyRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  // Externo: envío por defecto. Escolar: retiro en sede.
  useEffect(() => {
    if (vendor && !fulfillmentTouched) setFulfillment(isSchoolStore ? 'pickup' : 'shipping');
  }, [vendor, isSchoolStore, fulfillmentTouched]);

  useEffect(() => {
    if (!branchId && branches.length) setBranchId(branches[0].id);
  }, [branches, branchId]);

  useEffect(() => {
    if (!profile && !user) return;
    setBuyer((b) => ({
      name: b.name || profile?.full_name || '',
      document: b.document || ((profile as unknown as { document_number?: string | null })?.document_number ?? ''),
      email: b.email || profile?.email || user?.email || '',
      phone: b.phone || profile?.phone || '',
      notes: b.notes,
    }));
  }, [profile, user]);

  const methods: PublicPaymentMethod[] = useMemo(() => {
    const all = methodsRes?.methods ?? [];
    return all.filter((m) => {
      if (m.method === 'cash_pickup') return fulfillment === 'pickup';
      if (m.method === 'wompi' || m.method === 'mercadopago') return !!m.public_key;
      return true;
    });
  }, [methodsRes, fulfillment]);

  useEffect(() => {
    if (method && !methods.some((m) => m.method === method)) setMethod(null);
    if (!method && methods.length) setMethod(methods[0].method as StorePaymentMethod);
  }, [methods, method]);

  const address = fulfillment === 'shipping' && departamento
    ? { departamento, ciudad: ciudad.trim(), direccion: direccion.trim() }
    : null;
  const { quote, isFetching: quoting, notices, blocked, refetch: requote } = useCartQuote(lines, { fulfillment, address });

  // Cualquier cambio del pedido = intento nuevo (otra idempotency key).
  const intentSignature = JSON.stringify([toCheckoutItems(lines), fulfillment, branchId, address, method]);
  useEffect(() => { keyRef.current = null; }, [intentSignature]);

  const addressReady = fulfillment === 'pickup' || (!!departamento && ciudad.trim().length > 1 && direccion.trim().length > 4);
  const buyerReady = buyer.name.trim().length > 1 && /\S+@\S+\.\S+/.test(buyer.email.trim()) && buyer.phone.trim().length >= 7;
  const shippingProblem = fulfillment === 'shipping' && quote?.shipping_error === 'SHIPPING_ZONE_NOT_FOUND';
  const canPay = !!quote && !blocked && !quoting && !!method && addressReady && buyerReady && !shippingProblem
    && lines.length > 0 && !paying && quote.store_enabled !== false;

  const onPay = async () => {
    if (!canPay || !method || inFlight.current) return;
    inFlight.current = true;
    setPaying(true);
    setError(null);
    if (!keyRef.current) keyRef.current = newKey();
    try {
      const order = await createStoreOrder({
        items: toCheckoutItems(lines),
        fulfillment,
        pickupBranchId: fulfillment === 'pickup' ? branchId : null,
        address: fulfillment === 'shipping' ? { departamento, ciudad: ciudad.trim(), direccion: direccion.trim() } : null,
        buyer: {
          name: buyer.name.trim(), document: buyer.document.trim() || undefined, email: buyer.email.trim(),
          phone: buyer.phone.trim(), notes: buyer.notes.trim() || undefined,
        },
        paymentMethod: method,
        idempotencyKey: keyRef.current,
      });
      keyRef.current = null;
      setPlaced(true);
      if (order.pickupCode && user) rememberPickupCode(user.id, order.orderId, order.pickupCode);
      removeItems(lines.map((l) => l.id));

      if (order.paymentMethod === 'wompi') {
        if (!order.publicKey || !order.signature) {
          setError({ ...storeErrorView({ body: { error: 'SELLER_GATEWAY_NOT_CONFIGURED' } }), orderId: order.orderId });
          return;
        }
        await openWompiCheckout({
          reference: order.reference,
          amountInCents: order.amountInCents,
          publicKey: order.publicKey,
          signature: order.signature,
          customerEmail: buyer.email.trim(),
          customerName: buyer.name.trim(),
          customerPhone: buyer.phone.trim(),
          redirectUrl: `${window.location.origin}/mis-compras/${order.orderId}`,
        } as Parameters<typeof openWompiCheckout>[0]);
        navigate(`/mis-compras/${order.orderId}`, { replace: true, state: { created: true } });
        return;
      }
      if (order.paymentMethod === 'mercadopago') {
        if (!order.publicKey) {
          setError({ ...storeErrorView({ body: { error: 'SELLER_GATEWAY_NOT_CONFIGURED' } }), orderId: order.orderId });
          return;
        }
        setMpOrder(order);
        return;
      }
      navigate(`/mis-compras/${order.orderId}`, { replace: true, state: { created: true, transfer: order.transfer } });
    } catch (err) {
      const view = storeErrorView(err);
      const orderId = (err as { body?: { orderId?: string } })?.body?.orderId;
      if (!isRetryableWithSameKey(err)) keyRef.current = null;
      if (view.action === 'review_cart') requote();
      if (view.action === 'login') navigate(`/login?redirect=/checkout/tienda/${vendorProfileId}`);
      if (orderId) removeItems(lines.map((l) => l.id));
      setError({ ...view, orderId });
    } finally {
      inFlight.current = false;
      setPaying(false);
    }
  };

  if (placed && !mpOrder && !error) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="space-y-2"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground">Abriendo tu pedido…</p></div>
      </div>
    );
  }

  // ── Vacío ─────────────────────────────────────────────────────────────────
  if (lines.length === 0 && !mpOrder && !placed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">No hay productos de esta tienda en tu carrito</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/carrito')}>Ver carrito</Button>
          <Button onClick={() => navigate('/mis-compras')}>Mis compras</Button>
        </div>
      </div>
    );
  }

  const storeName = vendor?.display_name ?? lines[0]?.metadata.vendorName ?? 'la tienda';
  const total = quote?.total ?? 0;

  return (
    <div className="min-h-screen bg-muted/20 pb-36 md:pb-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="py-3">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Pagar en {storeName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Precio y disponibilidad confirmados por la tienda al pagar.</p>
        </div>

        <div className="grid md:grid-cols-[1fr_340px] gap-5">
          <div className="space-y-4">
            {/* 1. Entrega */}
            <section className="rounded-xl border bg-card p-4 space-y-3" aria-labelledby="sec-entrega">
              <h2 id="sec-entrega" className="font-semibold">1. Entrega</h2>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entrega">
                {isSchoolStore && (
                  <OptionCard
                    selected={fulfillment === 'pickup'}
                    onSelect={() => { setFulfillment('pickup'); setFulfillmentTouched(true); }}
                    icon={School} title="Retiro en sede" subtitle="Gratis"
                  />
                )}
                <OptionCard
                  selected={fulfillment === 'shipping'}
                  onSelect={() => { setFulfillment('shipping'); setFulfillmentTouched(true); }}
                  icon={Truck} title="Envío a domicilio" subtitle="Según el departamento"
                />
              </div>

              {fulfillment === 'pickup' && branches.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="branch">Sede de retiro</Label>
                  <Select value={branchId ?? undefined} onValueChange={setBranchId}>
                    <SelectTrigger id="branch"><SelectValue placeholder="Elige la sede" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}{b.address ? ` · ${b.address}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Te avisamos cuando esté listo para retirar.</p>
                </div>
              )}

              {fulfillment === 'shipping' && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dep">Departamento</Label>
                    <Select value={departamento || undefined} onValueChange={setDepartamento}>
                      <SelectTrigger id="dep"><SelectValue placeholder="Elige el departamento" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTAMENTOS_COLOMBIA.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input id="city" value={ciudad} onChange={(e) => setCiudad(e.target.value)} autoComplete="address-level2" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="addr">Dirección</Label>
                    <Input id="addr" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Cra 1 # 2-3, apto 101" autoComplete="street-address" />
                  </div>
                  {shippingProblem && (
                    <p className="sm:col-span-2 text-sm text-destructive flex items-center gap-1"><MapPin className="h-4 w-4" /> Esta tienda no envía a {departamento}.</p>
                  )}
                </div>
              )}
            </section>

            {/* 2. Datos */}
            <section className="rounded-xl border bg-card p-4 space-y-3" aria-labelledby="sec-datos">
              <h2 id="sec-datos" className="font-semibold">2. Tus datos</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field id="b-name" label="Nombre completo" value={buyer.name} onChange={(v) => setBuyer({ ...buyer, name: v })} autoComplete="name" />
                <Field id="b-doc" label="Documento (opcional)" value={buyer.document} onChange={(v) => setBuyer({ ...buyer, document: v })} />
                <Field id="b-email" label="Correo" type="email" value={buyer.email} onChange={(v) => setBuyer({ ...buyer, email: v })} autoComplete="email" />
                <Field id="b-phone" label="Celular" type="tel" value={buyer.phone} onChange={(v) => setBuyer({ ...buyer, phone: v })} autoComplete="tel" />
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="b-notes">Nota para la tienda (opcional)</Label>
                  <Textarea id="b-notes" rows={2} value={buyer.notes} onChange={(e) => setBuyer({ ...buyer, notes: e.target.value })} placeholder="Ej.: es para el hijo de la categoría sub 11" />
                </div>
              </div>
            </section>

            {/* 3. Pago */}
            <section className="rounded-xl border bg-card p-4 space-y-3" aria-labelledby="sec-pago">
              <h2 id="sec-pago" className="font-semibold">3. Medio de pago</h2>
              {methodsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : methodsRes && !methodsRes.allowed ? (
                <p className="text-sm text-amber-700 dark:text-amber-400" role="status">Esta tienda no está recibiendo pedidos en este momento.</p>
              ) : methods.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                  {fulfillment === 'shipping' && (methodsRes?.methods ?? []).some((m) => m.method === 'cash_pickup')
                    ? 'Con envío esta tienda no tiene medios de pago disponibles. Elige retiro en sede para pagar en efectivo.'
                    : 'La tienda todavía no configuró medios de pago. Escríbele para coordinar.'}
                </p>
              ) : (
                <div className="grid gap-2" role="radiogroup" aria-label="Medio de pago">
                  {methods.map((m) => {
                    const id = m.method as StorePaymentMethod;
                    const Icon = METHOD_ICON[id];
                    const hint = id === 'transfer' ? `Ves las cuentas de la tienda y subes el comprobante. Reservamos tus productos ${(m as { hold_hours: number }).hold_hours} h.`
                      : id === 'cash_pickup' ? 'Pagas en efectivo cuando retiras, con tu código de retiro.'
                        : 'Pago en línea seguro con la pasarela de la tienda.';
                    return (
                      <OptionCard key={id} selected={method === id} onSelect={() => setMethod(id)} icon={Icon} title={PAYMENT_METHOD_LABELS[id]} subtitle={hint} wide />
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Resumen */}
          <aside className="md:sticky md:top-4 h-fit rounded-xl border bg-card p-4 space-y-3" aria-label="Resumen del pedido">
            <h2 className="font-semibold">Resumen</h2>
            <ul className="space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="min-w-0"><span className="line-clamp-1">{l.quantity} × {l.name}</span>
                    {l.metadata.variantName && <span className="block text-xs text-muted-foreground">{l.metadata.variantName}</span>}
                  </span>
                  <span className="tabular-nums shrink-0">{formatCurrency(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            {notices.map((n) => (
              <p key={`${n.lineId}-${n.kind}`} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1" role="status"><AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" /> {n.message}</p>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              <Row label="Productos" value={quote ? formatCurrency(quote.subtotal) : '—'} />
              <Row label="Envío" value={fulfillment === 'pickup' ? 'Gratis' : quote?.shipping != null ? formatCurrency(quote.shipping) : '—'} />
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span className="tabular-nums" data-testid="checkout-total">{quote ? formatCurrency(total) : <Loader2 className="h-4 w-4 animate-spin" />}</span>
              </div>
              {quote && quote.tax_total > 0 && <p className="text-xs text-muted-foreground text-right">Incluye IVA {formatCurrency(quote.tax_total)}</p>}
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1" role="alert" data-testid="checkout-error">
                <p className="font-semibold text-destructive">{error.title}</p>
                <p className="text-muted-foreground">{error.description}</p>
                {error.orderId && (
                  <Button asChild size="sm" variant="outline" className="mt-1"><Link to={`/mis-compras/${error.orderId}`}>Ver el pedido reservado</Link></Button>
                )}
                {error.action === 'review_cart' && (
                  <Button size="sm" variant="outline" className="mt-1" onClick={() => navigate('/carrito')}>Revisar carrito</Button>
                )}
              </div>
            )}
            <div className="hidden md:block">
              <PayButton canPay={canPay} paying={paying} total={total} onPay={onPay} />
            </div>
          </aside>
        </div>
      </div>

      {/* Botón fijo en móvil */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <PayButton canPay={canPay} paying={paying} total={total} onPay={onPay} />
      </div>

      {/* Mercado Pago: Brick con la llave del vendedor */}
      <Dialog open={!!mpOrder} onOpenChange={(v) => { if (!v && mpOrder) navigate(`/mis-compras/${mpOrder.orderId}`, { replace: true }); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagar con Mercado Pago</DialogTitle>
            <DialogDescription>Total {mpOrder ? formatCurrency(mpOrder.grossAmount) : ''} · pedido {mpOrder?.reference}</DialogDescription>
          </DialogHeader>
          {mpOrder?.publicKey && (
            <MercadoPagoBrick
              publicKey={mpOrder.publicKey}
              sandbox={mpOrder.sandbox ?? true}
              transactionAmount={mpOrder.grossAmount}
              externalReference={mpOrder.reference}
              payerEmail={buyer.email.trim()}
              description={`Pedido ${mpOrder.reference}`}
              vendorId={vendorProfileId}
              onSuccess={() => navigate(`/mis-compras/${mpOrder.orderId}`, { replace: true })}
              onPending={() => navigate(`/mis-compras/${mpOrder.orderId}`, { replace: true })}
              onError={() => toast({ title: 'El pago no pasó', description: 'Puedes intentarlo de nuevo desde Mis compras.', variant: 'destructive' })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayButton({ canPay, paying, total, onPay }: { canPay: boolean; paying: boolean; total: number; onPay: () => void }) {
  return (
    <Button className="w-full h-12 text-base" disabled={!canPay} onClick={onPay} data-testid="pay-button">
      {paying ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
      {paying ? 'Creando tu pedido…' : `Pagar ${total > 0 ? formatCurrency(total) : ''}`}
    </Button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function Field({ id, label, value, onChange, type = 'text', autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
    </div>
  );
}

function OptionCard({ selected, onSelect, icon: Icon, title, subtitle, wide }: {
  selected: boolean; onSelect: () => void; icon: typeof CreditCard; title: string; subtitle?: string; wide?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'text-left rounded-xl border p-3 transition-colors flex gap-3 items-start',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50',
        wide && 'w-full',
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  );
}
