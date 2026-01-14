import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
<<<<<<< HEAD
import { CartItem, Product } from '@/types/shop';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
=======
import { useToast } from '@/hooks/use-toast';

export type CartItemType = 'enrollment' | 'product' | 'appointment';

export interface CartItem {
  id: string;
  type: CartItemType;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image?: string;
  metadata: {
    schoolId?: string;
    schoolName?: string;
    programId?: string;
    productId?: string;
    vendorId?: string;
    vendorName?: string;
    professionalId?: string;
    professionalName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    serviceType?: string;
  };
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemsByType: (type: CartItemType) => CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
}

const CartContext = createContext<CartContextType | undefined>(undefined);

<<<<<<< HEAD
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('sportmaps_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync with Supabase on mount/login
  useEffect(() => {
    const loadCart = async () => {
      if (!user) {
        setIsInitialized(true);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('carts')
          .select('items')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data && data.items) {
          // Merge or replace? For now, let's use DB version if exists and strictly better (or just use it)
          // Simple strategy: DB overrides local if exists
          setItems(data.items as CartItem[]);
        } else {
          // If no cart in DB, maybe we should save local there?
          // If local has items, save them to DB
          if (items.length > 0) {
            await (supabase as any).from('carts').upsert({
              user_id: user.id,
              items: items
            });
          }
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadCart();
  }, [user]);

  // Sync with LocalStorage and Supabase on change
  useEffect(() => {
    // LocalStorage
    localStorage.setItem('sportmaps_cart', JSON.stringify(items));

    // Supabase (debounce could be good here, but for simplicity direct save)
    const saveToSupabase = async () => {
      if (!user || !isInitialized) return;

      try {
        const { error } = await (supabase as any)
          .from('carts')
          .upsert({
            user_id: user.id,
            items: items,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) throw error;
      } catch (error) {
        console.error('Error saving cart to Supabase:', error);
      }
    };

    const timeoutId = setTimeout(saveToSupabase, 1000); // Debounce 1s
    return () => clearTimeout(timeoutId);

  }, [items, user, isInitialized]);

  const addItem = (product: Product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        toast.success('Cantidad actualizada en el carrito');
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      }
      toast.success('Producto agregado al carrito');
      return [...current, { ...product, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
    toast.success('Producto eliminado del carrito');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item
=======
const CART_STORAGE_KEY = 'sportmaps_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

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

  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === newItem.id);
      
      if (existingIndex >= 0) {
        // Only increase quantity for products
        if (newItem.type === 'product') {
          const updated = [...current];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + 1,
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

      return [...current, { ...newItem, quantity: 1 }];
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      )
    );
  };

  const clearCart = () => {
    setItems([]);
<<<<<<< HEAD
    toast.success('Carrito vaciado');
  };

  const total = items.reduce((sum, item) => {
    const price = item.discount ? item.price * (1 - item.discount / 100) : item.price;
    return sum + price * item.quantity;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}
=======
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
<<<<<<< HEAD
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
=======
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
  }
  return context;
}
