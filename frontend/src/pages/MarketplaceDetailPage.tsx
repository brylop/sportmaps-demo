import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ShoppingCart, Clock, MapPin, Store, Star, CheckCircle } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { ShareButton } from '@/components/marketplace/ShareButton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function MarketplaceDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const endpoint = type === 'product'
          ? `${API_URL}/api/v1/marketplace/products/${id}`
          : `${API_URL}/api/v1/marketplace/services/${id}`;

        const res = await fetch(endpoint);
        const json = await res.json();
        if (json.ok) setData(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchDetail();
  }, [id, type]);

  const handleAddToCart = () => {
    if (!user) {
      navigate(`/login?redirect=/marketplace/${type}/${id}`);
      return;
    }

    if (!data) return;

    const variant = selectedVariant
      ? data.product_variants?.find((v: any) => v.id === selectedVariant)
      : null;

    addItem({
      id: `marketplace-${type}-${data.id}${variant ? `-${variant.id}` : ''}`,
      type: type === 'product' ? 'product' : 'service',
      name: variant ? `${data.name} - ${variant.name}` : data.name,
      description: data.description || '',
      price: variant?.price_override ?? data.price,
      image: data.image_url || undefined,
      metadata: {
        productId: type === 'product' ? data.id : undefined,
        vendorName: data.vendor_profiles?.display_name,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No encontrado</h2>
          <Button variant="outline" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al marketplace
          </Button>
        </div>
      </div>
    );
  }

  const vendor = data.vendor_profiles;
  const variants = data.product_variants || [];
  const variations = data.service_variations || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/marketplace')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Marketplace
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square bg-muted rounded-xl overflow-hidden">
            {data.image_url ? (
              <img src={data.image_url} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Store className="h-20 w-20 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <Badge variant={type === 'product' ? 'default' : 'secondary'} className="mb-2">
                {type === 'product' ? 'Producto' : 'Servicio'}
              </Badge>
              <h1 className="text-2xl font-bold">{data.name}</h1>
            </div>

            <p className="text-3xl font-bold text-primary">
              ${data.price.toLocaleString('es-CO')} COP
            </p>

            {data.description && (
              <p className="text-muted-foreground">{data.description}</p>
            )}

            {type === 'service' && data.duration_minutes && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Duracion: {data.duration_minutes} minutos</span>
              </div>
            )}

            {type === 'product' && (
              <p className="text-sm text-muted-foreground">
                Stock disponible: {data.stock} unidades
              </p>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Variantes</h3>
                <div className="flex flex-wrap gap-2">
                  {variants.filter((v: any) => v.is_active).map((v: any) => (
                    <Button
                      key={v.id}
                      variant={selectedVariant === v.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedVariant(v.id === selectedVariant ? null : v.id)}
                      disabled={v.stock <= 0}
                    >
                      {v.name} {v.price_override ? `- $${v.price_override.toLocaleString('es-CO')}` : ''}
                      {v.stock <= 0 && ' (Agotado)'}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Service variations */}
            {variations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Opciones de servicio</h3>
                <div className="grid gap-2">
                  {variations.filter((v: any) => v.is_active).map((v: any) => (
                    <Card key={v.id} className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.duration_minutes} min</p>
                        </div>
                        <span className="font-semibold">${v.price.toLocaleString('es-CO')}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={handleAddToCart}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                {type === 'product' ? 'Agregar al carrito' : 'Reservar servicio'}
              </Button>
              <ShareButton
                title={data.name}
                description={data.description}
                price={data.price}
                vendorName={vendor?.display_name}
                image={data.image_url}
                itemId={id}
                itemType={type as 'product' | 'service'}
                size="lg"
              />
            </div>

            {/* Vendor info */}
            {vendor && (
              <>
                <Separator />
                <Card
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => vendor.slug && navigate(`/vendor/${vendor.slug}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {vendor.logo_url ? (
                      <img src={vendor.logo_url} alt={vendor.display_name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{vendor.display_name}</p>
                        {vendor.verification_status === 'verified' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      {vendor.city && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {vendor.city}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm">Ver perfil</Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
