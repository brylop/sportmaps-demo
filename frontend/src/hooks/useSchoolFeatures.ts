import { useQuery } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from '@/hooks/useSchoolContext';

export interface SchoolFeatures {
    selfBooking: boolean;
    capacityCheck: boolean;
    offeringPlans: boolean;
    creditDeduction: boolean;
    courtBooking: boolean;
    tournamentMode: boolean;
    billingEvents: boolean;
    sportConfigs: boolean;
}

interface SchoolFeaturesData {
    activeModules: string[];
    features: SchoolFeatures;
    isUniversalMode: boolean;
    isLoading: boolean;
    error: Error | null;
}

const DEFAULT_FEATURES: SchoolFeatures = {
    selfBooking: false,
    capacityCheck: false,
    offeringPlans: false,
    creditDeduction: false,
    courtBooking: false,
    tournamentMode: false,
    billingEvents: false,
    sportConfigs: false,
};

/**
 * Hook que consume GET /api/v1/school/context y retorna las features activas.
 * Permite renderizado condicional sin hardcodear lógica de deporte.
 *
 * isUniversalMode = true si la escuela tiene al menos un módulo activado.
 * Una escuela de porras con active_modules = '{}' retorna todo en false.
 */
export function useSchoolFeatures(): SchoolFeaturesData {
    const { schoolId } = useSchoolContext();

    const { data, isLoading, error } = useQuery({
        queryKey: ['school-context', schoolId],
        queryFn: () => bffClient.get<{
            active_modules: string[];
            features: SchoolFeatures;
            is_universal_mode: boolean;
        }>('/api/v1/school/context'),
        enabled: !!schoolId,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });

    return {
        activeModules: data?.active_modules ?? [],
        features: data?.features ?? DEFAULT_FEATURES,
        isUniversalMode: data?.is_universal_mode ?? false,
        isLoading,
        error: error as Error | null,
    };
}
