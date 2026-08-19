import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type CartItemType = 'enrollment' | 'product' | 'appointment' | 'service';

export interface CartItem {
  id: string;
  type: CartItemType;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image?: string;
  // Campos de producto que CartPage y ProductDetailPage ya usaban sin que
  // existieran aca: `discount` para el precio tachado, `stock` para topear el
  // boton de +, `category` para el subtitulo. Opcionales porque un item de
  // inscripcion o de cita no los tiene.
  category?: string;
  stock?: number;
  discount?: number;
  metadata: {
    schoolId?: string;
    schoolName?: string;
    teamId?: string;
    productId?: string;
    vendorId?: string;
    vendorName?: string;
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
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemsByType: (type: CartItemType) => CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'sportmaps_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Clear cart when user logs out
  useEffect(() => {
    if (!user) {
      setItems([]);
    }
  }, [user]);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === newItem.id);

      if (existingIndex >= 0) {
        // Only increase quantity for products
        if (newItem.type === 'product') {
          const updated = [...current];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        }
        // For enrollments and appointments, don't add duplicates
        toast({
          title: 'Ya en el carrito',
          description: `${newItem.name} ya está en tu carrito`,
          variant: 'default',
        });
        return current;
      }

      toast({
        title: 'Agregado al carrito',
        description: newItem.name,
      });

      return [...current, { ...newItem, quantity }];
    });
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const item = current.find((i) => i.id === id);
      if (item) {
        toast({
          title: 'Eliminado del carrito',
          description: item.name,
        });
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    toast({
      title: 'Carrito vacío',
      description: 'Se han eliminado todos los productos',
    });
  };

  const getTotal = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  const getItemsByType = (type: CartItemType) => {
    return items.filter((item) => item.type === type);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
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
