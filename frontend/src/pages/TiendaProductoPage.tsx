/**
 * TiendaProductoPage — ficha de producto (/tienda/:slug/p/:productId), tienda v2 §2.3.
 *
 * Galería, precio final (IVA incluido), selector talla × color con las
 * combinaciones sin stock visibles pero tachadas, disponibilidad ("Últimas N"),
 * entrega antes de comprar y cantidad con tope = disponible.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Package, School, ShoppingBag, Store, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useStoreCatalog } from '@/hooks/useStoreCatalog';
import { formatCurrency, cn } from '@/lib/utils';
import { productLineId } from '@/lib/store/cart';
import {
  availabilityLabel, defaultSelection, findVariant, hasVariants, optionState, productAvailable,
  variantAxes, variantLabel, type Selection,
} from '@/lib/store/variants';
import { QtyStepper } from '@/components/store/QtyStepper';

export default function TiendaProductoPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const navigate = useNavigate();
  const { addItem, setIsOpen, getItemCount } = useCart();
  const { data, isLoading, isError } = useStoreCatalog(slug);
  const product = data?.products.find((p) => p.id === productId);
  const vendor = data?.vendor;

  const variants = useMemo(() => product?.variants ?? [], [product]);
  const axes = useMemo(() => variantAxes(variants), [variants]);
  const [selection, setSelection] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);

  useEffect(() => {
    if (variants.length) setSelection(defaultSelection(variants));
  }, [variants]);

  const withVariants = !!product && hasVariants(product);
  const variant = withVariants ? findVariant(variants, selection) : undefined;
  const available = !product ? 0 : withVariants ? (variant?.available ?? 0) : productAvailable(product);
  const price = variant?.price ?? product?.price ?? 0;
  const avail = availabilityLabel(available, product?.low_stock_threshold);

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, Math.max(available, 1))));
  }, [available]);

  const images = useMemo(() => {
    const list = [...(product?.images ?? []), ...(product?.image_url ? [product.image_url] : [])];
    if (variant?.image_url) list.unshift(variant.image_url);
    return [...new Set(list.filter(Boolean))];
  }, [product, variant]);

  useEffect(() => { setImageIdx(0); }, [variant?.id]);

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (isError || !vendor || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Package className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Producto no disponible</h1>
        <p className="text-muted-foreground max-w-sm">Este producto no existe o no está a la venta para tu cuenta.</p>
        <Button variant="outline" onClick={() => navigate(`/tienda/${slug}`)}>Volver a la tienda</Button>
      </div>
    );
  }

  const isSchoolStore = vendor.vendor_type === 'school';
  const canBuy = data!.selling && available > 0 && (!withVariants || !!variant);

  const add = (goToCart: boolean) => {
    addItem({
      id: productLineId(product.id, variant?.id),
      type: 'product',
      name: product.name,
      description: product.description ?? '',
      price,
      image: variant?.image_url ?? product.image_url ?? undefined,
      stock: available,
      metadata: {
        productId: product.id,
        variantId: variant?.id,
        variantName: variant ? variantLabel(variant) : undefined,
        vendorProfileId: vendor.id,
        vendorName: vendor.display_name,
        vendorSlug: vendor.slug ?? slug,
      },
    }, qty);
    if (goToCart) navigate(`/checkout/tienda/${vendor.id}`);
  };

  const missingAxis = withVariants ? axes.find((a) => !selection[a.key]) : undefined;

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between py-3">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" asChild>
            <Link to={`/tienda/${slug}`}><ArrowLeft className="h-4 w-4" /> {vendor.display_name}</Link>
          </Button>
          {getItemCount() > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsOpen(true)}>
              <ShoppingBag className="h-4 w-4" /> Carrito ({getItemCount()})
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10">
          {/* Galería */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted grid place-items-center">
              {images[imageIdx]
                ? <img src={images[imageIdx]} alt={product.name} className="h-full w-full object-cover" />
                : <Package className="h-16 w-16 text-muted-foreground/40" />}
              {product.visibility === 'school_only' && (
                <span className="absolute top-3 left-3 rounded-full bg-background/90 text-xs font-medium px-2.5 py-1 flex items-center gap-1 shadow-sm">
                  <Lock className="h-3 w-3" /> Solo tu escuela
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setImageIdx(i)}
                    className={cn('h-16 w-16 rounded-lg overflow-hidden border-2 shrink-0', i === imageIdx ? 'border-primary' : 'border-transparent')}
                    aria-label={`Ver imagen ${i + 1}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compra */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Store className="h-3.5 w-3.5" /> {vendor.display_name}</p>
            </div>

            <div>
              <p className="text-3xl font-bold tabular-nums" data-testid="product-price">{formatCurrency(price)}</p>
              <p className="text-xs text-muted-foreground">IVA incluido</p>
            </div>

            {axes.map((axis) => (
              <fieldset key={axis.key} className="space-y-2">
                <legend className="text-sm font-medium">
                  {axis.label}{selection[axis.key] ? <span className="text-muted-foreground font-normal">: {selection[axis.key]}</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {axis.values.map((value) => {
                    const state = optionState(variants, selection, axis.key, value);
                    const selected = selection[axis.key] === value;
                    const off = state !== 'available';
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={off}
                        aria-pressed={selected}
                        aria-label={`${axis.label} ${value}${state === 'sold_out' ? ' (agotada)' : ''}`}
                        onClick={() => setSelection((s) => ({ ...s, [axis.key]: value }))}
                        className={cn(
                          'min-w-11 h-10 px-3 rounded-lg border text-sm font-medium transition-colors capitalize',
                          selected ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:border-primary/60',
                          off && 'opacity-50 line-through cursor-not-allowed hover:border-input',
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="flex items-center gap-2" data-testid="product-availability">
              {missingAxis ? (
                <span className="text-sm text-muted-foreground">Elige {missingAxis.label.toLowerCase()} para ver disponibilidad.</span>
              ) : (
                <Badge variant={avail.tone === 'out' ? 'secondary' : 'outline'} className={cn(avail.tone === 'low' && 'border-amber-400 text-amber-700 dark:text-amber-400')}>
                  {avail.text}
                </Badge>
              )}
            </div>

            <div className="rounded-xl border p-3 text-sm space-y-1">
              {isSchoolStore ? (
                <p className="flex items-start gap-2"><School className="h-4 w-4 mt-0.5 text-emerald-600" /><span><strong>Retiro gratis en la sede</strong> · listo en 1 a 2 días hábiles después del pago.</span></p>
              ) : (
                <p className="flex items-start gap-2"><Truck className="h-4 w-4 mt-0.5 text-primary" /><span>Envío según tu departamento: lo ves antes de pagar.</span></p>
              )}
            </div>

            {!data!.selling && (
              <p className="text-sm text-amber-700 dark:text-amber-400" role="status">Esta tienda no está recibiendo pedidos en este momento.</p>
            )}

            {/* Acciones (fijas abajo en móvil) */}
            <div className="fixed md:static bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t md:border-0 p-4 md:p-0 space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="flex items-center gap-3">
                <QtyStepper value={qty} max={Math.max(available, 1)} label={product.name} onChange={setQty} disabled={!canBuy} />
                <Button className="flex-1" variant="outline" disabled={!canBuy} onClick={() => add(false)}>
                  Agregar al carrito
                </Button>
              </div>
              <Button className="w-full" disabled={!canBuy} onClick={() => add(true)}>
                {available <= 0 && !missingAxis ? 'Agotado' : 'Comprar ahora'}
              </Button>
            </div>

            {product.description && (
              <div className="pt-2">
                <h2 className="font-semibold mb-1">Descripción</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
