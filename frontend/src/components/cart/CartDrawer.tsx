import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  School, 
  Package, 
  Calendar,
  CreditCard
} from 'lucide-react';
import { useCart, CartItemType } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const typeConfig: Record<CartItemType, { icon: typeof School; label: string; color: string }> = {
  enrollment: { icon: School, label: 'Inscripción', color: 'bg-primary/10 text-primary' },
  product: { icon: Package, label: 'Producto', color: 'bg-accent/10 text-accent' },
  appointment: { icon: Calendar, label: 'Cita', color: 'bg-green-500/10 text-green-600' },
};

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleCheckout = () => {
    setIsOpen(false);
    navigate('/checkout');
  };

  const enrollments = items.filter((i) => i.type === 'enrollment');
  const products = items.filter((i) => i.type === 'product');
  const appointments = items.filter((i) => i.type === 'appointment');

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Mi Carrito
            {items.length > 0 && (
              <Badge variant="secondary">{items.length} items</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Tu carrito está vacío</h3>
            <p className="text-muted-foreground mb-6">
              Explora escuelas, productos y servicios para agregar al carrito
            </p>
            <Button onClick={() => {
              setIsOpen(false);
              navigate('/explore');
            }}>
              Explorar ahora
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-4">
                {/* Enrollments Section */}
                {enrollments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <School className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Inscripciones</span>
                      <Badge variant="outline" className="ml-auto">{enrollments.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {enrollments.map((item) => (
                        <CartItemCard key={item.id} item={item} onRemove={removeItem} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Products Section */}
                {products.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-accent" />
                      <span className="font-medium text-sm">Productos</span>
                      <Badge variant="outline" className="ml-auto">{products.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {products.map((item) => (
                        <CartItemCard 
                          key={item.id} 
                          item={item} 
                          onRemove={removeItem}
                          onUpdateQuantity={updateQuantity}
                          showQuantity
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointments Section */}
                {appointments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm">Citas Médicas</span>
                      <Badge variant="outline" className="ml-auto">{appointments.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {appointments.map((item) => (
                        <CartItemCard key={item.id} item={item} onRemove={removeItem} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 space-y-4 border-t">
              {/* Summary */}
              <div className="space-y-2">
                {enrollments.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Inscripciones ({enrollments.length})</span>
                    <span>{formatPrice(enrollments.reduce((t, i) => t + i.price, 0))}</span>
                  </div>
                )}
                {products.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Productos ({products.reduce((c, i) => c + i.quantity, 0)})</span>
                    <span>{formatPrice(products.reduce((t, i) => t + i.price * i.quantity, 0))}</span>
                  </div>
                )}
                {appointments.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Citas ({appointments.length})</span>
                    <span>{formatPrice(appointments.reduce((t, i) => t + i.price, 0))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(getTotal())}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vaciar
                </Button>
                <Button className="flex-1" onClick={handleCheckout}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface CartItemCardProps {
  item: ReturnType<typeof useCart>['items'][0];
  onRemove: (id: string) => void;
  onUpdateQuantity?: (id: string, quantity: number) => void;
  showQuantity?: boolean;
}

function CartItemCard({ item, onRemove, onUpdateQuantity, showQuantity }: CartItemCardProps) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/50 group">
      {/* Image/Icon */}
      <div className={cn("h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0", config.color)}>
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <Icon className="h-6 w-6" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            {item.metadata.appointmentDate && (
              <p className="text-xs text-primary mt-1">
                📅 {item.metadata.appointmentDate} • {item.metadata.appointmentTime}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Quantity controls for products */}
          {showQuantity && onUpdateQuantity && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}

          <span className="font-bold text-sm text-primary ml-auto">
            {formatPrice(item.price * item.quantity)}
          </span>
        </div>
      </div>
    </div>
  );
}
