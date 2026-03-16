import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSchoolFeatures } from '@/hooks/useSchoolFeatures';
import { bffClient } from '@/lib/api/bffClient';
import { useQueryClient } from '@tanstack/react-query';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { Settings2, Loader2 } from 'lucide-react';

interface ModuleConfig {
    key: string;
    label: string;
    description: string;
    dependencies?: string[];
}

const MODULES: ModuleConfig[] = [
    {
        key: 'offering_plans',
        label: 'Planes y Offerings',
        description: 'Activa el catálogo de productos/servicios con planes de membresía, packs de sesiones, y más.',
    },
    {
        key: 'session_bookings',
        label: 'Reservas de Sesión',
        description: 'Permite a los atletas reservar su cupo en sesiones con control de aforo.',
        dependencies: ['offering_plans'],
    },
    {
        key: 'credit_deduction',
        label: 'Descuento de Créditos',
        description: 'Al finalizar una sesión, se descuenta automáticamente una sesión del plan del atleta.',
        dependencies: ['offering_plans', 'session_bookings'],
    },
    {
        key: 'billing_events',
        label: 'Facturación Avanzada',
        description: 'Registra abonos parciales, mora y eventos de facturación para cada plan.',
        dependencies: ['offering_plans'],
    },
    {
        key: 'sport_configs',
        label: 'Configuración de Deporte',
        description: 'Define categorías por peso, edad, cinturón o nivel para clasificar atletas.',
    },
    {
        key: 'court_booking',
        label: 'Reserva de Canchas',
        description: 'Permite reservar espacios/canchas por hora (pádel, tenis, etc.).',
        dependencies: ['offering_plans'],
    },
    {
        key: 'tournament_mode',
        label: 'Modo Torneo',
        description: 'Gestión de torneos, inscripciones competitivas y brackets.',
        dependencies: ['offering_plans'],
    },
];

/**
 * Panel de configuración de "Modelo de Negocio" para el Owner.
 * Toggles para activar/desactivar módulos de active_modules.
 */
export function BusinessModelConfig() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { schoolId } = useSchoolContext();
    const { activeModules, isLoading } = useSchoolFeatures();
    const [localModules, setLocalModules] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setLocalModules(activeModules);
        setDirty(false);
    }, [activeModules]);

    const toggle = (key: string, enabled: boolean) => {
        let updated = enabled
            ? [...localModules, key]
            : localModules.filter((m) => m !== key);

        // Auto-activar dependencias
        if (enabled) {
            const mod = MODULES.find((m) => m.key === key);
            if (mod?.dependencies) {
                for (const dep of mod.dependencies) {
                    if (!updated.includes(dep)) {
                        updated.push(dep);
                    }
                }
            }
        }

        // Auto-desactivar dependientes
        if (!enabled) {
            for (const mod of MODULES) {
                if (mod.dependencies?.includes(key) && updated.includes(mod.key)) {
                    updated = updated.filter((m) => m !== mod.key);
                }
            }
        }

        setLocalModules(updated);
        setDirty(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            await bffClient.patch('/api/v1/school/context/modules', { active_modules: localModules });
            queryClient.invalidateQueries({ queryKey: ['school-context', schoolId] });
            toast({ title: 'Módulos actualizados' });
            setDirty(false);
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' });
        }
        setSaving(false);
    };

    if (isLoading) {
        return <div className="h-48 bg-muted animate-pulse rounded-lg" />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Modelo de Negocio
                </CardTitle>
                <CardDescription>
                    Activa los módulos que necesitas. Las escuelas sin módulos activos siguen funcionando en modo tradicional.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {MODULES.map((mod) => {
                    const isOn = localModules.includes(mod.key);

                    return (
                        <div
                            key={mod.key}
                            className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                        >
                            <div className="flex-1">
                                <p className="text-sm font-medium">{mod.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                                {mod.dependencies && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Requiere: {mod.dependencies.map((d) =>
                                            MODULES.find((m) => m.key === d)?.label
                                        ).join(', ')}
                                    </p>
                                )}
                            </div>
                            <Switch
                                checked={isOn}
                                onCheckedChange={(v) => toggle(mod.key, v)}
                            />
                        </div>
                    );
                })}

                {dirty && (
                    <div className="flex justify-end pt-2">
                        <Button onClick={save} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                            Guardar cambios
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
