import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * ¿La tienda (productos, carrito, órdenes) está prendida a nivel plataforma?
 *
 * Lee `public.store_enabled()` (flag global en `platform_config`, ver
 * docs/specs/blindaje-dinero-pagos-tienda-nomina.md §1.3). Se reprende con un
 * UPDATE de una fila, sin deploy: por eso se consulta y no se hornea.
 *
 * FAIL-CLOSED: cualquier error (incluida la función inexistente antes de
 * aplicar la migración) cuenta como apagada, y mientras carga también — la
 * tienda no debe asomarse ni un instante. `isLoading` existe solo para que un
 * guard de página pueda mostrar un spinner en vez del aviso de "no disponible"
 * durante la primera carga.
 */
export const STORE_ENABLED_QUERY_KEY = ['platform', 'store_enabled'] as const;

export function useStoreEnabled(): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: STORE_ENABLED_QUERY_KEY,
    queryFn: async () => {
      try {
        // La función aún no está en los tipos generados de Supabase.
        const { data, error } = await supabase.rpc('store_enabled' as never);
        if (error) return false;
        return data === true;
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { enabled: data === true, isLoading };
}
