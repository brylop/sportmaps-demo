// frontend/src/components/settings/BrandingAuditLog.tsx
//
// Componente embebible en la pagina de settings de branding. Lista los
// ultimos cambios de marca de la escuela: quien (auth user), cuando,
// que cambio (diff before/after), IP y user-agent.
//
// Visible para:
//   - owner / admin / school_admin de la escuela (via RLS de
//     branding_change_log + auth del BFF)
//   - super_admin / admin global (siempre)
//
// Fase 1.9 del roadmap de branding.

import { useMemo } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useBrandingAuditLog, type BrandingAuditEntry } from '@/hooks/useBrandingAuditLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, AlertCircle, Loader2 } from 'lucide-react';

function ColorSwatch({ hex, label }: { hex?: string | null; label: string }) {
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        return <span className="text-xs text-muted-foreground">{label}: —</span>;
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span
                className="w-3 h-3 rounded-sm border border-border"
                style={{ backgroundColor: hex }}
            />
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-mono">{hex.toUpperCase()}</span>
        </span>
    );
}

function changeSourceBadge(src: BrandingAuditEntry['change_source']) {
    const map: Record<BrandingAuditEntry['change_source'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        rpc_update: { label: 'Cambio normal', variant: 'default' },
        admin_override: { label: 'Override admin', variant: 'destructive' },
        reset_default: { label: 'Reset a default', variant: 'secondary' },
        migration: { label: 'Migración', variant: 'outline' },
    };
    const cfg = map[src] ?? { label: src, variant: 'outline' as const };
    return <Badge variant={cfg.variant} className="text-[10px] uppercase tracking-wider">{cfg.label}</Badge>;
}

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function summarizeChange(entry: BrandingAuditEntry): string[] {
    const changes: string[] = [];
    const before = entry.before_state;
    const after = entry.after_state;

    if (before.logo_url !== after.logo_url) {
        changes.push(after.logo_url ? 'Logo actualizado' : 'Logo eliminado');
    }
    if (before.branding_settings?.primary_color !== after.branding_settings?.primary_color) {
        changes.push('Color principal');
    }
    if (before.branding_settings?.secondary_color !== after.branding_settings?.secondary_color) {
        changes.push('Color secundario');
    }
    if (before.branding_settings?.show_sportmaps_watermark !== after.branding_settings?.show_sportmaps_watermark) {
        changes.push(
            after.branding_settings?.show_sportmaps_watermark
                ? 'Watermark activado'
                : 'Watermark desactivado',
        );
    }
    return changes;
}

export function BrandingAuditLog() {
    const { schoolId } = useSchoolContext();
    const { data, isLoading, error } = useBrandingAuditLog(schoolId);

    const entries = useMemo(() => data?.entries ?? [], [data]);

    if (!schoolId) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Historial de cambios de marca
                </CardTitle>
                <CardDescription>
                    Registro forense de quién modificó el branding de tu escuela y cuándo.
                    Sirve para auditoría y para responder solicitudes de acceso (Ley 1581/2012).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando historial...
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 py-4 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <div>
                            <p className="font-medium">No se pudo cargar el historial.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {error instanceof Error ? error.message : String(error)}
                            </p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && entries.length === 0 && (
                    <p className="text-sm text-muted-foreground py-6">
                        Aún no hay cambios registrados. Cuando alguien actualice los colores o el logo,
                        aparecerá aquí.
                    </p>
                )}

                {entries.length > 0 && (
                    <ScrollArea className="h-[420px] pr-3">
                        <ul className="space-y-3">
                            {entries.map((entry) => {
                                const summary = summarizeChange(entry);
                                return (
                                    <li
                                        key={entry.id}
                                        className="border border-border rounded-lg p-3 bg-card/50 hover:bg-card transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3 flex-wrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {changeSourceBadge(entry.change_source)}
                                                    <span className="text-xs font-medium text-foreground">
                                                        {formatDate(entry.changed_at)}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground font-mono">
                                                    user: {entry.changed_by.slice(0, 8)}…
                                                </span>
                                            </div>
                                            {summary.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {summary.map((s, i) => (
                                                        <Badge
                                                            key={i}
                                                            variant="outline"
                                                            className="text-[10px]"
                                                        >
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                    Antes
                                                </p>
                                                <ColorSwatch
                                                    hex={entry.before_state.branding_settings?.primary_color}
                                                    label="Principal"
                                                />
                                                <br />
                                                <ColorSwatch
                                                    hex={entry.before_state.branding_settings?.secondary_color}
                                                    label="Secundario"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                    Después
                                                </p>
                                                <ColorSwatch
                                                    hex={entry.after_state.branding_settings?.primary_color}
                                                    label="Principal"
                                                />
                                                <br />
                                                <ColorSwatch
                                                    hex={entry.after_state.branding_settings?.secondary_color}
                                                    label="Secundario"
                                                />
                                            </div>
                                        </div>

                                        {(entry.ip_address || entry.user_agent) && (
                                            <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground font-mono space-y-0.5">
                                                {entry.ip_address && <div>IP: {entry.ip_address}</div>}
                                                {entry.user_agent && (
                                                    <div className="truncate" title={entry.user_agent}>
                                                        UA: {entry.user_agent}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
