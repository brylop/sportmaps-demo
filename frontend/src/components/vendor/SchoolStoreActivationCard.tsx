/**
 * SchoolStoreActivationCard — abrir la tienda de la escuela (o del gimnasio).
 *
 *  - Sin el adicional `store`: lleva a Mi plan resaltando el adicional Tienda
 *    (/mi-plan?upsell=store). No se ofrece «Activar» porque la base respondería
 *    ADDON_REQUIRED.
 *  - Con el adicional: «Activar tu tienda» → enable_school_store (crea o reusa la
 *    tienda de la escuela, verificada, con cobros por defecto: transferencia con
 *    las cuentas aptas + efectivo al retirar + solo retiro en sede).
 *
 * Después de activarla, SportMaps la habilita para vender (allowlist del
 * piloto): el texto lo dice para que nadie piense que quedó rota.
 * Sin términos de «vendedor» ni «marketplace»: para la escuela es «Tu tienda».
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Store, ArrowRight, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/integrations/supabase/client';
import { enableSchoolStoreErrorMessage } from '@/lib/store/storeErrors';
import { SCHOOL_STORE_SETTINGS_PATH, STORE_ADDON_UPSELL_PATH } from '@/lib/store/schoolStore';

interface Props {
    compact?: boolean;
    /** Si viene, se muestra la X para cerrar la tarjeta. */
    onDismiss?: () => void;
    /** Tras activar. Por defecto navega a Tu tienda → Ajustes. */
    onActivated?: () => void;
}

export function SchoolStoreActivationCard({ compact = false, onDismiss, onActivated }: Props) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { schoolId } = useSchoolContext();
    const { hasAddon, isLoading } = useEntitlements();
    const [activating, setActivating] = useState(false);

    if (isLoading) return null;
    const withAddon = hasAddon('store');

    const activate = async () => {
        if (!schoolId) {
            toast({ title: 'Elige una escuela', description: 'Selecciona la escuela antes de activar su tienda.', variant: 'destructive' });
            return;
        }
        setActivating(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.rpc as any)('enable_school_store', { p_school_id: schoolId });
            if (error) {
                const friendly = enableSchoolStoreErrorMessage(error);
                toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
                if (friendly.addonRequired) navigate(STORE_ADDON_UPSELL_PATH);
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['school-store'] }),
                queryClient.invalidateQueries({ queryKey: ['vendor-profile'] }),
            ]);
            toast({
                title: 'Tienda activada',
                description: 'SportMaps la revisa y la habilita para vender. Mientras tanto, configura cómo cobras y carga tus productos.',
            });
            if (onActivated) onActivated();
            else navigate(SCHOOL_STORE_SETTINGS_PATH);
        } catch (err) {
            const friendly = enableSchoolStoreErrorMessage(err);
            toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
        } finally {
            setActivating(false);
        }
    };

    const title = withAddon ? 'Activa tu tienda' : 'Abre tu tienda';
    const text = withAddon
        ? 'Vende uniformes, implementos y suplementos a tus deportistas y familias. Al activarla quedan listos los cobros por transferencia y en efectivo al retirar en tu sede.'
        : 'Vende uniformes, implementos y suplementos a tus deportistas y familias. Para abrirla necesitas el adicional Tienda de tu plan.';
    const note = 'Después de activarla, SportMaps revisa tu tienda y la habilita para vender. Te avisamos cuando quede abierta.';
    const cta = withAddon ? 'Activar tienda' : 'Ver el adicional Tienda';
    const onClick = withAddon ? () => void activate() : () => navigate(STORE_ADDON_UPSELL_PATH);

    if (compact) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3" data-testid="school-store-activation">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {withAddon ? 'Cobros listos al activarla; SportMaps la habilita para vender.' : 'Necesitas el adicional Tienda de tu plan.'}
                        </p>
                    </div>
                </div>
                <Button size="sm" className="shrink-0" onClick={onClick} disabled={activating}>
                    {cta}
                    {activating ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-1.5 h-4 w-4" />}
                </Button>
                {onDismiss && (
                    <button onClick={onDismiss} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <Card className="relative border-primary/30 bg-primary/5" data-testid="school-store-activation">
            {onDismiss && (
                <button onClick={onDismiss} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                </button>
            )}
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{text}</p>
                        <p className="text-xs text-muted-foreground mb-4">{note}</p>
                        <Button onClick={onClick} disabled={activating}>
                            {cta}
                            {activating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
