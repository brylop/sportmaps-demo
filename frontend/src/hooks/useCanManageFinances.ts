import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * ¿El usuario ADMINISTRA las finanzas de la escuela? (Contabilidad v2 F0, §4 F8)
 *
 * Se le pregunta a la base (`can_manage_finances`), que es exactamente lo que
 * exigen las policies de escritura y las RPC de gasto, proveedor y nómina. Así
 * el contador (solo lectura) no ve botones que la base le va a rechazar.
 * Mientras carga o si falla, devuelve false: un botón escondido de más es
 * mejor que uno que termina en 403.
 */
export function useCanManageFinances(schoolId: string | null | undefined): boolean {
    const q = useQuery({
        queryKey: ['finance-can-manage', schoolId],
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc('can_manage_finances', {
                p_owner_type: 'school',
                p_owner_id: schoolId,
            });
            if (error) return false;
            return data === true;
        },
    });
    return q.data === true;
}
