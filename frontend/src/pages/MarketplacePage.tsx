import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace, MarketplaceItem } from '@/hooks/useMarketplace';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ShoppingCart, Clock, MapPin, ChevronLeft, ChevronRight, Store, Heart, Filter, Star } from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'Fisioterapia', label: 'Fisioterapia' },
  { value: 'Nutricion', label: 'Nutricion' },
  { value: 'Psicologia', label: 'Psicologia' },
  { value: 'Medicina_Deportiva', label: 'Medicina Deportiva' },
  { value: 'Entrenamiento', label: 'Entrenamiento' },
];

function MarketplaceItemCard({ item, onAddToCart }: { item: MarketplaceItem; onAddToCart: (item: MarketplaceItem) => void }) {
  const navigate = useNavigate();

  return (
    <Card
      className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50"
      onClick={() => navigate(`/marketplace/${item.type}/${item.id}`)}
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Store className="h-12 w-12" />
          </div>
        )}
        <Badge className="absolute top-2 left-2" variant={item.type === 'product' ? 'default' : 'secondary'}>
          {item.type === 'product' ? 'Producto' : 'Servicio'}
        </Badge>
        {item.vendor_verified && (
          <Badge className="absolute top-2 right-2 bg-green-600 text-white" variant="default">
            Verificado
          </Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.name}</h3>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Store className="h-3 w-3" />
          <span className="truncate">{item.vendor_name}</span>
          {item.vendor_city && (
            <>
              <MapPin className="h-3 w-3 ml-1" />
              <span>{item.vendor_city}</span>
            </>
          )}
        </div>

        {item.type === 'service' && item.duration_minutes && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{item.duration_minutes} min</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-lg font-bold text-primary">
            ${item.price.toLocaleString('es-CO')}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(item);
            }}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading, filters, updateFilters, nextPage, prevPage } = useMarketplace();

  const handleSearch = () => {
    updateFilters({ q: searchInput || undefined });
  };

  const handleAddToCart = (item: MarketplaceItem) => {
    if (!user) {
      navigate('/login?redirect=/marketplace');
      return;
    }

    addItem({
      id: `marketplace-${item.type}-${item.id}`,
      type: item.type === 'product' ? 'product' : 'service',
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image_url || undefined,
      metadata: {
        productId: item.type === 'product' ? item.id : undefined,
        vendorName: item.vendor_name,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Marketplace SportMaps</h1>
          <p className="text-muted-foreground mb-6">Productos deportivos, servicios de salud y bienestar en un solo lugar</p>

          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos o servicios..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>
        </div>
      </div>

      {/* Filters + Content */}
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Tabs */}
          <Tabs
            value={filters.type || 'all'}
            onValueChange={(v) => updateFilters({ type: v as any })}
          >
            <TabsList>
              <TabsTrigger value="all">Todo</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="services">Servicios</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.order_by || 'newest'}
              onValueChange={(v) => updateFilters({ order_by: v as any })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mas recientes</SelectItem>
                <SelectItem value="price_asc">Precio: menor</SelectItem>
                <SelectItem value="price_desc">Precio: mayor</SelectItem>
                <SelectItem value="name">Nombre A-Z</SelectItem>
              </SelectContent>
            </Select>

            {(filters.type === 'services' || filters.type === 'all') && (
              <Select
                value={filters.service_type || '__all__'}
                onValueChange={(v) => updateFilters({ service_type: v === '__all__' ? undefined : v })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los tipos</SelectItem>
                  {SERVICE_TYPES.map(st => (
                    <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filters.q && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); updateFilters({ q: undefined }); }}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.items && data.items.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {data.total} resultado{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.items.map((item: MarketplaceItem) => (
                <MarketplaceItemCard key={`${item.type}-${item.id}`} item={item} onAddToCart={handleAddToCart} />
              ))}
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button variant="outline" size="sm" onClick={prevPage} disabled={data.page <= 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Pagina {data.page} de {data.pages}
                </span>
                <Button variant="outline" size="sm" onClick={nextPage} disabled={data.page >= data.pages}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Store className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron resultados</h3>
            <p className="text-muted-foreground">Intenta con otros filtros o terminos de busqueda</p>
          </div>
        )}
      </div>
    </div>
  );
}
