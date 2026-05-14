import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VendorProfileSummary {
    id: string;
    user_id: string;
    vendor_type: 'store' | 'wellness' | 'school' | 'personal_trainer' | 'coach';
    display_name: string | null;
    slug: string | null;
    is_active: boolean;
    verification_status: 'pending' | 'verified' | 'rejected';
    capabilities: {
        can_sell_products?: boolean;
        can_sell_services?: boolean;
    };
}

/**
 * useVendorProfile — fuente unica de verdad para saber si el usuario
 * tiene Mi Tienda activa y qué capacidades tiene.
 *
 * Devuelve:
 *  - data: vendor_profile completo o null si no existe
 *  - hasVendorProfile: boolean (existe Y is_active = true)
 *  - canSellProducts / canSellServices: convenience flags
 *  - isLoading, error
 */
export function useVendorProfile() {
    const { user } = useAuth();

    const query = useQuery({
        queryKey: ['vendor-profile', user?.id],
        enabled: !!user?.id,
        staleTime: 60_000,
        queryFn: async (): Promise<VendorProfileSummary | null> => {
            const { data, error } = await supabase
                .from('vendor_profiles')
                .select('id, user_id, vendor_type, display_name, slug, is_active, verification_status, capabilities')
                .eq('user_id', user!.id)
                .maybeSingle();

            if (error) {
                console.error('Error loading vendor profile:', error);
                throw error;
            }
            return (data as VendorProfileSummary | null) ?? null;
        },
    });

    const data = query.data ?? null;
    const hasVendorProfile = !!data && data.is_active;
    const caps = data?.capabilities ?? {};

    return {
        data,
        hasVendorProfile,
        canSellProducts: hasVendorProfile && caps.can_sell_products === true,
        canSellServices: hasVendorProfile && caps.can_sell_services === true,
        isInactive: !!data && !data.is_active,
        verificationStatus: data?.verification_status ?? null,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
