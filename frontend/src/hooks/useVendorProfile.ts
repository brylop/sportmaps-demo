import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolStore } from '@/hooks/useSchoolStore';

export interface VendorProfileSummary {
    id: string;
    user_id: string;
    vendor_type: 'store' | 'wellness' | 'school' | 'personal_trainer' | 'coach';
    display_name: string | null;
    slug: string | null;
    is_active: boolean;
    verification_status: 'pending' | 'verified' | 'rejected';
    verification_doc_url?: string | null;
    school_id?: string | null;
    capabilities: {
        can_sell_products?: boolean;
        can_sell_services?: boolean;
    };
}

/**
 * useVendorProfile — fuente unica de verdad para saber si el usuario
 * tiene Mi Tienda activa y qué capacidades tiene.
 *
 * Con rol de administración en la escuela activa (owner/admin/school_admin),
 * la tienda es la de la ESCUELA (useSchoolStore, por vendor_profiles.school_id),
 * no la del usuario: así un school_admin que no es dueño gestiona la tienda del
 * club (bug N0). Para los demás, el perfil propio (vendor_profiles.user_id).
 *
 * Devuelve:
 *  - data: vendor_profile completo o null si no existe
 *  - hasVendorProfile: boolean (existe Y is_active = true)
 *  - canSellProducts / canSellServices: convenience flags
 *  - isSchoolStore: la tienda que se gestiona es la de la escuela
 *  - isLoading, error
 */
export function useVendorProfile() {
    const { user } = useAuth();
    const school = useSchoolStore();

    const query = useQuery({
        queryKey: ['vendor-profile', user?.id],
        enabled: !!user?.id,
        staleTime: 60_000,
        queryFn: async (): Promise<VendorProfileSummary | null> => {
            const { data, error } = await supabase
                .from('vendor_profiles')
                .select('id, user_id, vendor_type, display_name, slug, is_active, verification_status, verification_doc_url, school_id, capabilities')
                .eq('user_id', user!.id)
                .maybeSingle();

            if (error) {
                console.error('Error loading vendor profile:', error);
                throw error;
            }
            return (data as unknown as VendorProfileSummary | null) ?? null;
        },
    });

    const own = query.data ?? null;
    // La tienda de la escuela manda para quien la administra; si la escuela no
    // tiene tienda, queda el perfil propio (p.ej. un coach con tienda personal).
    const data: VendorProfileSummary | null = school.store
        ? {
            id: school.store.id,
            user_id: school.store.user_id,
            vendor_type: 'school',
            display_name: school.store.display_name,
            slug: school.store.slug,
            is_active: school.store.is_active,
            verification_status: school.store.verification_status,
            school_id: school.store.school_id,
            capabilities: school.store.capabilities ?? {},
        }
        : own;
    const hasVendorProfile = !!data && data.is_active;
    const caps = data?.capabilities ?? {};

    return {
        data,
        hasVendorProfile,
        isSchoolStore: !!school.store,
        canSellProducts: hasVendorProfile && caps.can_sell_products === true,
        canSellServices: hasVendorProfile && caps.can_sell_services === true,
        isInactive: !!data && !data.is_active,
        verificationStatus: data?.verification_status ?? null,
        isLoading: query.isLoading || school.isLoading,
        error: query.error,
        refetch: async () => {
            await school.refetch();
            return query.refetch();
        },
    };
}
