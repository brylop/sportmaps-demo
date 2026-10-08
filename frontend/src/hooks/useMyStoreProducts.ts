import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getSalesInsights, listMyProducts } from '@/lib/store/vendorProductsApi';

/**
 * Productos de las tiendas que el usuario gestiona, desde el BFF, con el stock
 * real (suma de variantes activas) y el nivel según min_stock_alert.
 */
export function useMyStoreProducts() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const q = useQuery({
        queryKey: ['vendor-products', session?.user?.id],
        queryFn: () => listMyProducts(session?.access_token),
        enabled: !!session?.access_token,
        retry: false,
    });
    return {
        products: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error as Error | null,
        refetch: q.refetch,
        invalidate: () => {
            void queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
            void queryClient.invalidateQueries({ queryKey: ['vendor-kardex'] });
        },
    };
}

/** Ingresos, pedidos, ticket promedio y más vendidos (pedidos pagados en adelante). */
export function useStoreSalesInsights(days = 30) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-sales-insights', session?.user?.id, days],
        queryFn: () => getSalesInsights(session?.access_token, days),
        enabled: !!session?.access_token,
        retry: false,
    });
}
