import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { ShoppingCart, Search, Filter, Star, ShoppingBag } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '@/types/shop';

export default function ShopPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  const { data: products, isLoading, error } = useProducts({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    ...priceRange,
  });

  const { addItem, itemCount } = useCart();

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner fullScreen text="Cargando productos..." />;
  if (error) return <ErrorState message="Error al cargar los productos" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">Tienda SportMaps</span>
            </Link>
            <Link to="/cart">
              <Button variant="outline" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Carrito
                {itemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full">
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts?.map((product) => (
            <Card key={product.id} className="group hover:shadow-xl transition-all overflow-hidden">
              <Link to={`/product/${product.id}`}>
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={product.image_url || '/placeholder.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              </Link>
              <CardContent className="p-4">
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mb-2">
                  {product.discount && (
                    <Badge variant="destructive" className="text-xs">
                      -{product.discount}%
                    </Badge>
                  )}
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
                {product.rating && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{product.rating}</span>
                    {product.reviews_count && (
                      <span>({product.reviews_count})</span>
                    )}
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  {product.discount ? (
                    <>
                      <span className="text-2xl font-bold text-primary">
                        ${(product.price * (1 - product.discount / 100)).toLocaleString('es-CO')}
                      </span>
                      <span className="text-sm text-muted-foreground line-through">
                        ${product.price.toLocaleString('es-CO')}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      ${product.price.toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  className="w-full"
                  onClick={() => addItem(product)}
                  disabled={product.stock === 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {product.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
          </div>
        )}
      </div>
    </div>
  );
}
