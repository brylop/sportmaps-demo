import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/shop';

export function useProducts(filters?: { category?: string; minPrice?: number; maxPrice?: number }) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      // `vendor_id` faltaba en el select y Product lo exige: llegaba undefined.
      let query = supabase.from('products').select('id, name, description, price, stock, category, image_url, status, vendor_id').order('created_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters?.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Product;
    },
    enabled: !!id,
  });
}

// Tienda v2 F0 (M-F0-2): se borraron `useCreateProduct`, `useUpdateProduct` y
// `useDeleteProduct`, que escribían `products` directo con el JWT y no tenían
// llamadores. Crear/editar productos va por el BFF (/api/v1/vendor/products);
// el stock, por PATCH /api/v1/vendor/products/:id o
// POST /api/v1/vendor/products/:id/inventory.
