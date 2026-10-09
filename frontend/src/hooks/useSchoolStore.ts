import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';

/**
 * useSchoolStore — la tienda de la ESCUELA ACTIVA, para quien la administra.
 *
 * Bug N0 (docs/specs/tienda-cambio-gestion-a-tienda.md §1.2): la tienda escolar
 * se buscaba por `vendor_profiles.user_id`, que es el DUEÑO. Un `school_admin`
 * que no es dueño no la encontraba y caía en bucle a /vendor/onboarding (el alta
 * de vendedor externo). Aquí se resuelve por `vendor_profiles.school_id` con la
 * RPC `my_school_store` (migración 20261008163336), que solo responde a quien
 * administra la tienda (can_manage_store: owner/admin, no coach) y ve también un
 * perfil `pending` que la RLS de vendor_profiles le ocultaría.
 */

/** Roles de escuela que administran la tienda (la base vuelve a decidir). */
export const SCHOOL_STORE_ADMIN_ROLES = new Set(['owner', 'admin', 'school_admin', 'school', 'super_admin']);

export interface SchoolStoreSummary {
    id: string;
    user_id: string;
    school_id: string;
    vendor_type: 'school';
    display_name: string | null;
    slug: string | null;
    is_active: boolean;
    verification_status: 'pending' | 'verified' | 'rejected';
    capabilities: { can_sell_products?: boolean; can_sell_services?: boolean };
    /** store_seller_allowed: la tienda vende hoy (flag + allowlist + adicional + escuela operativa). */
    selling: boolean;
}

export function schoolStoreQueryKey(schoolId: string | null | undefined, userId: string | null | undefined) {
    return ['school-store', schoolId ?? null, userId ?? null] as const;
}

export function useSchoolStore() {
    const { user } = useAuth();
    const { schoolId, currentUserRole } = useSchoolContext();
    const isSchoolAdmin = !!currentUserRole && SCHOOL_STORE_ADMIN_ROLES.has(currentUserRole);

    const query = useQuery({
        queryKey: schoolStoreQueryKey(schoolId, user?.id),
        enabled: !!user?.id && !!schoolId && isSchoolAdmin,
        staleTime: 60_000,
        queryFn: async (): Promise<SchoolStoreSummary | null> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)('my_school_store', { p_school_id: schoolId });
            if (error) {
                // Migración sin aplicar (42883/PGRST202): sin tienda por escuela, no rompe.
                console.warn('[useSchoolStore] my_school_store falló', error.message);
                return null;
            }
            return (data as SchoolStoreSummary | null) ?? null;
        },
    });

    const store = query.data ?? null;
    return {
        store,
        isSchoolAdmin,
        /**
         * Activada = lo que deja enable_school_store: activa, verificada y con
         * permiso de vender productos. Un perfil escolar 'pending' creado por el
         * onboarding de vendedor (caso GYM RM) todavía NO cuenta como activado.
         */
        isOpen: !!store && store.is_active && store.verification_status === 'verified'
            && store.capabilities?.can_sell_products === true,
        isLoading: isSchoolAdmin && !!schoolId && query.isLoading,
        refetch: query.refetch,
    };
}
