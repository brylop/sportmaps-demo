import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

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
      )
    );
  };

  const clearCart = () => {
    setItems([]);
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
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
