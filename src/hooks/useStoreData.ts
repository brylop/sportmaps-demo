import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

type Product = Tables<'products'>;
type ProductInsert = TablesInsert<'products'>;

export function useStoreProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['store-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const createProduct = useMutation({
    mutationFn: async (product: Omit<ProductInsert, 'vendor_id'>) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, vendor_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
      toast({ title: 'Producto creado', description: 'El producto se ha añadido correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
      toast({ title: 'Producto actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    products: productsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}

export function useStoreOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get orders where user is the vendor (products.vendor_id)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useStoreStats() {
  const { products } = useStoreProducts();
  const ordersQuery = useStoreOrders();
  
  const totalProducts = products.length;
  const lowStock = products.filter(p => p.stock < 20).length;
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  
  return {
    totalProducts,
    lowStock,
    totalStock,
    pendingOrders: ordersQuery.data?.filter(o => o.status === 'pending').length ?? 0,
    isLoading: ordersQuery.isLoading,
  };
}
