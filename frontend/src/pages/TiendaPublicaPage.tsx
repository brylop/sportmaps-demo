/**
 * TiendaPublicaPage — vitrina del vendedor (/tienda/:slug), tienda v2 §2.1.
 *
 * La ve cualquiera (link compartible). Un miembro de la escuela ve también los
 * productos `school_only` con el chip "Solo tu escuela" (B4). La disponibilidad
 * sale por variante: "Agotado" solo si TODAS las variantes están en 0 (B3).
 * Tocar la tarjeta abre la ficha (/tienda/:slug/p/:productId) con talla y color.
 * El carrito persiste también para invitados; pagar pide sesión.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStoreCatalog } from '@/hooks/useStoreCatalog';
import { formatCurrency } from '@/lib/utils';
import { productLineId } from '@/lib/store/cart';
import { availabilityLabel, hasVariants, isSoldOut, priceRange, productAvailable, type StoreProduct } from '@/lib/store/variants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StoreChat } from '@/components/store/StoreChat';
import {
  ShoppingBag, Loader2, CheckCircle2, MapPin, Store, Plus, MessageCircle, School, Lock, ClipboardList,
} from 'lucide-react';

const THUMB_GRADIENTS = [
  'linear-gradient(135deg,#2B4BF2,#5B7BFF)',
  'linear-gradient(135deg,#0FB981,#43D6A6)',
  'linear-gradient(135deg,#F5A524,#F7C15A)',
  'linear-gradient(135deg,#EC4899,#F472B6)',
];

export default function TiendaPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, getItemCount, setIsOpen } = useCart();
  const { toast } = useToast();
  const { data, isLoading, isError } = useStoreCatalog(slug);
  const [chatConvId, setChatConvId] = useState<string | null>(null);

  const vendor = data?.vendor;
  const products = data?.products ?? [];
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="h-32 sm:h-48 w-full bg-gradient-to-br from-primary to-indigo-600 relative">
        {vendor.cover_image_url && <img src={vendor.cover_image_url} alt="" className="h-full w-full object-cover" />}
        <div className="absolute top-3 right-3 flex gap-2">
          {user && (
            <Button asChild size="sm" variant="secondary" className="gap-1.5 shadow">
              <Link to="/mis-compras"><ClipboardList className="h-4 w-4" /> Mis compras</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        {/* Identidad */}
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="h-20 w-20 rounded-2xl border-4 border-background shadow-md bg-primary text-primary-foreground grid place-items-center overflow-hidden shrink-0">
            {vendor.logo_url ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl font-bold">{initials}</span>}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{vendor.display_name}</h1>
              {(vendor.verification_status === 'verified' || isSchoolStore) && (
                <Badge className="bg-primary/10 text-primary gap-1 hover:bg-primary/10">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {isSchoolStore ? 'Tienda de la escuela' : 'Verificado'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Tienda</span>
              {vendor.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {vendor.city}</span>}
            </div>
          </div>
        </div>

        {isSchoolStore && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm flex items-center gap-2">
            <School className="h-4 w-4 shrink-0" />
            <span><strong>Retiro gratis en la sede.</strong> Pides aquí y lo recoges en la escuela.</span>
          </div>
        )}

        {!data.selling && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-4 py-3 text-sm" role="status">
            Esta tienda no está recibiendo pedidos en este momento. Puedes ver el catálogo, pero no comprar todavía.
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={contactVendor}>
            <MessageCircle className="h-4 w-4" /> Contactar a la tienda
          </Button>
        </div>

        {vendor.description && <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{vendor.description}</p>}

        {/* Catálogo */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-30" />
            <p>Esta tienda aún no tiene productos publicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="store-grid">
            {products.map((p, i) => {
              const soldOut = isSoldOut(p);
              const available = productAvailable(p);
              const avail = availabilityLabel(available, p.low_stock_threshold);
              const range = priceRange(p);
              const href = `/tienda/${slug}/p/${p.id}`;
              const withVariants = hasVariants(p);
              return (
                <article key={p.id} className="rounded-xl border bg-background overflow-hidden flex flex-col" data-testid="store-product-card" data-product-name={p.name}>
                  <Link to={href} className="block relative aspect-square" aria-label={`Ver ${p.name}`}>
                    <div className="absolute inset-0 grid place-items-center text-white font-bold text-lg" style={{ background: THUMB_GRADIENTS[i % THUMB_GRADIENTS.length] }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : <span>{initials}</span>}
                    </div>
                    {p.visibility === 'school_only' && (
                      <span className="absolute top-2 left-2 rounded-full bg-background/90 text-[11px] font-medium px-2 py-0.5 flex items-center gap-1 shadow-sm">
                        <Lock className="h-3 w-3" /> Solo tu escuela
                      </span>
                    )}
                    {soldOut && <span className="absolute inset-0 bg-background/50" aria-hidden />}
                  </Link>
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <Link to={href} className="text-sm font-medium leading-snug line-clamp-2 flex-1 hover:underline">{p.name}</Link>
                    {avail.tone === 'low' && <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">{avail.text}</span>}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold tabular-nums text-sm sm:text-base">
                        {range.min !== range.max ? `Desde ${formatCurrency(range.min)}` : formatCurrency(range.min)}
                      </span>
                      {soldOut ? (
                        <Badge variant="secondary" className="text-[10px]">Agotado</Badge>
                      ) : withVariants ? (
                        <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                          <Link to={href}>Elegir talla</Link>
                        </Button>
                      ) : (
                        <Button size="icon" className="h-8 w-8" onClick={() => quickAdd(p)} aria-label={`Agregar ${p.name}`} disabled={!data.selling}>
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-40" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
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
