/**
 * TiendaPublicaPage — vitrina del vendedor (/tienda/:slug), tienda v2 §2.1.
 *
 * La ve cualquiera (link compartible). Un miembro de la escuela ve también los
 * productos `school_only` con el chip "Solo para miembros" (B4). La disponibilidad
 * sale por variante: "Agotado" solo si TODAS las variantes están en 0 (B3).
 * Tocar la tarjeta abre la ficha (/tienda/:slug/p/:productId) con talla y color.
 * El carrito persiste también para invitados; pagar pide sesión.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStoreCatalog } from '@/hooks/useStoreCatalog';
import { formatCurrency } from '@/lib/utils';
import { productLineId } from '@/lib/store/cart';
import { hasVariants, isSoldOut, priceRange, productAvailable, type StoreProduct } from '@/lib/store/variants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StoreChat } from '@/components/store/StoreChat';
import { StoreImage } from '@/components/store/StoreImage';
import {
  ShoppingBag, CheckCircle2, MapPin, Store, Plus, MessageCircle, School, Lock, ClipboardList, Search, X, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Sort = 'recent' | 'price_asc' | 'price_desc' | 'name';

export default function TiendaPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, getItemCount, setIsOpen } = useCart();
  const { toast } = useToast();
  const { data, isLoading, isError } = useStoreCatalog(slug);
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('recent');

  const vendor = data?.vendor;
  const allProducts = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    allProducts.forEach((p) => { if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allProducts]);
  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allProducts.filter((p) =>
      (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
    if (sort === 'recent') return list;
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'es')
        : sort === 'price_asc' ? priceRange(a).min - priceRange(b).min
          : priceRange(b).min - priceRange(a).min);
  }, [allProducts, category, query, sort]);
  const isSchoolStore = vendor?.vendor_type === 'school';

  const quickAdd = (p: StoreProduct) => {
    if (!vendor) return;
    addItem({
      id: productLineId(p.id),
      type: 'product',
      name: p.name,
      description: p.description ?? '',
      price: Number(p.price),
      image: p.image_url ?? undefined,
      stock: productAvailable(p),
      metadata: {
        productId: p.id,
        vendorProfileId: vendor.id,
        vendorName: vendor.display_name,
        vendorSlug: vendor.slug ?? slug,
      },
    });
  };

  const contactVendor = async () => {
    if (!user) {
      toast({ title: 'Inicia sesión para escribir', description: 'Así la tienda puede responderte.' });
      navigate(`/login?redirect=/tienda/${slug}`);
      return;
    }
    if (!vendor) return;
    const { data: existing } = await supabase
      .from('store_conversations')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('vendor_profile_id', vendor.id)
      .is('order_id', null)
      .maybeSingle();
    let convId = existing?.id as string | undefined;
    if (!convId) {
      const { data: created, error } = await supabase
        .from('store_conversations')
        .insert({ buyer_id: user.id, vendor_profile_id: vendor.id })
        .select('id')
        .single();
      if (error) {
        toast({ title: 'No se pudo abrir el chat', description: 'Intenta de nuevo en un momento.', variant: 'destructive' });
        return;
      }
      convId = created.id as string;
    }
    setChatConvId(convId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20" aria-busy="true" aria-label="Cargando tienda">
        <div className="h-40 sm:h-56 w-full bg-muted animate-pulse" />
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="-mt-10 flex gap-4"><div className="h-24 w-24 rounded-2xl bg-muted-foreground/20 animate-pulse" /></div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}><div className="aspect-square rounded-2xl bg-muted animate-pulse" /><div className="mt-3 h-4 w-3/4 rounded bg-muted animate-pulse" /><div className="mt-2 h-4 w-1/3 rounded bg-muted animate-pulse" /></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Store className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Tienda no encontrada</h1>
        <p className="text-muted-foreground max-w-sm">Este enlace no existe o la tienda no está publicada.</p>
        <Button variant="outline" onClick={() => navigate(user ? '/dashboard' : '/')}>Volver al inicio</Button>
      </div>
    );
  }

  const initials = (vendor.display_name || 'T').slice(0, 2).toUpperCase();
  const count = getItemCount();

  return (
    <div className="min-h-screen bg-muted/20 pb-28">
      {/* Portada */}
      {/* Sin portada propia el banner es decorativo: bajo en web para no dejar medio viewport vacío. */}
      <div
        className={cn(
          'w-full bg-gradient-to-br from-primary to-emerald-700 relative overflow-hidden',
          vendor.cover_image_url ? 'h-36 sm:h-56' : 'h-24 sm:h-32',
        )}
        data-testid="store-cover"
      >
        {vendor.cover_image_url ? (
          <img src={vendor.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 opacity-40"
            aria-hidden
            style={{ backgroundImage: 'radial-gradient(circle at 20% 120%, rgba(255,255,255,.35) 0, transparent 45%), radial-gradient(circle at 85% -20%, rgba(255,255,255,.3) 0, transparent 40%)' }}
          />
        )}
        <div className="absolute top-3 right-3 flex gap-2">
          <Button size="sm" variant="secondary" className="gap-1.5 shadow" onClick={() => setIsOpen(true)} aria-label={`Abrir carrito${count > 0 ? ` (${count})` : ''}`}>
            <ShoppingBag className="h-4 w-4" /> Carrito
            {count > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[11px] font-semibold min-w-5 h-5 px-1.5 grid place-items-center">{count}</span>}
          </Button>
          {user && (
            <Button asChild size="sm" variant="secondary" className="gap-1.5 shadow">
              <Link to="/mis-compras"><ClipboardList className="h-4 w-4" /> Mis compras</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Identidad. La portada es `relative` (se pinta encima de lo que no está
            posicionado): la fila va `relative z-10` para que el logo quede sobre la
            portada, y el bloque del nombre baja más que el traslape (-mt-10 = 40 px)
            para no quedar nunca debajo de ella, aunque el nombre ocupe dos líneas. */}
        <div className="relative z-10 flex items-start gap-3 sm:gap-4 -mt-10 sm:-mt-12 mb-4" data-testid="store-identity">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-background shadow-md bg-primary text-primary-foreground grid place-items-center overflow-hidden shrink-0">
            {vendor.logo_url ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl font-bold">{initials}</span>}
          </div>
          <div className="pt-11 sm:pt-14 min-w-0 flex-1">
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight break-words min-w-0" data-testid="store-name">{vendor.display_name}</h1>
              {(vendor.verification_status === 'verified' || isSchoolStore) && (
                <Badge className="bg-primary/10 text-primary gap-1 hover:bg-primary/10">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {isSchoolStore ? 'Tienda oficial' : 'Verificado'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Tienda</span>
              {vendor.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {vendor.city}</span>}
              {allProducts.length > 0 && <span>{allProducts.length} productos</span>}
            </div>
          </div>
          {/* Web: retiro y contacto viven en la cabecera, no en franjas de ancho completo. */}
          <div className="hidden md:flex items-center gap-3 pt-14 shrink-0">
            {isSchoolStore && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 h-10 text-sm text-emerald-900">
                <School className="h-4 w-4 shrink-0" /> <strong>Retiro gratis</strong> en la sede
              </span>
            )}
            <Button variant="outline" className="gap-1.5 h-10 rounded-full" onClick={contactVendor}>
              <MessageCircle className="h-4 w-4" /> Contactar a la tienda
            </Button>
          </div>
        </div>

        {isSchoolStore && (
          <div className="md:hidden mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm flex items-center gap-2">
            <School className="h-4 w-4 shrink-0" />
            <span><strong>Retiro gratis en la sede.</strong> Pides aquí y lo recoges en la sede.</span>
          </div>
        )}

        {!data.selling && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-4 py-3 text-sm" role="status">
            Esta tienda no está recibiendo pedidos en este momento. Puedes ver el catálogo, pero no comprar todavía.
          </div>
        )}

        <div className="md:hidden mb-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={contactVendor}>
            <MessageCircle className="h-4 w-4" /> Contactar a la tienda
          </Button>
        </div>

        {vendor.description && <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{vendor.description}</p>}

        {/* Barra de búsqueda y categorías */}
        {allProducts.length > 0 && (
          <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-5 bg-muted/80 backdrop-blur border-b">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative block md:w-80">
                <span className="sr-only">Buscar productos</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en la tienda…"
                  className="w-full h-10 rounded-xl border bg-background pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto md:flex-1 -mx-4 px-4 md:mx-0 md:px-0" role="toolbar" aria-label="Categorías">
                  {[[null, allProducts.length] as const, ...categories].map(([name, n]) => (
                    <button
                      key={name ?? 'todo'}
                      type="button"
                      aria-pressed={category === name}
                      onClick={() => setCategory(name)}
                      className={cn(
                        'shrink-0 whitespace-nowrap rounded-full border px-3.5 h-9 text-sm font-medium transition-colors',
                        category === name ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background hover:border-primary/50',
                      )}
                    >
                      {name ?? 'Todo'} <span className="opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-muted-foreground md:ml-auto">
                <span className="sr-only md:not-sr-only">Ordenar</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground">
                  <option value="recent">Más recientes</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                  <option value="name">Nombre A-Z</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Catálogo */}
        {allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-30" />
            <p>Esta tienda aún no tiene productos publicados.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Search className="h-10 w-10 opacity-30" />
            <p className="font-medium">{query ? `Nada coincide con “${query}”` : 'No hay productos en esta categoría'}</p>
            <Button variant="outline" onClick={() => { setQuery(''); setCategory(null); }}>Ver todo el catálogo</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5" data-testid="store-grid">
            {products.map((p) => {
              const soldOut = isSoldOut(p);
              const available = productAvailable(p);
              const range = priceRange(p);
              const href = `/tienda/${slug}/p/${p.id}`;
              const withVariants = hasVariants(p);
              return (
                <article key={p.id} className="group rounded-2xl border bg-background overflow-hidden flex flex-col transition-shadow hover:shadow-lg" data-testid="store-product-card" data-product-name={p.name}>
                  <Link to={href} className="block relative aspect-square bg-white" aria-label={`Ver ${p.name}`}>
                    {p.image_url ? (
                      <StoreImage src={p.image_url} width={600} sizes="(min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" alt={p.name} className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" loading="lazy" decoding="async" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-emerald-100/60 text-primary/60">
                        <Package className="h-10 w-10" aria-hidden />
                        <span className="text-[11px] font-medium uppercase tracking-wide px-3 text-center line-clamp-1">{p.category ?? vendor.display_name}</span>
                      </div>
                    )}
                    {p.visibility === 'school_only' && (
                      <span className="absolute top-2 left-2 rounded-full bg-background/90 text-[11px] font-medium px-2 py-0.5 flex items-center gap-1 shadow-sm">
                        <Lock className="h-3 w-3" /> Solo para miembros
                      </span>
                    )}
                    {/* Solo la última unidad: con umbral 5 casi todo el catálogo sale "últimas" y el aviso pierde sentido. El detalle va en la ficha. */}
                    {!soldOut && available === 1 && (
                      <span className="absolute top-2 left-2 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-1">¡Última unidad!</span>
                    )}
                    {soldOut && <span className="absolute inset-0 bg-background/60 grid place-items-center"><Badge variant="secondary">Agotado</Badge></span>}
                  </Link>
                  <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
                    {p.category && <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.category}</span>}
                    <Link to={href} className="text-sm sm:text-[15px] font-medium leading-snug line-clamp-2 flex-1 hover:underline">{p.name}</Link>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="font-bold tabular-nums text-base sm:text-lg">
                        {range.min !== range.max ? `Desde ${formatCurrency(range.min)}` : formatCurrency(range.min)}
                      </span>
                      {soldOut ? null : withVariants ? (
                        <Button asChild size="sm" variant="outline" className="h-9 px-3 text-xs">
                          <Link to={href}>Elegir talla</Link>
                        </Button>
                      ) : (
                        <Button size="icon" className="h-9 w-9 rounded-xl" onClick={() => quickAdd(p)} aria-label={`Agregar ${p.name}`} disabled={!data.selling}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-6">Precios con IVA incluido.</p>
      </div>

      {/* Chat con la tienda */}
      <Dialog open={!!chatConvId} onOpenChange={(v) => { if (!v) setChatConvId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Escríbele a {vendor.display_name}</DialogTitle></DialogHeader>
          {chatConvId && <StoreChat conversationId={chatConvId} viewerRole="buyer" />}
        </DialogContent>
      </Dialog>

      {/* Barra de carrito */}
      {count > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 w-[calc(100%-2rem)] max-w-md sm:w-80 z-40" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <button
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3.5 shadow-lg shadow-emerald-600/30 transition-colors"
            data-testid="cart-bar"
          >
            <span className="flex items-center gap-2 font-semibold text-sm">
              <ShoppingBag className="h-4 w-4" /> Ver carrito
              <span className="bg-white/25 rounded-full px-2 text-xs">{count}</span>
            </span>
            <span className="text-sm font-medium">Pagar</span>
          </button>
        </div>
      )}
    </div>
  );
}
