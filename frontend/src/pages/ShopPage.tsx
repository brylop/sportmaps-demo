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

      return data || [];
    },
  });

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
    return total + item.price * item.quantity;
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
                  {product.stock <= 5 && product.stock > 0 && (
                    <Badge variant="outline" className="absolute top-2 left-2">
                      ¡Últimas unidades!
                    </Badge>
                  )}
                </div>
              )}
              <CardHeader className="p-4 pb-0">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="secondary" className="mb-2">
                    {product.category}
                  </Badge>
                </div>
                <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-primary">
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(product.price)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                  >
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
                            {formatCurrency(item.price * item.quantity)}
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
