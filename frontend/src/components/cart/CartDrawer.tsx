import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { CartContents } from '@/components/store/CartContents';

/**
 * Carrito lateral (tienda v2 §2.4). Agrupa por tienda y cada grupo se paga en
 * el checkout de una pantalla (/checkout/tienda/:vendorProfileId). El flujo
 * viejo (CheckoutPage / CartCheckoutModal) se eliminó: precios y stock salen
 * de `quote_cart` y la orden la crea `create_cart_order`.
 */
export function CartDrawer() {
  const { items, isOpen, setIsOpen, getItemCount } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Mi carrito
            {items.length > 0 && <Badge variant="secondary">{getItemCount()}</Badge>}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-5 pb-6">
          <div className="py-3">
            <CartContents onNavigate={() => setIsOpen(false)} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
