import { useState, useMemo, type ReactNode } from 'react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { FEATURES, type AddonKey, type FeatureKey } from '@/config/saas-plans';
import { UpgradeModal, type UpgradeModalMode } from './UpgradeModal';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, TrafficCone, Clock, AlertTriangle } from 'lucide-react';

export type GateFallback = 'modal' | 'inline' | 'redirect';

interface EntitlementGateProps {
    /** Feature a verificar. Si se omite, solo valida grace/trial. */
    feature?: FeatureKey;
    /**
     * Si la feature es de tipo tierWithLimit, current cuenta uso actual.
     * Si current >= max para el tier actual → soft limit.
     */
    currentUsage?: number;
    /**
     * Forzar modo grace period (pago vencido). Tiene prioridad sobre todo.
     * Si se omite, el gate lo detecta automáticamente de useEntitlements.
     */
    gracePeriod?: boolean;
    /** Estilo de bloqueo. Default 'modal'. */
    fallback?: GateFallback;
    /** Si fallback='redirect', a dónde mandar. Default /admin/mi-plan. */
    redirectTo?: string;
    /** Cuando no hay bloqueo, renderiza children. */
    children: ReactNode;
    /** Custom card inline (sobreescribe el default visual de fallback='inline'). */
    inlineRenderer?: (props: {
        mode: UpgradeModalMode;
        onClick: () => void;
    }) => ReactNode;
}

/**
 * Decide el modo de bloqueo según el orden de prioridad:
 *   1. gracePeriod   — pago vencido (siempre prioritario)
 *   2. trialExpired  — trial terminado y feature requiere plan superior a Starter
 *   3. addonRequired — feature es de tipo addon y el addon no está activo
 *   4. softLimit     — feature numérica y se alcanzó el límite del tier
 *   5. hardLock      — tier actual < tier requerido
 *
 * Devuelve null si todo está OK.
 */
function decideMode(args: {
    isGracePeriod: boolean;
    isTrialExpired: boolean;
    hasFeature: boolean;
    withinLimit: boolean;
    featureDef: ReturnType<typeof getFeatureDef>;
    isAddonFeature: boolean;
    addonEnabled: boolean;
}): {
    mode: UpgradeModalMode;
    addonKey?: AddonKey;
} | null {
    if (args.isGracePeriod) return { mode: 'gracePeriod' };

    if (args.isAddonFeature && !args.addonEnabled) {
        return {
            mode: 'addonRequired',
            addonKey: args.featureDef && 'addonKey' in args.featureDef
                ? args.featureDef.addonKey
                : undefined,
        };
    }

    // Trial expirado se muestra solo cuando la feature requiere algo más que Starter.
    // Si la feature es Starter-friendly, dejamos pasar (las funciones gratis siguen).
    if (
        args.isTrialExpired &&
        args.featureDef &&
        args.featureDef.kind !== 'addon' &&
        args.featureDef.minTier !== 'starter'
    ) {
        return { mode: 'trialExpired' };
    }

    if (!args.withinLimit) return { mode: 'softLimit' };
    if (!args.hasFeature) return { mode: 'hardLock' };

    return null;
}

function getFeatureDef(feature?: FeatureKey) {
    if (!feature) return null;
    return FEATURES[feature];
}

// ============================================================
// Componente
// ============================================================

export function EntitlementGate({
    feature,
    currentUsage,
    gracePeriod,
    fallback = 'modal',
    redirectTo = '/admin/mi-plan',
    children,
    inlineRenderer,
}: EntitlementGateProps) {
    const ent = useEntitlements();
    const [open, setOpen] = useState(true);

    const featureDef = getFeatureDef(feature);
    const isAddonFeature = featureDef?.kind === 'addon';
    const addonEnabled = isAddonFeature && featureDef && 'addonKey' in featureDef
        ? ent.addons[featureDef.addonKey]
        : false;

    const decision = useMemo(() => {
        if (ent.isLoading) return null;

        return decideMode({
            isGracePeriod: gracePeriod ?? ent.inGracePeriod,
            isTrialExpired: ent.isTrialExpired,
            hasFeature: feature ? ent.hasFeature(feature) : true,
            withinLimit:
                feature && currentUsage !== undefined
                    ? ent.withinLimit(feature, currentUsage)
                    : true,
            featureDef,
            isAddonFeature,
            addonEnabled,
        });
    }, [
        ent.isLoading,
        ent.inGracePeriod,
        ent.isTrialExpired,
        ent.hasFeature,
        ent.withinLimit,
        ent.addons,
        feature,
        currentUsage,
        gracePeriod,
        featureDef,
        isAddonFeature,
        addonEnabled,
    ]);

    // Mientras carga, mostramos children (optimista) — evita flicker en cargas rápidas.
    if (ent.isLoading || decision === null) {
        return <>{children}</>;
    }

    // ── Redirect ──────────────────────────────────────────────────
    if (fallback === 'redirect') {
        if (typeof window !== 'undefined') {
            const qs = new URLSearchParams({
                upsell: feature ?? 'unknown',
                reason: decision.mode,
            });
            window.location.replace(`${redirectTo}?${qs.toString()}`);
        }
        return null;
    }

    // ── Modal ─────────────────────────────────────────────────────
    if (fallback === 'modal') {
        const limit =
            decision.mode === 'softLimit' &&
            featureDef?.kind === 'tierWithLimit' &&
            currentUsage !== undefined
                ? {
                      current: currentUsage,
                      max: featureDef.limits[ent.plan.code] ?? 0,
                  }
                : undefined;

        return (
            <>
                <UpgradeModal
                    open={open}
                    onOpenChange={setOpen}
                    mode={decision.mode}
                    feature={feature}
                    addon={decision.addonKey}
                    currentPlan={ent.plan.code}
                    limit={limit}
                    schoolId={ent.schoolId ?? undefined}
                />
                {/* Children renderizan detrás del modal (skeleton del feature bloqueado) */}
                <div className="pointer-events-none opacity-30 select-none">{children}</div>
            </>
        );
    }

    // ── Inline ────────────────────────────────────────────────────
    if (inlineRenderer) {
        return <>{inlineRenderer({ mode: decision.mode, onClick: () => setOpen(true) })}</>;
    }

    return (
        <DefaultInlineUpsell
            mode={decision.mode}
            featureLabel={featureDef && 'label' in featureDef ? featureDef.label : undefined}
            onClick={() => setOpen(true)}
        />
    );
}

// ============================================================
// Inline upsell default — card compacta dentro del flow
// ============================================================

interface DefaultInlineUpsellProps {
    mode: UpgradeModalMode;
    featureLabel?: string;
    onClick: () => void;
}

function DefaultInlineUpsell({ mode, featureLabel, onClick }: DefaultInlineUpsellProps) {
    const config = INLINE_CONFIG[mode];
    return (
        <div
            className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-6 text-center`}
        >
            <div
                className={`mx-auto w-12 h-12 rounded-full ${config.iconBgClass} flex items-center justify-center mb-3`}
            >
                <config.Icon className={`w-6 h-6 ${config.iconColorClass}`} />
            </div>
            <h3 className="font-semibold text-lg mb-1">
                {featureLabel ? `${featureLabel} — ${config.title}` : config.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{config.subtitle}</p>
            <Button onClick={onClick}>{config.cta}</Button>
        </div>
    );
}

const INLINE_CONFIG: Record<
    UpgradeModalMode,
    {
        Icon: typeof Lock;
        title: string;
        subtitle: string;
        cta: string;
        bgClass: string;
        borderClass: string;
        iconBgClass: string;
        iconColorClass: string;
    }
> = {
    hardLock: {
        Icon: Lock,
        title: 'Función no disponible en tu plan',
        subtitle: 'Actualiza tu plan para desbloquear esta sección.',
        cta: 'Actualizar mi plan →',
        bgClass: 'bg-muted/30',
        borderClass: 'border-border',
        iconBgClass: 'bg-muted',
        iconColorClass: 'text-muted-foreground',
    },
    softLimit: {
        Icon: TrafficCone,
        title: 'Llegaste al límite de tu plan',
        subtitle: 'Actualiza tu plan para seguir creciendo sin restricciones.',
        cta: 'Actualizar mi plan →',
        bgClass: 'bg-orange-500/5',
        borderClass: 'border-orange-500/30',
        iconBgClass: 'bg-orange-500/15',
        iconColorClass: 'text-orange-600',
    },
    addonRequired: {
        Icon: Sparkles,
        title: 'Activa este módulo',
        subtitle: 'Disponible como addon desde cualquier plan.',
        cta: 'Ver detalles →',
        bgClass: 'bg-primary/5',
        borderClass: 'border-primary/30',
        iconBgClass: 'bg-primary/15',
        iconColorClass: 'text-primary',
    },
    trialExpired: {
        Icon: Clock,
        title: 'Tu período de prueba terminó',
        subtitle: 'Tus datos están seguros. Activa tu plan para seguir operando.',
        cta: 'Activar mi plan →',
        bgClass: 'bg-amber-500/5',
        borderClass: 'border-amber-500/30',
        iconBgClass: 'bg-amber-500/15',
        iconColorClass: 'text-amber-600',
    },
    gracePeriod: {
        Icon: AlertTriangle,
        title: 'Actualiza tu método de pago',
        subtitle: 'Tu último cobro falló. Tienes 3 días antes de que se pause tu plan.',
        cta: 'Actualizar pago →',
        bgClass: 'bg-destructive/5',
        borderClass: 'border-destructive/40',
        iconBgClass: 'bg-destructive/15',
        iconColorClass: 'text-destructive',
    },
};
