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
  AlertTriangle, ArrowLeft, Banknote, Building2, CreditCard, Loader2, Lock, MapPin, School, ShoppingBag, Tag, Truck, X, UserRound, LogIn,
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
  createStoreOrder, fetchPaymentMethods, rememberPickupCode, storeOffersShipping, type CreatedOrder, type PublicPaymentMethod,
} from '@/lib/api/storeApi';
import {
  createGuestStoreOrder, fetchPublicPaymentMethods, rememberGuestPickupCode, type GuestPaymentMethod,
} from '@/lib/api/storeGuestApi';
import { buyerCopy } from '@/lib/store/buyerCopy';
import { couponErrorText, normalizeCouponCode } from '@/lib/store/coupons';
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
  const { user, profile, loading: authLoading } = useAuth();
  // Compra sin cuenta (mig. 20261013170553): sin sesión se elige "Iniciar
  // sesión" o "Continuar sin cuenta". El socio sin cuenta deja correo y nombre
  // (teléfono opcional) y recibe el enlace de su pedido por correo.
  const [guestChosen, setGuestChosen] = useState(false);
  const guest = !user;
  const [honeypot, setHoneypot] = useState('');
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

  const { data: schoolBranches = [] } = useQuery<Branch[]>({
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
    queryKey: ['store', 'payment-methods', vendorProfileId, !!user],
    // Sin sesión, la ruta pública (la de /api/v1/store exige sesión).
    queryFn: () => (user ? fetchPaymentMethods(vendorProfileId!) : fetchPublicPaymentMethods(vendorProfileId!)),
    enabled: !!vendorProfileId && !authLoading,
    retry: false,
  });

  // Entrega que ofrece la tienda (mig. 20261008163336). «Solo retiro en sede»
  // (GYM RM) = no se muestra el envío. Sin dato = sin restricción (como antes).
  const offersShipping = storeOffersShipping(methodsRes);
  // Retiro: la tienda escolar siempre; una externa solo si la tienda lo publica.
  const offersPickup = isSchoolStore || (!!methodsRes?.fulfillment && !offersShipping);
  const branches: Branch[] = useMemo(() => {
    const fromStore = methodsRes?.fulfillment?.pickup_branches;
    if (fromStore && fromStore.length) {
      return fromStore.map((b) => ({ id: b.id, name: b.name, address: b.address ?? null, is_main: b.is_main ?? null }));
    }
    return schoolBranches;
  }, [methodsRes, schoolBranches]);

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
  // Cupón (F3b): el comprador escribe el código; quote_cart lo valida y calcula.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState<string | null>(null);

  // Externo: envío por defecto. Escolar: retiro en sede. Solo retiro: siempre retiro.
  useEffect(() => {
    if (vendor && !fulfillmentTouched) setFulfillment(isSchoolStore || !offersShipping ? 'pickup' : 'shipping');
  }, [vendor, isSchoolStore, fulfillmentTouched, offersShipping]);
  useEffect(() => {
    if (!offersShipping && fulfillment === 'shipping') setFulfillment('pickup');
  }, [offersShipping, fulfillment]);

  useEffect(() => {
    if (branches.length && (!branchId || !branches.some((b) => b.id === branchId))) setBranchId(branches[0].id);
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
      // Mercado Pago necesita sesión (el BFF crea el pago con el usuario): sin cuenta no se ofrece.
      if (m.method === 'mercadopago' && guest) return false;
      if (m.method === 'wompi' || m.method === 'mercadopago') return !!m.public_key;
      return true;
    });
  }, [methodsRes, fulfillment, guest]);

  useEffect(() => {
    if (method && !methods.some((m) => m.method === method)) setMethod(null);
    if (!method && methods.length) setMethod(methods[0].method as StorePaymentMethod);
  }, [methods, method]);

  const address = fulfillment === 'shipping' && departamento
    ? { departamento, ciudad: ciudad.trim(), direccion: direccion.trim() }
    : null;
  const { quote, isFetching: quoting, notices, blocked, refetch: requote } = useCartQuote(lines, { fulfillment, address, couponCode: couponApplied });
  const couponProblem = couponApplied && quote && !quoting ? couponErrorText(quote.coupon_error, quote.coupon_error_detail) : null;
  const couponOk = !!couponApplied && !!quote?.coupon && !quote.coupon_error;
  const applyCoupon = () => {
    const code = normalizeCouponCode(couponInput);
    if (code) setCouponApplied(code);
  };
  const removeCoupon = () => { setCouponApplied(null); setCouponInput(''); };

  // Cualquier cambio del pedido = intento nuevo (otra idempotency key).
  const intentSignature = JSON.stringify([toCheckoutItems(lines), fulfillment, branchId, address, method, couponApplied]);
  useEffect(() => { keyRef.current = null; }, [intentSignature]);

  const addressReady = fulfillment === 'pickup' || (!!departamento && ciudad.trim().length > 1 && direccion.trim().length > 4);
  // Sin cuenta el celular es opcional (si lo escribe, que sea válido); el correo, obligatorio.
  const phoneDigits = buyer.phone.replace(/[\s().-]/g, '');
  const buyerReady = buyer.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(buyer.email.trim())
    && (guest ? (phoneDigits === '' || /^\+?[0-9]{7,15}$/.test(phoneDigits)) : buyer.phone.trim().length >= 7);
  // Sin zona de envío para el departamento: mensaje claro (nunca el código crudo).
  const shippingProblem = fulfillment === 'shipping' && !!departamento && !!quote?.shipping_error;
  // Un código con problema no se cobra a ciegas: se corrige o se quita antes de pagar.
  const canPay = !!quote && !blocked && !quoting && !!method && addressReady && buyerReady && !shippingProblem
    && lines.length > 0 && !paying && quote.store_enabled !== false && !(couponApplied && !couponOk);

  const onPay = async () => {
    if (!canPay || !method || inFlight.current) return;
    inFlight.current = true;
    setPaying(true);
    setError(null);
    if (!keyRef.current) keyRef.current = newKey();
    try {
      if (guest) {
        // Sin cuenta: el BFF crea el pedido (service role) y devuelve el enlace /pedido/:token UNA vez.
        const g = await createGuestStoreOrder({
          items: toCheckoutItems(lines),
          fulfillment,
          pickupBranchId: fulfillment === 'pickup' ? branchId : null,
          address: fulfillment === 'shipping' ? { departamento, ciudad: ciudad.trim(), direccion: direccion.trim() } : null,
          buyer: {
            name: buyer.name.trim(), email: buyer.email.trim(), phone: phoneDigits || undefined,
            document: buyer.document.trim() || undefined, notes: buyer.notes.trim() || undefined,
          },
          paymentMethod: method as GuestPaymentMethod,
          idempotencyKey: keyRef.current,
          couponCode: couponOk ? couponApplied : null,
          website: honeypot,
        });
        keyRef.current = null;
        removeItems(lines.map((l) => l.id));
        if (!g.accessToken || !g.orderPath) {
          // Reintento del mismo clic: el pedido ya existía y su enlace salió por correo.
          setError({ code: 'GUEST_ALREADY_CREATED', title: 'Tu pedido ya está creado', description: 'Te enviamos el enlace del pedido a tu correo: ábrelo desde ahí para pagar o subir el comprobante.', action: 'none' });
          return;
        }
        setPlaced(true);
        if (g.pickupCode) rememberGuestPickupCode(g.orderId, g.pickupCode);
        if (g.paymentMethod === 'wompi' && g.publicKey && g.signature && g.amountInCents) {
          await openWompiCheckout({
            reference: g.reference, amountInCents: g.amountInCents, publicKey: g.publicKey, signature: g.signature,
            customerEmail: buyer.email.trim(), customerName: buyer.name.trim(), customerPhone: phoneDigits,
            redirectUrl: `${window.location.origin}${g.orderPath}`,
          } as Parameters<typeof openWompiCheckout>[0]);
        }
        navigate(g.orderPath, { replace: true, state: { created: true, transfer: g.transfer ?? null, emailSent: g.emailSent } });
        return;
      }
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
        couponCode: couponOk ? couponApplied : null,
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
      if (view.action === 'review_cart' || view.action === 'fix_coupon') requote();
      // Con cuenta, la sesión venció: al login. Sin cuenta se ofrece el botón (no se saca de la pantalla).
      if (view.action === 'login' && !guest) navigate(`/login?redirectTo=${encodeURIComponent(`/checkout/tienda/${vendorProfileId}`)}`);
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

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ── Sin sesión: iniciar sesión o continuar sin cuenta ─────────────────────
  if (guest && !guestChosen) {
    const loginUrl = `/login?redirectTo=${encodeURIComponent(`/checkout/tienda/${vendorProfileId}`)}`;
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-6">
        <div className="max-w-md mx-auto space-y-4">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pagar en {storeName}</h1>
            <p className="text-sm text-muted-foreground">{lines.length} {lines.length === 1 ? 'producto' : 'productos'} en tu carrito.</p>
          </div>
          <section className="rounded-xl border bg-card p-4 space-y-3" data-testid="guest-choice">
            <Button className="w-full h-12 text-base gap-2" onClick={() => setGuestChosen(true)} data-testid="guest-continue">
              <UserRound className="h-5 w-5" /> Continuar sin cuenta
            </Button>
            <p className="text-xs text-muted-foreground">Solo te pedimos tu nombre y tu correo. Te enviamos el enlace de tu pedido para pagar, subir el comprobante y ver el código de retiro.</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" /></div>
            <Button variant="outline" className="w-full h-11 gap-2" onClick={() => navigate(loginUrl)} data-testid="guest-login">
              <LogIn className="h-4 w-4" /> Iniciar sesión
            </Button>
            <p className="text-xs text-muted-foreground">Con tu cuenta ves todas tus compras en «Mis compras».</p>
          </section>
        </div>
      </div>
    );
  }

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
              {!offersShipping ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex gap-3 items-start" data-testid="pickup-only">
                  <School className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Retiro en sede · Gratis</span>
                    <span className="block text-xs text-muted-foreground">Esta tienda entrega solo en la sede: no hace envíos a domicilio.</span>
                  </span>
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entrega">
                {offersPickup && (
                  <OptionCard
                    selected={fulfillment === 'pickup'}
                    onSelect={() => { setFulfillment('pickup'); setFulfillmentTouched(true); }}
                    icon={School} title="Retiro en sede" subtitle="Gratis"
                  />
                )}
                {/* Hasta saber qué ofrece la tienda no se muestra el envío (evita ofrecerlo y quitarlo). */}
                {!methodsLoading && (
                <OptionCard
                  selected={fulfillment === 'shipping'}
                  onSelect={() => { setFulfillment('shipping'); setFulfillmentTouched(true); }}
                  icon={Truck} title="Envío a domicilio" subtitle="Según el departamento"
                />
                )}
              </div>
              )}

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
                    <p className="sm:col-span-2 text-sm text-destructive flex items-start gap-1" role="alert" data-testid="shipping-zone-problem">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Esta tienda todavía no hace envíos a {departamento}.{' '}
                        {offersPickup ? 'Elige retiro en sede o escríbele a la tienda para coordinar.' : 'Prueba con otro departamento o escríbele a la tienda para coordinar.'}
                      </span>
                    </p>
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
                <Field id="b-phone" label={guest ? 'Celular (opcional)' : 'Celular'} type="tel" value={buyer.phone} onChange={(v) => setBuyer({ ...buyer, phone: v })} autoComplete="tel" />
                {guest && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground" data-testid="guest-email-hint">
                    Compras sin cuenta: a este correo te llega el enlace de tu pedido. Revisa que esté bien escrito.
                  </p>
                )}
                {guest && (
                  // Trampa para bots: invisible para las personas (y para los lectores de pantalla).
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                    value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                )}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="b-notes">Nota para la tienda (opcional)</Label>
                  <Textarea id="b-notes" rows={2} value={buyer.notes} onChange={(e) => setBuyer({ ...buyer, notes: e.target.value })} placeholder={buyerCopy(profile?.role).notesPlaceholder} />
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
            <CouponBox
              open={couponOpen || !!couponApplied}
              onOpen={() => setCouponOpen(true)}
              input={couponInput}
              onInput={setCouponInput}
              onApply={applyCoupon}
              onRemove={removeCoupon}
              applied={couponOk ? quote?.coupon ?? null : null}
              checking={!!couponApplied && quoting}
              problem={couponProblem}
            />
            <div className="border-t pt-2 space-y-1 text-sm">
              <Row label="Productos" value={quote ? formatCurrency(quote.subtotal) : '—'} />
              {couponOk && quote && quote.discount_total > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400" data-testid="checkout-discount">
                  <span>Descuento ({quote.coupon?.code})</span>
                  <span className="tabular-nums">−{formatCurrency(quote.discount_total)}</span>
                </div>
              )}
              <Row label="Envío" value={fulfillment === 'pickup' ? 'Gratis' : shippingProblem ? 'No disponible' : quote?.shipping != null ? formatCurrency(quote.shipping) : '—'} />
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
                {error.action === 'login' && guest && (
                  <Button size="sm" variant="outline" className="mt-1 gap-1.5"
                    onClick={() => navigate(`/login?redirectTo=${encodeURIComponent(`/checkout/tienda/${vendorProfileId}`)}`)}>
                    <LogIn className="h-4 w-4" /> Iniciar sesión
                  </Button>
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
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
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

function CouponBox({ open, onOpen, input, onInput, onApply, onRemove, applied, checking, problem }: {
  open: boolean; onOpen: () => void; input: string; onInput: (v: string) => void; onApply: () => void; onRemove: () => void;
  applied: { code: string; discount_total: number; description: string | null } | null; checking: boolean; problem: string | null;
}) {
  if (!open) {
    return (
      <button type="button" className="text-sm text-primary underline-offset-2 hover:underline flex items-center gap-1" onClick={onOpen} data-testid="coupon-toggle">
        <Tag className="h-3.5 w-3.5" /> ¿Tienes un código de descuento?
      </button>
    );
  }
  if (applied) {
    return (
      <div className="rounded-lg border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-sm flex items-start gap-2" data-testid="coupon-applied">
        <Tag className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{applied.code} · −{formatCurrency(applied.discount_total)}</span>
          {applied.description && <span className="block text-xs text-muted-foreground line-clamp-2">{applied.description}</span>}
        </span>
        <button type="button" onClick={onRemove} aria-label="Quitar el código" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor="coupon">Código de descuento</Label>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onApply(); }}>
        <Input
          id="coupon" value={input} onChange={(e) => onInput(e.target.value.toUpperCase())} maxLength={30}
          autoCapitalize="characters" autoComplete="off" placeholder="Ej: SOCIOS10" className="uppercase"
        />
        <Button type="submit" variant="outline" disabled={!input.trim() || checking} data-testid="coupon-apply">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
        </Button>
      </form>
      {problem && (
        <p className="text-xs text-destructive flex items-start gap-1" role="alert" data-testid="coupon-error">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>{problem} <button type="button" className="underline" onClick={onRemove}>Quitar</button></span>
        </p>
      )}
    </div>
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
