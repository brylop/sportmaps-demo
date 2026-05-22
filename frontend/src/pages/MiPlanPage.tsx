/**
 * MiPlanPage — Dashboard del plan SaaS de la escuela actual.
 *
 * Ruta: /admin/mi-plan
 * Roles: school, admin, school_admin, super_admin
 *
 * Muestra:
 *   - Plan actual con badge de status (active / trialing / grandfathered / etc.)
 *   - Días restantes de trial si aplica
 *   - Lista de addons activos con sus precios
 *   - CTA principal "Mejorar mi plan" → redirect a la landing con contexto
 *   - Sección de upsell para los addons NO activos (recomendaciones)
 */

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Sparkles,
    Clock,
    AlertTriangle,
    Check,
    ArrowRight,
    Crown,
    Shield,
    Heart,
    MessageSquare,
    CreditCard,
    Trophy,
    Apple,
    Smartphone,
    KeyRound,
    ShoppingBag,
} from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import {
    ACADEMY_TIERS,
    ADDONS,
    buildLandingPlansUrl,
    formatCop,
    type AddonKey,
} from '@/config/saas-plans';

// ============================================================
// Mapa de iconos por addon (visual ayuda al admin a identificar)
// ============================================================

const ADDON_ICONS: Record<AddonKey, typeof Sparkles> = {
    tournaments:    Trophy,
    access_control: KeyRound,
    biomech:        Smartphone,
    nutrition:      Apple,
    whitelabel:     Crown,
    whatsapp:       MessageSquare,
    wompi:          CreditCard,
    mp:             CreditCard,
    store:          ShoppingBag,
};

// ============================================================
// Componente
// ============================================================

export default function MiPlanPage() {
    const ent = useEntitlements();

    if (ent.isLoading) {
        return (
            <div className="container mx-auto p-6 max-w-5xl space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (ent.error || !ent.schoolId) {
        return (
            <div className="container mx-auto p-6 max-w-5xl">
                <Card className="border-destructive/40">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
                        <h2 className="text-xl font-semibold mb-2">No pudimos cargar tu plan</h2>
                        <p className="text-muted-foreground mb-4">
                            {ent.error?.message || 'Verifica que tu cuenta tenga una escuela asociada.'}
                        </p>
                        <Button onClick={() => ent.refetch()}>Reintentar</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isStaging = import.meta.env.VITE_APP_ENV === 'staging';
    const activeAddons = (Object.keys(ent.addons) as AddonKey[]).filter((k) => ent.addons[k] && (!isStaging || k !== 'biomech'));
    const inactiveAddons = (Object.keys(ent.addons) as AddonKey[]).filter((k) => !ent.addons[k] && (!isStaging || k !== 'biomech'));

    /**
     * Construye el URL de la landing y le agrega el access_token de
     * Supabase en el hash (#t=...) para que la landing pueda autenticar
     * el POST al BFF sin compartir cookies entre dominios.
     *
     * Hash en vez de query porque:
     *   - No aparece en logs del servidor
     *   - No se envía en Referer header
     *   - El JS de la landing lo limpia con replaceState al leerlo
     */
    const buildUrlWithToken = async (upsellKey?: string, action?: string): Promise<string> => {
        const baseUrl = buildLandingPlansUrl({
            schoolId: ent.schoolId ?? undefined,
            currentPlan: ent.plan.code,
            upsellFeature: upsellKey as any,
            returnTo: typeof window !== 'undefined'
                ? `${window.location.origin}/mi-plan`
                : undefined,
        });
        const finalUrl = action ? `${baseUrl}&action=${action}` : baseUrl;

        try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (token) {
                return `${finalUrl}#t=${encodeURIComponent(token)}`;
            }
        } catch {
            // Si no se puede obtener token, sigue sin él (caerá al flow legacy)
        }
        return finalUrl;
    };

    const handleUpgrade = async () => {
        const url = await buildUrlWithToken();
        window.location.href = url;
    };

    /**
     * Redirige a la landing con upsell apuntado a un addon específico.
     * La landing muestra ese addon destacado y al confirmar
     * crea un plan_upgrade_requests + notifica al super_admin.
     */
    const handleAddonUpsell = async (addonKey: AddonKey) => {
        const url = await buildUrlWithToken(addonKey);
        window.location.href = url;
    };

    /**
     * Para grace period: por ahora también va a la landing
     * (que tiene la sección de actualizar método de pago).
     * Cuando Fase 6 esté lista, esta función abrirá un modal interno
     * con Wompi tokenized para re-cobrar.
     */
    const handleUpdatePayment = async () => {
        const url = await buildUrlWithToken(undefined, 'update_payment');
        window.location.href = url;
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">Mi plan</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona tu suscripción de SportMaps y los módulos activos.
                    </p>
                </div>
                <Button size="lg" onClick={handleUpgrade}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Mejorar mi plan
                </Button>
            </div>

            {/* ── Estado de gracia (pago vencido) ───────────────────── */}
            {ent.inGracePeriod && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-semibold text-destructive">Tu último pago no se procesó</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Tienes 3 días para actualizar tu método de pago antes de que tu plan se pause.
                            </p>
                        </div>
                        <Button size="sm" variant="destructive" onClick={handleUpdatePayment}>
                            Actualizar pago
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Trial expirado ────────────────────────────────────── */}
            {ent.isTrialExpired && !ent.inGracePeriod && (
                <Card className="border-amber-500/40 bg-amber-50/50">
                    <CardContent className="p-4 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-semibold text-amber-700">Tu período de prueba terminó</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Tus datos están seguros. Activa tu plan para seguir operando con todas las funciones.
                            </p>
                        </div>
                        <Button size="sm" onClick={handleUpgrade}>
                            Activar mi plan
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Trial activo (countdown) ──────────────────────────── */}
            {ent.isTrialActive && ent.daysLeftInTrial != null && (
                <Card className="border-primary/40 bg-primary/5">
                    <CardContent className="p-4 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-semibold">
                                {ent.daysLeftInTrial === 0
                                    ? 'Tu prueba termina hoy'
                                    : `Te quedan ${ent.daysLeftInTrial} ${ent.daysLeftInTrial === 1 ? 'día' : 'días'} de prueba`}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Estás probando el plan <strong>{currentTier.name}</strong>. Confirma tu suscripción antes de que termine para no perder funciones.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Plan actual ───────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <CardDescription className="uppercase text-xs tracking-wide">
                                Plan actual
                            </CardDescription>
                            <CardTitle className="text-2xl flex items-center gap-3 mt-1">
                                {currentTier.name}
                                <StatusBadge status={ent.plan.status} />
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{currentTier.tagline}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold">
                                {formatCop(currentTier.priceCents)}
                                {currentTier.priceCents > 0 && (
                                    <span className="text-base font-normal text-muted-foreground">/mes</span>
                                )}
                            </p>
                            {ent.plan.billingCycle === 'annual' && currentTier.priceCents > 0 && (
                                <Badge variant="outline" className="mt-1">
                                    Cobro anual · {currentTier.annualDiscountPct}% off
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {ent.isGrandfathered && (
                        <div className="rounded-lg bg-muted/50 p-3 text-sm">
                            <p className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" />
                                <span>
                                    <strong>Cuenta grandfathered.</strong> Conservas acceso completo sin cobro mientras evaluamos tu plan ideal.
                                </span>
                            </p>
                        </div>
                    )}
                    {ent.plan.currentPeriodEnd && !ent.isGrandfathered && (
                        <p className="text-sm text-muted-foreground">
                            Próximo cobro:{' '}
                            <strong>
                                {ent.plan.currentPeriodEnd.toLocaleDateString('es-CO', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </strong>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── Addons activos ────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Módulos activos
                    </CardTitle>
                    <CardDescription>
                        Funcionalidades adicionales habilitadas en tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {activeAddons.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            No tienes módulos adicionales activos. Mira las recomendaciones abajo.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeAddons.map((key) => {
                                const addon = ADDONS[key];
                                const Icon = ADDON_ICONS[key];
                                return (
                                    <div
                                        key={key}
                                        className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 p-3"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-sm">{addon.name}</p>
                                                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {addon.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Addons recomendados (no activos) ──────────────────── */}
            {inactiveAddons.length > 0 && !ent.isGrandfathered && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Recomendados para ti</CardTitle>
                        <CardDescription>
                            Módulos opcionales activables desde cualquier plan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {inactiveAddons.slice(0, 4).map((key) => {
                                const addon = ADDONS[key];
                                const Icon = ADDON_ICONS[key];
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleAddonUpsell(key)}
                                        className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/30 hover:border-primary/40 transition-colors text-left w-full"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm">{addon.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {addon.description}
                                            </p>
                                            <p className="text-xs font-semibold text-primary mt-1">
                                                {formatCop(addon.priceCents)}/mes
                                                {addon.setupCents > 0 && (
                                                    <span className="text-muted-foreground font-normal">
                                                        {' '}
                                                        + {formatCop(addon.setupCents)} setup
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── CTA grande al final ───────────────────────────────── */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
                <CardContent className="p-6 text-center">
                    <Heart className="w-10 h-10 text-primary mx-auto mb-3" />
                    <h3 className="text-xl font-bold mb-2">
                        ¿Listo para crecer con SportMaps?
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                        Compara todos los planes y elige el que mejor se ajuste a tu escuela.
                    </p>
                    <Button size="lg" onClick={handleUpgrade}>
                        Ver planes y precios
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================
// StatusBadge — sub-componente que pinta el badge según status
// ============================================================

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        active:         { label: 'Activo',         className: 'bg-green-500/10 text-green-700 border-green-500/30' },
        trialing:       { label: 'En prueba',      className: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
        trial_expired:  { label: 'Prueba vencida', className: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
        past_due:       { label: 'Pago vencido',   className: 'bg-destructive/10 text-destructive border-destructive/30' },
        cancelled:      { label: 'Cancelado',      className: 'bg-muted text-muted-foreground' },
        grandfathered:  { label: 'Cuenta original',className: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
    };
    const config = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return (
        <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
            {config.label}
        </Badge>
    );
}
