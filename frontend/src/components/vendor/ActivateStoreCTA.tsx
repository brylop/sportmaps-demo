import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { useSchoolStore } from '@/hooks/useSchoolStore';
import { SchoolStoreActivationCard } from './SchoolStoreActivationCard';

// Roles a los que se les ofrece activar Mi Tienda explicitamente.
// (external_vendor / wellness_professional / personal_trainer reciben
//  vendor_profile automatico en signup — no necesitan CTA).
//
// Roles de escuela (school / school_admin / owner) necesitan PAGAR el
// addon `store` desde /mi-plan — no abren tienda libre como coach.
//
// athlete/parent quedan FUERA: el flujo C2C (segunda mano deportiva)
// esta diferido a un release posterior. Cuando se abra, agregarlos aqui.
const ELIGIBLE_ROLES = new Set([
    'coach',
    'school',
    'school_admin',
    'staff',
    'owner', // owner de escuela puede activar tienda
]);

// Para estos roles el CTA lleva a /mi-plan (tienda es addon pago) en vez de
// /vendor/onboarding (alta libre de tienda).
const PAID_STORE_ROLES = new Set(['school', 'school_admin', 'owner']);

interface Props {
    /** Si true, renderiza version compacta (banner horizontal) en lugar de card destacado. */
    compact?: boolean;
    /** Texto del CTA (default: "Activar Mi Tienda") */
    label?: string;
}

export function ActivateStoreCTA({ compact = false, label = 'Activar Mi Tienda' }: Props) {
    const { profile, updateProfile } = useAuth();
    const { hasVendorProfile, isInactive, isLoading } = useVendorProfile();
    const schoolStore = useSchoolStore();
    const navigate = useNavigate();
    const { enabled: storeEnabled } = useStoreEnabled();

    // Tienda apagada a nivel plataforma: no se ofrece activarla.
    if (!storeEnabled) return null;
    if (isLoading || schoolStore.isLoading) return null;
    if (!profile) return null;

    // Merge sobre `preferences` completo (mismo jsonb de dashboard_quick_actions
    // y dashboard_welcome_seen) — nunca reemplazarlo entero.
    const dismiss = () => {
        updateProfile(
            { preferences: { ...profile.preferences, store_cta_dismissed: true } },
            { silent: true }
        ).catch(() => {});
    };

    // Administración de la escuela (owner / school_admin, por el rol en la
    // escuela ACTIVA, no solo profile.role): la tienda es la del club, resuelta
    // por escuela (bug N0). Activada → no se ofrece nada. Si no, tarjeta propia:
    // con el adicional «Activar», sin él → Mi plan con el adicional resaltado.
    if (schoolStore.isSchoolAdmin || PAID_STORE_ROLES.has(profile.role as string)) {
        if (schoolStore.isOpen) return null;
        if (profile.preferences?.store_cta_dismissed) return null;
        return <SchoolStoreActivationCard compact={compact} onDismiss={dismiss} />;
    }

    if (!ELIGIBLE_ROLES.has(profile.role as string)) return null;
    if (hasVendorProfile) return null; // ya activa
    if (profile.preferences?.store_cta_dismissed) return null; // el usuario ya la cerró
    const ctaLabel = isInactive ? 'Reactivar Mi Tienda' : label;

    // Vendedor que no es escuela (coach, staff): alta libre en /vendor/onboarding.
    const handleActivate = () => navigate('/vendor/onboarding');
    const activating = false;

    if (compact) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-200 dark:border-purple-900/30 bg-purple-50/60 dark:bg-purple-950/20 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-purple-900 dark:text-purple-200 truncate">
                            Vende dentro de SportMaps
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-400 truncate">
                            Activa Mi Tienda y publica productos o servicios al marketplace.
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="default"
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white shrink-0"
                    onClick={handleActivate}
                    disabled={activating}
                >
                    {ctaLabel}
                    {activating
                        ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                        : <ArrowRight className="ml-1.5 h-4 w-4" />}
                </Button>
                <button
                    onClick={dismiss}
                    className="shrink-0 text-purple-700/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-purple-200 transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <Card className="relative border-purple-200 dark:border-purple-900/30 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 dark:from-purple-950/30 dark:via-card dark:to-purple-950/15">
            <button
                onClick={dismiss}
                className="absolute right-3 top-3 text-purple-700/60 hover:text-purple-900 dark:text-purple-400/60 dark:hover:text-purple-200 transition-colors"
                aria-label="Cerrar"
            >
                <X className="h-4 w-4" />
            </button>
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        <Store className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">Mi Tienda</h3>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-700 dark:text-purple-300">
                                <Sparkles className="h-3 w-3" />
                                Nuevo
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Vende tus productos o servicios deportivos a toda la comunidad de SportMaps.
                            {profile.role === 'coach' && ' Ideal para entrenadores que ofrecen planes, asesorías o mercancía propia.'}
                        </p>
                        <Button
                            onClick={handleActivate}
                            disabled={activating}
                            className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white"
                        >
                            {ctaLabel}
                            {activating
                                ? <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                : <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
