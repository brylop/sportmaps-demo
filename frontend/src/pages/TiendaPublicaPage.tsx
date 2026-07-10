/**
 * TiendaPublicaPage — vitrina pública del vendedor (storefront).
 *
 * URL compartible y pública: /tienda/:slug. La ve cualquiera sin login
 * (endpoint BFF GET /marketplace/vendor/:slug, público). Muestra solo productos
 * `public`. "Agregar" requiere sesión (el carrito no persiste para invitados);
 * el checkout de invitado queda para una iteración posterior.
 *
 * Es la superficie que "expone el vender" del diseño aprobado
 * (docs/tienda-productos-flujo.md).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Loader2, CheckCircle2, MapPin, Store, Plus } from 'lucide-react';

interface Vendor {
  id: string;
  user_id: string;
  display_name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  vendor_type: string | null;
  verification_status?: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock: number | null;
}

interface VendorResponse {
  ok: boolean;
  data?: { vendor: Vendor; products: Product[]; services: unknown[] };
  error?: string;
}

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
  const { addItem, getItemCount, getTotal, setIsOpen } = useCart();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await bffClient.get<VendorResponse>(
          `/api/v1/marketplace/vendor/${encodeURIComponent(slug)}`,
          undefined,
          'public',
        );
        if (!active) return;
        if (!res.ok || !res.data) {
          setNotFound(true);
        } else {
          setVendor(res.data.vendor);
          setProducts(res.data.products ?? []);
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const handleAdd = (p: Product) => {
    if (!user) {
      toast({ title: 'Inicia sesión para comprar', description: 'Guarda tus productos y paga en segundos.' });
      navigate(`/login?redirect=/tienda/${slug}`);
      return;
    }
    if (!vendor) return;
    addItem({
      id: `product-${p.id}`,
      type: 'product',
      name: p.name,
      description: p.description ?? '',
      price: Number(p.price),
      image: p.image_url ?? undefined,
      metadata: { productId: p.id, vendorProfileId: vendor.id, vendorName: vendor.display_name },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Store className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Tienda no encontrada</h1>
        <p className="text-muted-foreground max-w-sm">Este enlace no existe o la tienda no está publicada.</p>
        <Button variant="outline" onClick={() => navigate('/marketplace')}>Ir a Explorar</Button>
      </div>
    );
  }

  const initials = (vendor.display_name || 'T').slice(0, 2).toUpperCase();
  const count = getItemCount();

  return (
    <div className="min-h-screen bg-muted/20 pb-28">
      {/* Portada */}
      <div className="h-36 sm:h-48 w-full bg-gradient-to-br from-primary to-indigo-600 relative">
        {vendor.cover_image_url && (
          <img src={vendor.cover_image_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="container mx-auto px-4 max-w-4xl">
        {/* Identidad */}
        <div className="flex items-end gap-4 -mt-10 mb-6">
          <div className="h-20 w-20 rounded-2xl border-4 border-background shadow-md bg-primary text-primary-foreground grid place-items-center overflow-hidden shrink-0">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
              : <span className="text-2xl font-bold">{initials}</span>}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{vendor.display_name}</h1>
              {vendor.verification_status === 'verified' && (
                <Badge className="bg-primary/10 text-primary gap-1 hover:bg-primary/10">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verificado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Tienda</span>
              {vendor.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {vendor.city}</span>}
            </div>
          </div>
        </div>

        {vendor.description && (
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{vendor.description}</p>
        )}

        {/* Catálogo */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-30" />
            <p>Esta tienda aún no tiene productos publicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p, i) => {
              const soldOut = p.stock != null && p.stock <= 0;
              return (
                <div key={p.id} className="rounded-xl border bg-background overflow-hidden flex flex-col">
                  <div className="h-28 sm:h-32 grid place-items-center text-white font-bold text-lg"
                       style={{ background: THUMB_GRADIENTS[i % THUMB_GRADIENTS.length] }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      : <span>{initials}</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="text-sm font-medium leading-snug line-clamp-2 flex-1">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold tabular-nums">{formatCurrency(Number(p.price))}</span>
                      {soldOut ? (
                        <Badge variant="secondary" className="text-[10px]">Agotado</Badge>
                      ) : (
                        <Button size="icon" className="h-8 w-8" onClick={() => handleAdd(p)} aria-label={`Agregar ${p.name}`}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de carrito */}
      {user && count > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3.5 shadow-lg shadow-emerald-600/30 transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold text-sm">
              <ShoppingBag className="h-4 w-4" /> Ver carrito
              <span className="bg-white/25 rounded-full px-2 text-xs">{count}</span>
            </span>
            <span className="font-bold tabular-nums">{formatCurrency(getTotal())}</span>
          </button>
        </div>
      )}
    </div>
  );
}
