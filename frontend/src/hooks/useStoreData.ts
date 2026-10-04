import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { isOrderPaidLike, isOrderPendingForVendor } from '@/lib/store/orderStatus';
import { PRODUCT_DELETE_NOT_ALLOWED, productDeleteErrorMessage } from '@/lib/store/storeErrors';

type Product = Tables<'products'>;

// Tienda v2 F0 (M-F0-2): `createProduct`/`updateProduct` escribían `products`
// directo con el JWT (incluido `stock`, que ya no es actualizable por
// `authenticated`). No tenían llamadores: crear/editar va por el BFF
// (`ProductWizard` → /api/v1/vendor/products) y el stock por
// PATCH /api/v1/vendor/products/:id o POST /api/v1/vendor/products/:id/inventory.
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
        .select('id, name, description, price, stock, category, image_url, status')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // El borrado directo solo procede para productos `draft`/`rejected` (M-F0-2).
  // Para el resto la policy deja 0 filas sin error: se detecta y se avisa, en
  // vez de mostrar "Producto eliminado" sobre algo que sigue publicado.
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw new Error(productDeleteErrorMessage(error));
      if (!data || data.length === 0) throw new Error(PRODUCT_DELETE_NOT_ALLOWED);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    products: productsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
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


  const orders = ordersQuery.data || [];
  // Ventas e ingresos: solo pedidos en los que el dinero entró (pagado en
  // adelante). Antes sumaba también los pendientes de pago.
  const paidOrders = orders.filter(o => isOrderPaidLike(o.status));
  const totalProducts = products.length;
  const lowStock = products.filter(p => p.stock < 20).length;
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSales = paidOrders.length;
  const totalRevenue = paidOrders.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);

  return {
    totalProducts,
    lowStock,
    totalStock,
    // Pendientes para el vendedor: pagados o en curso, sin entregar.
    pendingOrders: orders.filter(o => isOrderPendingForVendor(o.status)).length,
    totalSales,
    totalRevenue,
    isLoading: ordersQuery.isLoading,
  };
}
