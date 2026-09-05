import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Loader2, RefreshCw, Check, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';

interface Finding {
    id: string;
    school_id: string;
    school_name: string;
    athlete_col: 'child_id' | 'user_id' | 'unregistered_athlete_id';
    athlete_id: string;
    athlete_name: string;
    last_team_name: string | null;
    last_plan_name: string | null;
    last_monthly_fee: number | null;
    last_enrollment_status: string | null;
    status: 'open' | 'resolved' | 'ignored';
    resolution_note: string | null;
    detected_at: string;
    last_seen_at: string;
    resolved_at: string | null;
}

type StatusFilter = 'open' | 'resolved' | 'ignored';

const ATHLETE_COL_LABEL: Record<Finding['athlete_col'], string> = {
    child_id: 'Menor',
    user_id: 'Adulto',
    unregistered_athlete_id: 'Sin cuenta',
};

export default function AdminEnrollmentIntegrityPage() {
    const [findings, setFindings] = useState<Finding[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<StatusFilter, number>>({ open: 0, resolved: 0, ignored: 0 });
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
    const [resolveTarget, setResolveTarget] = useState<{ finding: Finding; action: 'resolved' | 'ignored' } | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchCounts = useCallback(async () => {
        try {
            const statuses: StatusFilter[] = ['open', 'resolved', 'ignored'];
            const results = await Promise.all(
                statuses.map(s => supabase.rpc('admin_list_enrollment_integrity_findings' as any, { p_status: s, p_limit: 1, p_offset: 0 }))
            );
            const next: Record<StatusFilter, number> = { open: 0, resolved: 0, ignored: 0 };
            results.forEach((r, i) => { next[statuses[i]] = (r.data as any)?.total ?? 0; });
            setCounts(next);
        } catch (err) {
            console.error('Error fetching finding counts:', err);
        }
    }, []);

    const fetchFindings = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('admin_list_enrollment_integrity_findings' as any, {
                p_status: statusFilter,
                p_limit: 200,
                p_offset: 0,
            });
            if (error) throw error;
            const payload = (data as any) || {};
            setFindings((payload.rows ?? []) as Finding[]);
            setTotal(payload.total ?? 0);
        } catch (err: any) {
            console.error('Error fetching enrollment integrity findings:', err);
            toast({
                title: 'Error al cargar hallazgos',
                description: err?.message?.includes('Forbidden')
                    ? 'Tu cuenta no es super-admin de plataforma.'
                    : err?.message || 'No se pudieron cargar los hallazgos.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchFindings();
        fetchCounts();
    }, [fetchFindings, fetchCounts]);

    const runCheckNow = async () => {
        setChecking(true);
        try {
            const { data, error } = await supabase.rpc('admin_run_enrollment_integrity_check' as any);
            if (error) throw error;
            const result = (data as any) || {};
            toast({
                title: 'Revisión completada',
                description: `${result.new_findings ?? 0} caso(s) nuevo(s) · ${result.open_findings ?? 0} abiertos en total.`,
            });
            fetchFindings();
            fetchCounts();
        } catch (err: any) {
            toast({
                title: 'Error al ejecutar la revisión',
                description: err?.message || 'Intenta de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setChecking(false);
        }
    };

    const submitResolution = async () => {
        if (!resolveTarget) return;
        setSaving(true);
        try {
            const { error } = await supabase.rpc('admin_resolve_enrollment_integrity_finding' as any, {
                p_finding_id: resolveTarget.finding.id,
                p_status: resolveTarget.action,
                p_note: note || null,
            });
            if (error) throw error;
            toast({
                title: resolveTarget.action === 'resolved' ? 'Marcado como resuelto' : 'Marcado como ignorado',
            });
            setResolveTarget(null);
            setNote('');
            fetchFindings();
            fetchCounts();
        } catch (err: any) {
            toast({
                title: 'Error al guardar',
                description: err?.message || 'Intenta de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShieldAlert className="h-7 w-7 text-primary" />
                        Integridad de inscripciones
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Atletas activos sin ninguna inscripción activa (ni equipo ni plan) — no se les puede cobrar
                        hasta que alguien lo revise. Se detecta solo cada lunes; este botón lo fuerza ahora.
                    </p>
                </div>
                <Button onClick={runCheckNow} disabled={checking}>
                    {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Revisar ahora
                </Button>
            </div>

            <StatFilterBar
                columns={3}
                value={statusFilter}
                onChange={(v) => setStatusFilter((v as StatusFilter) ?? 'open')}
                items={[
                    { key: 'open', label: 'Abiertos', value: counts.open, tone: 'rose' },
                    { key: 'resolved', label: 'Resueltos', value: counts.resolved, tone: 'emerald' },
                    { key: 'ignored', label: 'Ignorados', value: counts.ignored, tone: 'yellow' },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {total} hallazgo{total !== 1 ? 's' : ''} {statusFilter === 'open' ? 'abierto(s)' : statusFilter === 'resolved' ? 'resuelto(s)' : 'ignorado(s)'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : findings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <ShieldAlert className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Sin hallazgos {statusFilter === 'open' ? 'abiertos' : statusFilter}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Escuela</TableHead>
                                    <TableHead>Atleta</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Última cuota conocida</TableHead>
                                    <TableHead>Detectado</TableHead>
                                    {statusFilter === 'open' && <TableHead className="text-right">Acciones</TableHead>}
                                    {statusFilter !== 'open' && <TableHead>Nota</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {findings.map(f => (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-medium">{f.school_name}</TableCell>
                                        <TableCell>{f.athlete_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{ATHLETE_COL_LABEL[f.athlete_col]}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {f.last_monthly_fee != null
                                                ? `$${Number(f.last_monthly_fee).toLocaleString('es-CO')} · ${f.last_plan_name || f.last_team_name || 'sin plan/equipo'}`
                                                : '— nunca tuvo cuota configurada'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {new Date(f.detected_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' })}
                                        </TableCell>
                                        {statusFilter === 'open' ? (
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setResolveTarget({ finding: f, action: 'resolved' })}
                                                >
                                                    <Check className="h-3.5 w-3.5 mr-1" /> Resuelto
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setResolveTarget({ finding: f, action: 'ignored' })}
                                                >
                                                    <EyeOff className="h-3.5 w-3.5 mr-1" /> Ignorar
                                                </Button>
                                            </TableCell>
                                        ) : (
                                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={f.resolution_note || ''}>
                                                {f.resolution_note || '—'}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <TableRefreshBar
                        onRefresh={fetchFindings}
                        loading={loading}
                        summary={`${total} hallazgo(s)`}
                    />
                </CardContent>
            </Card>

            <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {resolveTarget?.action === 'resolved' ? 'Marcar como resuelto' : 'Ignorar hallazgo'}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {resolveTarget?.finding.athlete_name} — {resolveTarget?.finding.school_name}
                    </p>
                    <Textarea
                        placeholder={
                            resolveTarget?.action === 'resolved'
                                ? 'Ej: se reactivó la inscripción con el plan X, cuota confirmada con la escuela.'
                                : 'Ej: piloto abandonado, la escuela nunca continuó.'
                        }
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={3}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={submitResolution} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
