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
    /** false → la escuela no tiene fila en school_subscriptions (151 así hoy). */
    has_subscription_row?: boolean;
    /** real | test | demo — las cuentas nuestras nunca se bloquean. */
    account_type?: 'real' | 'test' | 'demo';
    /** true → ve el aviso de fin de prueba pero no se bloquea (caso Dynasty). */
    blocking_exempt?: boolean;
    blocking_exempt_reason?: string | null;
    /** Veredicto del bloqueo calculado en la BD (school_is_operational). */
    is_operational?: boolean;
    /**
     * false → la escuela NO cobra mensualidades por SportMaps (caso Club Carmel:
     * las membresías se pagan en el club). Se le ocultan Pagos, Finanzas y
     * Recordatorios, y ningún cron le genera cartera.
     */
    has_billing?: boolean;
    trial_months?: number | null;
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
    /** PWA con marca de la escuela (addon `pwa_branding`). NO se hereda de
     *  has_whitelabel: contratar la app nativa inserta su propia fila.
     *  Opcional: si el BFF es viejo y no manda el campo, se resuelve como false
     *  y nadie se brandea. */
    has_pwa_branding?: boolean;
    has_whatsapp: boolean;
    has_wompi: boolean;
    has_mp: boolean;
    has_store?: boolean;
    has_accounting?: boolean;
    has_invoicing?: boolean;
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

    // ── Fin del periodo de prueba (aviso + bloqueo) ──────────────────────────
    /**
     * Días que faltan para el corte. A diferencia de `daysLeftInTrial`, se
     * calcula aunque el status no sea 'trialing' y puede ser 0 ("vence hoy") o
     * negativo (ya venció) — el contador del banner lo necesita así.
     */
    trialDaysRemaining: number | null;
    /** El corte es hoy. */
    trialEndsToday: boolean;
    /** La fecha de corte ya pasó. */
    trialHasEnded: boolean;
    /** Veredicto del servidor: la escuela quedó en solo lectura. */
    isBlocked: boolean;
    /** Ve el aviso pero no se bloquea (decisión comercial, ej. Dynasty). */
    isBlockingExempt: boolean;
    /** Cuenta nuestra (test/demo): nunca se avisa ni se bloquea. */
    isTestAccount: boolean;
    /**
     * La escuela cobra mensualidades por SportMaps. Cuando es false se le
     * ocultan Pagos, Finanzas y Recordatorios (columna `billing_enabled`).
     * Por defecto **true**: si el BFF es viejo y no manda el campo no se
     * esconde nada — ocultar de más es peor que ocultar de menos.
     */
    hasBilling: boolean;

    // ── Marca: DOS productos distintos, no confundirlos ──────────────────────
    //
    // Se exponen como derivados para que nadie tenga que recordar que addon
    // mira cada caso. Antes esto vivia como `addons.whitelabel || addons.x`
    // repetido en BrandingScope, AuthLayout y usePwaTenantSync, y alcanzaba con
    // que uno quedara desincronizado para que una escuela tuviera el icono con
    // su logo pero los colores de SportMaps adentro.
    //
    // Espejo exacto de las funciones de la BD:
    //   marcaPropia → school_shows_own_brand()  (addon pwa_branding)
    //   appNativa   → school_has_native_app()   (addon whitelabel)

    /** Se le MUESTRA su marca: manifest, iconos, login, colores. Web/Android/iOS. */
    marcaPropia: boolean;

    /**
     * Tiene app NATIVA propia en App Store / Play Store.
     * Producto mayor. Es el unico que habilita ocultar el "powered by
     * SportMaps". Contratarlo debe otorgar TAMBIEN pwa_branding: la herencia se
     * aplica al otorgar, nunca al leer.
     */
    appNativa: boolean;
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
        pwa_branding: false,
        whatsapp: false,
        wompi: false,
        mp: false,
        store: false,
        accounting: false,
        invoicing: false,
    },
    daysLeftInTrial: null,
    isTrialActive: false,
    isTrialExpired: false,
    inGracePeriod: false,
    isGrandfathered: false,
    trialDaysRemaining: null,
    trialEndsToday: false,
    trialHasEnded: false,
    isBlocked: false,
    isBlockingExempt: false,
    isTestAccount: false,
    hasBilling: true,
    marcaPropia: false,
    appNativa: false,
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

        // Contador del banner: se cuenta por DÍA CALENDARIO, no por horas.
        // Sin esto, un corte a las 23:59 de hoy mostraría "1 día" a las 9 a.m.
        // y el aviso diría lo contrario a lo que el usuario ve en el calendario.
        const trialDaysRemaining = trialEndsAt
            ? Math.round(
                (new Date(trialEndsAt.getFullYear(), trialEndsAt.getMonth(), trialEndsAt.getDate()).getTime() -
                    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / msPerDay,
            )
            : null;

        const isTestAccount = data.account_type === 'test' || data.account_type === 'demo';

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
                biomech: (import.meta.env.VITE_APP_ENV === 'staging' || (typeof window !== 'undefined' && window.location.hostname.includes('staging'))) ? false : data.has_biomech,
                nutrition: data.has_nutrition,
                whitelabel: data.has_whitelabel,
                // Sin herencia desde whitelabel: contratar la app nativa inserta
                // su propia fila de addon. Ver migracion 20260814105131.
                pwa_branding: data.has_pwa_branding ?? false,
                whatsapp: data.has_whatsapp,
                wompi: data.has_wompi,
                mp: data.has_mp,
                store: data.has_store ?? false,
                accounting: data.has_accounting ?? false,
                invoicing: data.has_invoicing ?? false,
            },
            daysLeftInTrial,
            isTrialActive,
            isTrialExpired,
            inGracePeriod: data.subscription_status === 'past_due',
            isGrandfathered: data.subscription_status === 'grandfathered',

            trialDaysRemaining,
            trialEndsToday: trialDaysRemaining === 0,
            trialHasEnded: trialDaysRemaining !== null && trialDaysRemaining < 0,
            // El bloqueo lo decide la BD (school_is_operational), no el navegador.
            // Si el BFF es viejo y no manda el campo, no se bloquea nada.
            isBlocked: data.is_operational === false,
            isBlockingExempt: data.blocking_exempt === true,
            isTestAccount,
            hasBilling: data.has_billing !== false,
            marcaPropia: (data.has_pwa_branding ?? false) === true,
            appNativa: data.has_whitelabel === true,
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
