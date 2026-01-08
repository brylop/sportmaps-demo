import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PaymentModal } from '@/components/payment/PaymentModal';
import {
  ShoppingCart,
  Search,
  Star,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  stock: number;
  discount: number | null;
  rating: number | null;
  reviews_count: number | null;
}

interface CartItem extends Product {
  quantity: number;
}

export default function ShopPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ['shop-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // If no products, return demo products
      if (!data || data.length === 0) {
        return getDemoProducts();
      }
      return data;
    },
  });

  const getDemoProducts = (): Product[] => [
    {
      id: 'demo-1',
      name: 'Balón de Fútbol Pro',
      description: 'Balón oficial de competición, tamaño 5',
      price: 89000,
      category: 'Equipamiento',
      image_url: 'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=300',
      stock: 15,
      discount: 10,
      rating: 4.8,
      reviews_count: 124,
    },
    {
      id: 'demo-2',
      name: 'Camiseta Deportiva',
      description: 'Camiseta de alto rendimiento, material transpirable',
      price: 65000,
      category: 'Ropa',
      image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300',
      stock: 8,
      discount: null,
      rating: 4.5,
      reviews_count: 89,
    },
    {
      id: 'demo-3',
      name: 'Guantes de Arquero',
      description: 'Guantes profesionales con grip premium',
      price: 120000,
      category: 'Equipamiento',
      image_url: 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=300',
      stock: 5,
      discount: 15,
      rating: 4.9,
      reviews_count: 56,
    },
    {
      id: 'demo-4',
      name: 'Raqueta de Tenis',
      description: 'Raqueta profesional de grafito',
      price: 350000,
      category: 'Equipamiento',
      image_url: 'https://images.unsplash.com/photo-1617083934551-cc8a01bb4e2e?w=300',
      stock: 3,
      discount: null,
      rating: 4.7,
      reviews_count: 42,
    },
    {
      id: 'demo-5',
      name: 'Botella Deportiva 1L',
      description: 'Botella térmica de acero inoxidable',
      price: 45000,
      category: 'Accesorios',
      image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300',
      stock: 25,
      discount: null,
      rating: 4.6,
      reviews_count: 178,
    },
    {
      id: 'demo-6',
      name: 'Zapatillas Running',
      description: 'Zapatillas con amortiguación premium',
      price: 280000,
      category: 'Calzado',
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300',
      stock: 10,
      discount: 20,
      rating: 4.8,
      reviews_count: 234,
    },
  ];

  const categories = Array.from(new Set(products?.map((p) => p.category) || []));

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({
            title: 'Stock limitado',
            description: 'No hay más unidades disponibles',
            variant: 'destructive',
          });
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast({
      title: '¡Agregado al carrito!',
      description: product.name,
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            if (newQuantity > item.stock) return item;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const cartTotal = cart.reduce((total, item) => {
    const price = item.discount
      ? item.price * (1 - item.discount / 100)
      : item.price;
    return total + price * item.quantity;
  }, 0);

  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrito vacío',
        description: 'Agrega productos antes de continuar',
        variant: 'destructive',
      });
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setCart([]);
    setShowCart(false);
    toast({
      title: '¡Compra exitosa!',
      description: 'Tu pedido ha sido procesado correctamente',
    });
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando tienda..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Tienda SportMaps</h1>
          <p className="text-muted-foreground mt-1">
            Encuentra el mejor equipamiento deportivo
          </p>
        </div>
        <Button
          variant="outline"
          className="relative"
          onClick={() => setShowCart(!showCart)}
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          Carrito
          {cartItemCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Products Grid */}
        <div className={`${showCart ? 'md:col-span-1 lg:col-span-2' : 'md:col-span-2 lg:col-span-3'} grid gap-4 md:grid-cols-2 lg:grid-cols-3`}>
          {filteredProducts?.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {product.image_url && (
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  {product.discount && (
                    <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                      -{product.discount}%
                    </Badge>
                  )}
                  {product.stock <= 5 && (
                    <Badge variant="destructive" className="absolute top-2 left-2">
                      ¡Últimas unidades!
                    </Badge>
                  )}
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                </div>

                {product.rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{product.rating}</span>
                    <span className="text-muted-foreground">
                      ({product.reviews_count} reseñas)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div>
                    {product.discount ? (
                      <>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(product.price * (1 - product.discount / 100))}
                        </span>
                        <span className="text-sm text-muted-foreground line-through ml-2">
                          {formatCurrency(product.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </div>
                  <Button size="sm" onClick={() => addToCart(product)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!filteredProducts || filteredProducts.length === 0) && (
            <div className="col-span-full text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No se encontraron productos</p>
            </div>
          )}
        </div>

        {/* Cart Sidebar */}
        {showCart && (
          <Card className="h-fit sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-poppins">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Tu Carrito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Tu carrito está vacío</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                          <p className="text-sm text-primary font-semibold">
                            {formatCurrency(
                              (item.discount
                                ? item.price * (1 - item.discount / 100)
                                : item.price) * item.quantity
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(cartTotal)}</span>
                    </div>
                    <Button
                      className="w-full font-poppins"
                      size="lg"
                      onClick={handleCheckout}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Pagar Ahora
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        onOpenChange={setShowPayment}
        item={{
          type: 'product',
          id: 'cart',
          name: `Carrito (${cartItemCount} productos)`,
          description: cart.map((i) => i.name).join(', '),
          amount: cartTotal,
        }}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
