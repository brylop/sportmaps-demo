import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import {
  addLine,
  cartStorageKey,
  LEGACY_CART_STORAGE_KEY,
  mergeCarts,
  parseStoredCart,
  setLineQuantity,
  MAX_QTY_PER_LINE,
} from '@/lib/store/cart';

export type CartItemType = 'enrollment' | 'product' | 'appointment' | 'service';

export interface CartItem {
  id: string;
  type: CartItemType;
  name: string;
  description: string;
  /**
   * Precio para PINTAR (el último que dijo el servidor). Nunca viaja al
   * checkout: el total lo pone create_cart_order (tienda v2, regla de oro).
   */
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  /** Disponible según la última cotización/catálogo. Topa el botón de +. */
  stock?: number;
  discount?: number;
  metadata: {
    schoolId?: string;
    schoolName?: string;
    teamId?: string;
    productId?: string;
    vendorId?: string;
    vendorName?: string;
    vendorSlug?: string;
    professionalId?: string;
    professionalName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    serviceType?: string;
    childId?: string;
    childName?: string;
    vendorProfileId?: string;
    variantId?: string;
    variantName?: string;
  };
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (id: string) => void;
  /** Quita varias líneas sin avisar (después de pagar una tienda). */
  removeItems: (ids: string[]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  /** Reemplaza las líneas con lo que dijo el servidor (precio, disponible). */
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemsByType: (type: CartItemType) => CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function readCart(key: string): CartItem[] {
  try {
    return parseStoredCart(localStorage.getItem(key)) as CartItem[];
  } catch {
    return [];
  }
}

function writeCart(key: string, items: CartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // modo privado / cuota llena: el carrito sigue en memoria
  }
}

/**
 * Carrito persistente (tienda v2 §2.4).
 *  - Se guarda por usuario (`sportmaps_cart:u:<id>`) o invitado
 *    (`sportmaps_cart:guest`): ya no se borra al recargar ni al cerrar sesión,
 *    y un usuario no ve el carrito de otro en el mismo dispositivo.
 *  - Al iniciar sesión, lo del invitado se suma al carrito del usuario.
 *  - Solo guarda qué y cuánto; el precio lo revalida `quote_cart`.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = cartStorageKey(userId);
  // Las líneas viajan con la clave a la que pertenecen: al cambiar de usuario
  // nunca se escriben las del anterior en la clave del nuevo.
  const [cart, setCart] = useState<{ key: string; items: CartItem[] }>(() => ({
    key: storageKey,
    items: readCart(storageKey),
  }));
  const items = cart.items;
  const setItems = useCallback((updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setCart((c) => ({ key: c.key, items: typeof updater === 'function' ? updater(c.items) : updater }));
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  // Tienda apagada (spec blindaje-dinero §1.3): el carrito no admite nada.
  // Fail-closed: mientras el flag carga, tampoco.
  const { enabled: storeEnabled } = useStoreEnabled();

  // Cambio de usuario (login / logout / otra cuenta): cargar SU carrito.
  useEffect(() => {
    let next = readCart(storageKey);
    if (userId) {
      const guestKey = cartStorageKey(null);
      const guest = readCart(guestKey);
      // Clave vieja compartida (antes de v2): se adopta una vez y se borra.
      const legacy = readCart(LEGACY_CART_STORAGE_KEY);
      if (guest.length || legacy.length) {
        next = mergeCarts(mergeCarts(next, legacy), guest) as CartItem[];
        try {
          localStorage.removeItem(guestKey);
          localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
        } catch { /* nada */ }
      }
    }
    setCart({ key: storageKey, items: next });
  }, [storageKey, userId]);

  // Guardar en la clave dueña de estas líneas.
  useEffect(() => {
    writeCart(cart.key, cart.items);
  }, [cart]);

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    if (!storeEnabled) {
      toast({
        title: 'La tienda no está disponible',
        description: 'Por ahora no se pueden agregar productos al carrito.',
      });
      return;
    }
    setItems((current) => {
      const existing = current.find((i) => i.id === newItem.id);
      if (existing && newItem.type !== 'product') {
        toast({ title: 'Ya en el carrito', description: `${newItem.name} ya está en tu carrito` });
        return current;
      }
      const res = addLine(current, newItem, quantity);
      if (res.added <= 0) {
        toast({
          title: newItem.stock === 0 ? 'Agotado' : 'No hay más unidades',
          description: newItem.stock === 0
            ? `${newItem.name} no tiene unidades disponibles.`
            : `Ya tienes en el carrito todo lo disponible de ${newItem.name}.`,
        });
        return current;
      }
      toast({
        title: res.clamped ? 'Agregamos lo disponible' : 'Agregado al carrito',
        description: res.clamped
          ? `${newItem.name}: puedes llevar hasta ${Math.min(newItem.stock ?? MAX_QTY_PER_LINE, MAX_QTY_PER_LINE)} unidades.`
          : newItem.name,
      });
      return res.items;
    });
  }, [storeEnabled, toast, setItems]);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const item = current.find((i) => i.id === id);
      if (item) toast({ title: 'Eliminado del carrito', description: item.name });
      return current.filter((i) => i.id !== id);
    });
  }, [toast, setItems]);

  const removeItems = useCallback((ids: string[]) => {
    setItems((current) => current.filter((i) => !ids.includes(i.id)));
  }, [setItems]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((current) => setLineQuantity(current, id, quantity));
  }, [setItems]);

  const replaceItems = useCallback((next: CartItem[]) => setItems(next), [setItems]);

  const clearCart = useCallback(() => {
    setItems([]);
    toast({ title: 'Carrito vacío', description: 'Se han eliminado todos los productos' });
  }, [toast, setItems]);

  const getTotal = () => items.reduce((total, item) => total + item.price * item.quantity, 0);
  const getItemCount = () => items.reduce((count, item) => count + item.quantity, 0);
  const getItemsByType = (type: CartItemType) => items.filter((item) => item.type === type);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        removeItems,
        updateQuantity,
        replaceItems,
        clearCart,
        getTotal,
        getItemCount,
        getItemsByType,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
