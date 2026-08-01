/**
 * MiPlanPage — Facturación y plan SaaS de la escuela actual.
 *
 * Ruta: /admin/mi-plan
 * Roles: school, admin, school_admin, super_admin
 *
 * Modelo de cobro: por ALUMNOS ACTIVOS (school_athletes.is_active) contra el
 * límite de atletas del tier (FEATURES.athletes.limits en saas-plans.ts).
 * Los alumnos históricos/inactivos no cuentan contra el límite.
 *
 * Muestra:
 *   - Banners de estado (grace period / trial expirado) — wired a useEntitlements.
 *   - Tarjeta de uso: alumnos activos vs límite del plan + barra de progreso.
 *   - Toggle mensual / anual.
 *   - Grid de planes (leído de ACADEMY_TIERS) con plan actual / en prueba /
 *     sugerido, y CTA que redirige a la landing pública para confirmar/pagar.
 *   - Tarjeta Custom (enterprise) + módulos activos + nota de pagos.
 *
 * IMPORTANTE: precios, nombres y límites vienen SIEMPRE de saas-plans.ts.
 * Este archivo solo aporta copy de presentación (bullets, cupos de IA, iconos).
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { studentsAPI } from '@/lib/api/students';
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
    Zap,
    Star,
} from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import {
    ACADEMY_TIERS,
    ADDONS,
    FEATURES,
    buildLandingPlansUrl,
    formatCop,
    formatLimit,
    type AddonKey,
    type TierCode,
    type TierDefinition,
} from '@/config/saas-plans';

// ============================================================
// Copy de presentación por tier (NO es source of truth de precios).
// Precio / nombre / límite se leen de ACADEMY_TIERS y FEATURES.
// ============================================================

interface PlanUI {
    icon: typeof Sparkles;
    /** Conversaciones IA/mes incluidas. null = no incluye. */
    aiQuota: number | null;
    /** Bullets de marketing (el límite de alumnos se antepone dinámico). */
    features: string[];
}

const PLAN_UI: Partial<Record<TierCode, PlanUI>> = {
    start: {
        icon: Zap,
        aiQuota: null,
        features: [
            'Alumnos históricos ilimitados',
            'Gestión de equipos y asistencia',
            'Cobros: Wompi + transferencia manual',
            'App para padres (consulta básica)',
            'Reportes financieros esenciales',
            'Soporte por WhatsApp',
        ],
    },
    crecimiento: {
        icon: Zap,
        aiQuota: null,
        features: [
            'Todo lo de Start',
            'Asistencia con QR + reportes',
            'Historial médico y roles secundarios',
            'Marketplace y certificados',
            'Soporte por email',
        ],
    },
    profesional: {
        icon: Star,
        aiQuota: 500,
        features: [
            'Portal interactivo para padres',
            'WhatsApp AI: cobranza + recordatorios',
            'Dotación e inventario',
            'Control de ingresos y egresos',
            'Reportes financieros y operativos',
            'Soporte prioritario',
        ],
    },
    elite: {
        icon: Crown,
        aiQuota: 4000,
        features: [
            'Multi-sede + roles avanzados',
            'Torneos, tienda y contabilidad incluidos',
            'WhatsApp AI a gran escala',
            'API e integraciones',
            'Migración de datos VIP',
            'Gerente de cuenta dedicado',
        ],
    },
};

/** Tiers pagos mostrados en el grid (el resto: starter=free, enterprise=Custom). */
const GRID_TIERS: TierCode[] = ['start', 'crecimiento', 'profesional', 'elite'];

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
    accounting:     CreditCard,
    invoicing:      CreditCard,
};

// ============================================================
// Helpers de pricing (derivan de saas-plans, no duplican datos)
// ============================================================

/** Límite de alumnos activos del tier. -1 = ilimitado, null = sin límite definido. */
function athleteLimit(code: TierCode): number | null {
    const def = FEATURES.athletes;
    if (def.kind !== 'tierWithLimit') return null;
    return def.limits[code] ?? null;
}

/** Precio mensual mostrado según ciclo + ahorro anual (en centavos COP). */
function tierPricing(tier: TierDefinition, cycle: 'monthly' | 'annual') {
    const monthly = tier.priceCents;
    const annualMonthly = Math.round((monthly * (100 - tier.annualDiscountPct)) / 100);
    return {
        shownCents: cycle === 'annual' ? annualMonthly : monthly,
        annualSavingsCents: (monthly - annualMonthly) * 12,
    };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ============================================================
// Componente
// ============================================================

export default function MiPlanPage() {
    const ent = useEntitlements();
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

    // Alumnos activos reales (mismo cálculo que el dashboard).
    const { data: activeStudents = 0, isLoading: loadingStudents } = useQuery({
        queryKey: ['active-students', ent.schoolId],
        queryFn: async () => (await studentsAPI.getStats(ent.schoolId!)).active,
        enabled: !!ent.schoolId,
        staleTime: 5 * 60 * 1000,
    });

    const cicloLabel = useMemo(
        () => capitalize(new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })),
        [],
    );

    // Plan de referencia: en trial mostramos el tier que se está probando.
    const currentTier = ACADEMY_TIERS[ent.plan.code];
    const currentLimit = athleteLimit(ent.plan.code);
    const usageRatio =
        currentLimit && currentLimit > 0 ? Math.min(1, activeStudents / currentLimit) : 0;
    const cercaDelLimite = currentLimit != null && currentLimit > 0 && usageRatio >= 0.9;

    // Tier más barato cuyo límite cubre los alumnos activos actuales.
    const suggestedTier = useMemo<TierCode>(() => {
        return (
            GRID_TIERS.find((code) => {
                const lim = athleteLimit(code);
                return lim === -1 || (lim != null && activeStudents <= lim);
            }) ?? 'elite'
        );
    }, [activeStudents]);

    // Ahorro anual máximo entre los tiers pagos (para el badge del toggle).
    const maxAnnualSavings = useMemo(
        () =>
            Math.max(
                ...GRID_TIERS.map((c) => tierPricing(ACADEMY_TIERS[c], 'annual').annualSavingsCents),
            ),
        [],
    );

    const isStaging =
        import.meta.env.VITE_APP_ENV === 'staging' ||
        (typeof window !== 'undefined' && window.location.hostname.includes('staging'));
    const activeAddons = (Object.keys(ent.addons) as AddonKey[]).filter(
        (k) => ent.addons[k] && (!isStaging || k !== 'biomech'),
    );

    if (ent.isLoading) {
        return (
            <div className="container mx-auto p-6 max-w-5xl space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-96 w-full" />
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
                            {ent.error?.message ||
                                'Verifica que tu cuenta tenga una escuela asociada.'}
                        </p>
                        <Button onClick={() => ent.refetch()}>Reintentar</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    /**
     * Construye el URL de la landing y le agrega el access_token de Supabase
     * en el hash (#t=...) para que la landing autentique el POST al BFF sin
     * compartir cookies entre dominios. Hash en vez de query: no aparece en
     * logs ni en Referer, y la landing lo limpia con replaceState al leerlo.
     */
    const buildUrlWithToken = async (
        upsellKey?: string,
        action?: string,
        targetPlan?: TierCode,
    ): Promise<string> => {
        const baseUrl = buildLandingPlansUrl({
            schoolId: ent.schoolId ?? undefined,
            currentPlan: ent.plan.code,
            upsellFeature: upsellKey as any,
            returnTo:
                typeof window !== 'undefined' ? `${window.location.origin}/mi-plan` : undefined,
        });
        let finalUrl = baseUrl;
        if (action) finalUrl += `&action=${action}`;
        if (targetPlan) finalUrl += `&target=${targetPlan}`;

        try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (token) return `${finalUrl}#t=${encodeURIComponent(token)}`;
        } catch {
            // Sin token: sigue al flow legacy de la landing.
        }
        return finalUrl;
    };

    // El plan SaaS es un servicio digital: en nativo SIEMPRE sale al navegador
    // del sistema (ver lib/openExternalUrl.ts). En web se comporta igual que
    // antes. No convertir esto de vuelta a window.location.href.
    const handleUpgrade = async () => {
        await openExternalUrl(await buildUrlWithToken());
    };

    const handleChoosePlan = async (code: TierCode) => {
        await openExternalUrl(await buildUrlWithToken(undefined, undefined, code));
    };

    const handleContactSales = async () => {
        await openExternalUrl(await buildUrlWithToken(undefined, 'contact_sales', 'enterprise'));
    };

    const handleUpdatePayment = async () => {
        await openExternalUrl(await buildUrlWithToken(undefined, 'update_payment'));
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">Facturación</h1>
                    <p className="text-muted-foreground mt-1">
                        Tu plan se basa en{' '}
                        <span className="font-semibold text-primary">alumnos activos</span> — los
                        históricos no cuentan ni se borran.
                    </p>
                </div>
                <Button size="lg" onClick={handleUpgrade}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Ver planes
                </Button>
            </div>

            {/* ── Grace period (pago vencido) ───────────────────────── */}
            {ent.inGracePeriod && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-semibold text-destructive">
                                Tu último pago no se procesó
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Tienes 3 días para actualizar tu método de pago antes de que tu plan
                                se pause.
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
                            <p className="font-semibold text-amber-700">
                                Tu período de prueba terminó
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Tus datos están seguros. Activa tu plan para seguir operando con
                                todas las funciones.
                            </p>
                        </div>
                        <Button size="sm" onClick={handleUpgrade}>
                            Activar mi plan
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Tarjeta de uso: alumnos activos vs límite ─────────── */}
            <Card className={cercaDelLimite ? 'border-orange-300 bg-orange-50/40' : ''}>
                <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-bold text-foreground">
                            {loadingStudents ? '…' : activeStudents} alumnos activos
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">Ciclo {cicloLabel}</span>
                        <span className="text-muted-foreground">·</span>
                        {ent.isTrialActive && ent.daysLeftInTrial != null ? (
                            <span className="font-semibold text-primary">
                                Probando {currentTier.name} ·{' '}
                                {ent.daysLeftInTrial === 0
                                    ? 'termina hoy'
                                    : `${ent.daysLeftInTrial} ${ent.daysLeftInTrial === 1 ? 'día' : 'días'} restantes`}
                            </span>
                        ) : (
                            <span className="font-semibold text-primary">{currentTier.name}</span>
                        )}
                    </div>

                    {/* Barra de uso */}
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Uso del plan</span>
                            <span>
                                {activeStudents} /{' '}
                                {currentLimit === -1 || currentLimit == null
                                    ? '∞'
                                    : currentLimit}
                            </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    cercaDelLimite ? 'bg-orange-500' : 'bg-primary'
                                }`}
                                style={{ width: `${usageRatio * 100}%` }}
                            />
                        </div>
                        {cercaDelLimite && (
                            <p className="mt-2 text-xs font-medium text-orange-700">
                                Estás cerca del límite de tu plan. Al cierre de {cicloLabel}, si
                                superas {currentLimit} activos te sugeriremos subir de plan — nunca
                                bloqueamos tu operación a mitad de mes.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Toggle Mensual / Anual ────────────────────────────── */}
            <div className="flex items-center justify-center gap-3 pt-2">
                <div className="inline-flex rounded-full bg-muted p-1">
                    {(['monthly', 'annual'] as const).map((c) => (
                        <button
                            key={c}
                            onClick={() => setCycle(c)}
                            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                                cycle === c
                                    ? 'bg-primary text-primary-foreground shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {c === 'monthly' ? 'Mensual' : 'Anual'}
                        </button>
                    ))}
                </div>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                    Anual: hasta {formatCop(maxAnnualSavings)} de ahorro
                </Badge>
            </div>

            {/* ── Grid de planes ────────────────────────────────────── */}
            <div className="grid gap-5 sm:grid-cols-2">
                {GRID_TIERS.map((code) => {
                    const tier = ACADEMY_TIERS[code];
                    const ui = PLAN_UI[code];
                    const Icon = ui?.icon ?? Sparkles;
                    const limit = athleteLimit(code);
                    const { shownCents, annualSavingsCents } = tierPricing(tier, cycle);

                    const esActual = !ent.isTrialActive && ent.plan.code === code;
                    const esTrialPlan = ent.isTrialActive && ent.plan.code === code;
                    const esSugerido = ent.isTrialActive && suggestedTier === code;
                    const destacado = code === 'profesional';
                    const insuficiente = limit != null && limit !== -1 && activeStudents > limit;

                    return (
                        <div
                            key={code}
                            className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                                destacado
                                    ? 'border-primary shadow-lg shadow-primary/10'
                                    : 'border-border shadow-sm'
                            } ${insuficiente ? 'opacity-60' : ''}`}
                        >
                            {destacado && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                                    Más elegido
                                </span>
                            )}

                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <h2 className="mt-3 text-xl font-bold">{tier.name}</h2>
                                </div>
                                {(esActual || esTrialPlan) && (
                                    <Badge
                                        variant="outline"
                                        className="bg-primary/10 text-primary border-primary/30"
                                    >
                                        {esTrialPlan ? 'En prueba' : 'Tu plan'}
                                    </Badge>
                                )}
                            </div>

                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-3xl font-extrabold">
                                    {formatCop(shownCents)}
                                </span>
                                <span className="text-sm text-muted-foreground">/mes</span>
                            </div>
                            {cycle === 'annual' ? (
                                <p className="mt-1 text-xs font-semibold text-primary">
                                    ✨ Ahorras {formatCop(annualSavingsCents)} al año · facturado
                                    anualmente
                                </p>
                            ) : (
                                <p className="mt-1 text-xs italic text-muted-foreground">
                                    {tier.tagline}
                                </p>
                            )}

                            {ui?.aiQuota && (
                                <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    💬 {ui.aiQuota.toLocaleString('es-CO')} conversaciones AI/mes
                                </span>
                            )}

                            <ul className="mt-4 flex-1 space-y-2">
                                <li className="flex items-start gap-2 text-sm font-medium">
                                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    {limit === -1
                                        ? 'Alumnos activos ilimitados'
                                        : `Hasta ${formatLimit(limit ?? 0, 'alumnos')} activos`}
                                </li>
                                {ui?.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                    >
                                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                className="mt-5 w-full"
                                variant={destacado || esSugerido ? 'default' : 'secondary'}
                                disabled={esActual || insuficiente}
                                onClick={() => handleChoosePlan(code)}
                            >
                                {esActual
                                    ? 'Plan actual'
                                    : insuficiente
                                      ? `Requiere menos de ${limit} activos`
                                      : esSugerido
                                        ? `Elegir ${tier.name} (recomendado)`
                                        : `Elegir ${tier.name}`}
                            </Button>

                            {esSugerido && !insuficiente && (
                                <p className="mt-2 text-center text-xs text-primary">
                                    Cubre tus {activeStudents} alumnos activos actuales
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Custom (enterprise) ───────────────────────────────── */}
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                <CardContent className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold">Custom</h2>
                            <p className="mt-1 text-sm text-muted-foreground max-w-md">
                                Holdings, federaciones o academias con +800 alumnos activos.
                                Migración VIP, integraciones y SLA dedicado.
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold uppercase text-orange-500">Desde</p>
                            <p className="text-2xl font-extrabold text-orange-500">$750.000</p>
                        </div>
                    </div>
                    <Button className="mt-4 w-full" onClick={handleContactSales}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Habla con ventas
                    </Button>
                </CardContent>
            </Card>

            {/* ── Módulos activos ───────────────────────────────────── */}
            {activeAddons.length > 0 && (
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
                    </CardContent>
                </Card>
            )}

            {/* ── Grandfathered ─────────────────────────────────────── */}
            {ent.isGrandfathered && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>
                            <strong>Cuenta grandfathered.</strong> Conservas acceso completo sin
                            cobro mientras evaluamos tu plan ideal.
                        </span>
                    </p>
                </div>
            )}

            {/* ── Nota de pagos ─────────────────────────────────────── */}
            <p className="text-center text-xs text-muted-foreground">
                Paga con PSE, Nequi o tarjeta vía Wompi — también aceptamos transferencia manual.
                <br />
                Alumno activo = con membresía vigente en el ciclo actual. Se recalcula en cada cierre
                de mes.
            </p>

            {/* ── CTA final ─────────────────────────────────────────── */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
                <CardContent className="p-6 text-center">
                    <Heart className="w-10 h-10 text-primary mx-auto mb-3" />
                    <h3 className="text-xl font-bold mb-2">¿Listo para crecer con SportMaps?</h3>
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
