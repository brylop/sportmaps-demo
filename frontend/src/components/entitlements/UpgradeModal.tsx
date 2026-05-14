import { useNavigate } from 'react-router-dom';
import { Lock, TrafficCone, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ACADEMY_TIERS,
    ADDONS,
    FEATURES,
    buildLandingPlansUrl,
    formatCop,
    type AddonKey,
    type FeatureKey,
    type TierCode,
} from '@/config/saas-plans';

/**
 * Modos del modal — el orden refleja la prioridad visual.
 * gracePeriod > trialExpired > addon > softLimit > hardLock.
 */
export type UpgradeModalMode =
    | 'hardLock'      // Tipo 1: función no existe en tu plan
    | 'softLimit'     // Tipo 2: llegaste al límite numérico
    | 'addonRequired' // Tipo 3: activa el addon
    | 'trialExpired'  // Tipo 4: tu trial expiró
    | 'gracePeriod';  // Tipo 5: pago falló, 3 días de gracia

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: UpgradeModalMode;
    /** Feature que disparó el bloqueo (para hardLock, softLimit). */
    feature?: FeatureKey;
    /** Addon requerido (para addonRequired). */
    addon?: AddonKey;
    /** Plan actual del usuario (para todos los modos). */
    currentPlan: TierCode;
    /** Para softLimit. */
    limit?: { current: number; max: number };
    /** Plan recomendado para trialExpired (basado en uso real). */
    recommendedPlan?: TierCode;
    /** schoolId para deep-link a landing. */
    schoolId?: string;
}

// ============================================================
// Helpers internos
// ============================================================

function inferRequiredTier(feature?: FeatureKey): TierCode | null {
    if (!feature) return null;
    const def = FEATURES[feature];
    if (def.kind === 'addon') return null;
    return def.minTier;
}

function returnToCurrentPath(): string {
    if (typeof window === 'undefined') return '';
    return window.location.origin + window.location.pathname;
}

// ============================================================
// Componente
// ============================================================

export function UpgradeModal({
    open,
    onOpenChange,
    mode,
    feature,
    addon,
    currentPlan,
    limit,
    recommendedPlan,
    schoolId,
}: UpgradeModalProps) {
    const navigate = useNavigate();

    const featureDef = feature ? FEATURES[feature] : null;
    const addonDef = addon ? ADDONS[addon] : null;
    const requiredTier = inferRequiredTier(feature);
    const currentTierDef = ACADEMY_TIERS[currentPlan];
    const requiredTierDef = requiredTier ? ACADEMY_TIERS[requiredTier] : null;
    const recommendedTierDef = recommendedPlan
        ? ACADEMY_TIERS[recommendedPlan]
        : ACADEMY_TIERS.crecimiento;

    const goToLanding = (upsellKey?: FeatureKey | AddonKey) => {
        const url = buildLandingPlansUrl({
            schoolId,
            currentPlan,
            upsellFeature: upsellKey,
            returnTo: returnToCurrentPath(),
        });
        window.location.href = url;
    };

    const goToBillingAddon = (key: AddonKey) => {
        navigate(`/admin/mi-plan/addons?activate=${key}`);
        onOpenChange(false);
    };

    const contactSales = () => {
        const phone = '573128463555';
        const msg = `Hola SportMaps 👋\n\nQuiero hablar con ventas sobre mi plan.\n\nPlan actual: ${currentTierDef.name}\nSchool ID: ${schoolId ?? '—'}`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // ============================================================
    // Render por modo
    // ============================================================

    if (mode === 'gracePeriod') {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md border-destructive/40">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mb-3">
                            <AlertTriangle className="w-7 h-7 text-destructive" />
                        </div>
                        <DialogTitle className="text-center text-xl">
                            Actualiza tu método de pago
                        </DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            Tu último cobro no se pudo procesar. Tienes <strong>3 días</strong> para
                            actualizar la tarjeta antes de que tu plan se pause.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg bg-muted/50 p-4 text-sm">
                        <div className="flex justify-between mb-1">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-medium">{currentTierDef.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estado</span>
                            <Badge variant="destructive">Pago vencido</Badge>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            className="flex-1"
                            onClick={() => {
                                navigate('/admin/mi-plan/pago');
                                onOpenChange(false);
                            }}
                        >
                            Actualizar pago →
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={contactSales}>
                            Hablar con soporte
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (mode === 'trialExpired') {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-3">
                            <Clock className="w-7 h-7 text-amber-600" />
                        </div>
                        <DialogTitle className="text-center text-xl">
                            Tu período de prueba terminó
                        </DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            Tus datos están seguros. Para seguir operando con todas las funciones,
                            activa tu plan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Plan recomendado según tu uso
                        </p>
                        <div className="flex items-baseline justify-between">
                            <p className="text-2xl font-bold">{recommendedTierDef.name}</p>
                            <p className="text-lg font-semibold">
                                {formatCop(recommendedTierDef.priceCents)}
                                <span className="text-sm text-muted-foreground">/mes</span>
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {recommendedTierDef.tagline}
                        </p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button className="flex-1" onClick={() => goToLanding(feature)}>
                            Activar mi plan →
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={contactSales}>
                            Hablar con ventas
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (mode === 'addonRequired' && addonDef) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-3">
                            <Sparkles className="w-7 h-7 text-primary" />
                        </div>
                        <DialogTitle className="text-center text-xl">
                            Activa el módulo {addonDef.name}
                        </DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            {addonDef.description}{' '}
                            <strong>Disponible como addon desde cualquier plan.</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-3xl font-bold">
                            {formatCop(addonDef.priceCents)}
                            <span className="text-base font-normal text-muted-foreground">
                                /mes
                            </span>
                        </p>
                        {addonDef.setupCents > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                                + {formatCop(addonDef.setupCents)} setup único
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 italic">
                            Sin permanencia
                        </p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        {addonDef.salesLed ? (
                            <Button className="flex-1" onClick={contactSales}>
                                Hablar con ventas →
                            </Button>
                        ) : (
                            <>
                                <Button
                                    className="flex-1"
                                    onClick={() => goToBillingAddon(addonDef.key)}
                                >
                                    Activar {addonDef.name} →
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={contactSales}
                                >
                                    Hablar con ventas
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (mode === 'softLimit' && limit && featureDef && featureDef.kind === 'tierWithLimit') {
        const nextTier =
            requiredTierDef ??
            ACADEMY_TIERS[
                (Object.entries(featureDef.limits).find(
                    ([, max]) => max === -1 || (max ?? 0) > limit.max
                )?.[0] as TierCode) ?? 'crecimiento'
            ];
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center mb-3">
                            <TrafficCone className="w-7 h-7 text-orange-600" />
                        </div>
                        <DialogTitle className="text-center text-xl">
                            Llegaste al límite de tu plan
                        </DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            Tu plan <strong>{currentTierDef.name}</strong> incluye hasta{' '}
                            <strong>
                                {limit.max} {featureDef.unit}
                            </strong>
                            . Estás en {limit.current}/{limit.max}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            Siguiente paso recomendado
                        </p>
                        <div className="flex items-baseline justify-between">
                            <p className="text-xl font-bold">{nextTier.name}</p>
                            <p className="font-semibold">
                                {formatCop(nextTier.priceCents)}
                                <span className="text-sm text-muted-foreground">/mes</span>
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Hasta{' '}
                            {nextTier.code === 'enterprise'
                                ? 'sin límite'
                                : `${featureDef.limits[nextTier.code]} ${featureDef.unit}`}
                        </p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button className="flex-1" onClick={() => goToLanding(feature)}>
                            Actualizar mi plan →
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                        >
                            No por ahora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Default: hardLock (Tipo 1)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Lock className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <DialogTitle className="text-center text-xl">
                        {featureDef
                            ? `${featureDef.label} está en el plan ${
                                  requiredTierDef?.name ?? 'superior'
                              }`
                            : 'Función no disponible en tu plan'}
                    </DialogTitle>
                    {featureDef?.description && (
                        <DialogDescription className="text-center pt-2">
                            {featureDef.description}
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className="space-y-3">
                    <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Tu plan actual
                            </p>
                            <p className="font-semibold">{currentTierDef.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {formatCop(currentTierDef.priceCents)}/mes
                        </p>
                    </div>
                    {requiredTierDef && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-primary">
                                    Plan requerido
                                </p>
                                <p className="font-semibold">{requiredTierDef.name}</p>
                            </div>
                            <p className="font-semibold">
                                {formatCop(requiredTierDef.priceCents)}/mes
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button className="flex-1" onClick={() => goToLanding(feature)}>
                        Actualizar mi plan →
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => goToLanding()}
                    >
                        Ver comparativa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
