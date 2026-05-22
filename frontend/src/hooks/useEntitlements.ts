import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import {
    ACADEMY_TIERS,
    ADDONS,
    FEATURES,
    tierMeetsMinimum,
    type AddonKey,
    type FeatureKey,
    type SubscriptionStatus,
    type TierCode,
} from '@/config/saas-plans';

// ============================================================
// Tipos del payload del BFF
// ============================================================

interface EntitlementsResponse {
    school_id: string;
    school_type: 'academy' | 'venue' | 'hybrid';
    plan_code: TierCode;
    tier: 'free' | 'pro' | 'enterprise';
    subscription_status: SubscriptionStatus;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    billing_cycle: 'monthly' | 'annual' | null;
    has_academy: boolean;
    has_reservations: boolean;
    has_wallet: boolean;
    has_tournaments: boolean;
    has_access_control: boolean;
    has_biomech: boolean;
    has_nutrition: boolean;
    has_whitelabel: boolean;
    has_whatsapp: boolean;
    has_wompi: boolean;
    has_mp: boolean;
}

// ============================================================
// Estado derivado expuesto a la app
// ============================================================

export interface Entitlements {
    schoolId: string | null;
    schoolType: 'academy' | 'venue' | 'hybrid';
    plan: {
        code: TierCode;
        tier: 'free' | 'pro' | 'enterprise';
        status: SubscriptionStatus;
        trialEndsAt: Date | null;
        currentPeriodEnd: Date | null;
        billingCycle: 'monthly' | 'annual' | null;
    };
    addons: Record<AddonKey, boolean>;
    /** Derivados convenientes para mensajería de upsell. */
    daysLeftInTrial: number | null;
    isTrialActive: boolean;
    isTrialExpired: boolean;
    inGracePeriod: boolean;
    isGrandfathered: boolean;
}

export interface EntitlementsHelpers {
    /**
     * Verifica si una feature está disponible para el plan/addons actuales.
     * - kind='tier'           → tier actual ≥ minTier
     * - kind='tierWithLimit'  → tier actual ≥ minTier (sin chequear cantidad — usar withinLimit)
     * - kind='addon'          → addon activo
     */
    hasFeature: (feature: FeatureKey) => boolean;
    /**
     * Verifica si el uso actual está dentro del límite numérico del plan.
     * Devuelve true para features sin límite (kind!='tierWithLimit') o limit=-1.
     */
    withinLimit: (feature: FeatureKey, currentUsage: number) => boolean;
    /** Devuelve el límite del plan para una feature numérica. null si no aplica. */
    getLimit: (feature: FeatureKey) => number | null;
    /** True si el addon está activo. */
    hasAddon: (key: AddonKey) => boolean;
}

const EMPTY_ENTITLEMENTS: Entitlements = {
    schoolId: null,
    schoolType: 'academy',
    plan: {
        code: 'starter',
        tier: 'free',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: null,
        billingCycle: null,
    },
    addons: {
        tournaments: false,
        access_control: false,
        biomech: false,
        nutrition: false,
        whitelabel: false,
        whatsapp: false,
        wompi: false,
        mp: false,
    },
    daysLeftInTrial: null,
    isTrialActive: false,
    isTrialExpired: false,
    inGracePeriod: false,
    isGrandfathered: false,
};

// ============================================================
// Hook
// ============================================================

export function useEntitlements(): Entitlements & EntitlementsHelpers & {
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
} {
    const { schoolId } = useSchoolContext();

    const query = useQuery({
        queryKey: ['entitlements', schoolId],
        queryFn: async () => {
            return bffClient.get<EntitlementsResponse>('/api/v1/me/entitlements');
        },
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000,
    });

    const entitlements = useMemo<Entitlements>(() => {
        if (!query.data) return EMPTY_ENTITLEMENTS;

        const data = query.data;
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const currentPeriodEnd = data.current_period_end
            ? new Date(data.current_period_end)
            : null;

        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;

        const isTrialActive =
            data.subscription_status === 'trialing' &&
            trialEndsAt !== null &&
            trialEndsAt > now;

        // Detectamos trial expirado de dos formas:
        //   1. status='trial_expired' (cron job ya lo marcó)
        //   2. status='trialing' pero trial_ends_at quedó en el pasado
        const isTrialExpired =
            data.subscription_status === 'trial_expired' ||
            (data.subscription_status === 'trialing' &&
                trialEndsAt !== null &&
                trialEndsAt <= now);

        const daysLeftInTrial =
            isTrialActive && trialEndsAt
                ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / msPerDay))
                : null;

        return {
            schoolId: data.school_id,
            schoolType: data.school_type,
            plan: {
                code: data.plan_code,
                tier: data.tier,
                status: data.subscription_status,
                trialEndsAt,
                currentPeriodEnd,
                billingCycle: data.billing_cycle,
            },
            addons: {
                tournaments: data.has_tournaments,
                access_control: data.has_access_control,
                biomech: import.meta.env.VITE_APP_ENV === 'staging' ? false : data.has_biomech,
                nutrition: data.has_nutrition,
                whitelabel: data.has_whitelabel,
                whatsapp: data.has_whatsapp,
                wompi: data.has_wompi,
                mp: data.has_mp,
            },
            daysLeftInTrial,
            isTrialActive,
            isTrialExpired,
            inGracePeriod: data.subscription_status === 'past_due',
            isGrandfathered: data.subscription_status === 'grandfathered',
        };
    }, [query.data]);

    const helpers = useMemo<EntitlementsHelpers>(() => {
        const currentTier = entitlements.plan.code;

        return {
            hasFeature: (feature: FeatureKey): boolean => {
                const def = FEATURES[feature];
                if (!def) return false;

                if (def.kind === 'addon') {
                    return entitlements.addons[def.addonKey] === true;
                }
                // tier o tierWithLimit
                return tierMeetsMinimum(currentTier, def.minTier);
            },

            withinLimit: (feature: FeatureKey, currentUsage: number): boolean => {
                const def = FEATURES[feature];
                if (!def || def.kind !== 'tierWithLimit') return true;
                const limit = def.limits[currentTier];
                if (limit === undefined) return false;
                if (limit === -1) return true;
                return currentUsage < limit;
            },

            getLimit: (feature: FeatureKey): number | null => {
                const def = FEATURES[feature];
                if (!def || def.kind !== 'tierWithLimit') return null;
                const limit = def.limits[currentTier];
                return limit ?? null;
            },

            hasAddon: (key: AddonKey): boolean => entitlements.addons[key] === true,
        };
    }, [entitlements]);

    return {
        ...entitlements,
        ...helpers,
        isLoading: query.isLoading,
        error: query.error as Error | null,
        refetch: query.refetch,
    };
}

// Re-export del config para uso conveniente desde consumers del hook.
export { ACADEMY_TIERS, ADDONS, FEATURES };
