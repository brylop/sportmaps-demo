/**
 * Informe Mensual del Atleta — tablero de la escuela.
 *
 * El ciclo entero en una pantalla: generar borradores → escribir la nota de cada
 * equipo → publicar el lote → enviar.
 *
 * Es deliberadamente operativa, no bonita: el objetivo es poder mandar el
 * informe hoy. El tablero de cobertura fino (F3) y la vista del padre (F4) son
 * fases siguientes de docs/specs/athlete-reports-module.md.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Send, Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface ReportRow {
    id: string;
    subject_type: string;
    subject_id: string;
    team_id: string | null;
    status: string;
    scheduled_for: string;
    recipient_id: string | null;
    sent_at: string | null;
    viewed_at: string | null;
    teams: { name: string } | null;
    athlete_name: string;
    coach_note: string | null;
}

interface Resumen {
    total: number;
    borrador: number;
    listo: number;
    publicados: number;
    retenidos: number;
    enviados: number;
    leidos: number;
    sin_destinatario: number;
}

export default function MonthlyReportsPage() {
    const { schoolId } = useSchoolContext();
    const { profile } = useAuth();
    const { toast } = useToast();

    /**
     * Coach = autor, escuela = publica (D2). Son dos responsabilidades distintas
     * y un solo botón para ambas es el error que este módulo evita.
     *
     * Generar borradores y enviar son del admin: el BFF los limita a ADMIN_ROLES,
     * así que mostrarle esos botones al coach sería ofrecerle un 403. Publicar
     * depende de school_settings.reports_release_by, que se valida dentro de la
     * RPC — se le deja visible y la RPC decide.
     */
    const isCoach = profile?.role === 'coach';
    const queryClient = useQueryClient();

    const hoy = new Date();
    const [year, setYear] = useState(hoy.getFullYear());
    const [month, setMonth] = useState(hoy.getMonth() + 1);
    const [teamId, setTeamId] = useState<string>('');
    const [nota, setNota] = useState('');
    /** Informe cuya nota individual se está editando, y su texto. */
    const [notaIndividual, setNotaIndividual] = useState<{ id: string; texto: string } | null>(null);

    const periodo = { year, month };
    const claveInformes = ['monthly-reports', schoolId, year, month];

    const { data: equipos } = useQuery({
        queryKey: ['teams-for-reports', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data } = await supabase
                .from('teams')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name');
            return (data ?? []) as { id: string; name: string }[];
        },
    });

    /**
     * Quién libera y despacha. Lo decide CADA escuela: en Dynasty los entrenadores
     * están encima del día a día y les sirve mandarlo ellos; otra va a querer que
     * nada salga sin pasar por administración. Por eso vive en school_settings y
     * no en el código.
     *
     * El valor llega en el GET de informes, no de una consulta aparte: el coach
     * no puede leer school_settings por RLS, y necesita saberlo para que no se le
     * muestre un botón que le va a dar 403.
     */
    const cambiarLiberacion = useMutation({
        mutationFn: async (valor: 'school' | 'coach') => {
            const { error } = await supabase
                .from('school_settings')
                .upsert({ school_id: schoolId, reports_release_by: valor }, { onConflict: 'school_id' });
            if (error) throw error;
            return valor;
        },
        onSuccess: (valor) => {
            toast({
                title: valor === 'coach'
                    ? 'Los entrenadores publican y envían lo suyo'
                    : 'Solo la administración publica y envía',
                description: valor === 'coach'
                    ? 'Cada entrenador libera los informes de SUS equipos, no los del resto.'
                    : 'Los entrenadores siguen escribiendo las notas.',
            });
                queryClient.invalidateQueries({ queryKey: claveInformes });
        },
        onError: fallar('No se pudo cambiar quién libera'),
    });

    const { data, isLoading, refetch } = useQuery({
        queryKey: claveInformes,
        enabled: !!schoolId,
        queryFn: () =>
            bffClient.get<{ resumen: Resumen; reports: ReportRow[] }>(
                `/api/v1/school/reports?year=${year}&month=${month}`,
            ),
    });

    const resumen = data?.resumen;
    const releaseBy = data?.release_by ?? 'school';
    const reports = useMemo(() => data?.reports ?? [], [data]);

    /** Un error del BFF trae `error`; si no, algo peor pasó y hay que mostrarlo igual. */
    const fallar = (titulo: string) => (err: any) =>
        toast({
            title: titulo,
            description: err?.message || 'Error inesperado',
            variant: 'destructive',
        });

    const generar = useMutation({
        mutationFn: () => bffClient.post<{ created: number }>('/api/v1/school/reports/generate', periodo),
        onSuccess: (r) => {
            toast({
                title: r.created > 0 ? `${r.created} borradores creados` : 'No había nada que generar',
                description: r.created > 0
                    ? 'Se creó un borrador por atleta con mediciones en el mes.'
                    : 'Solo se generan informes de atletas CON mediciones en el periodo. '
                      + 'Si el mes no tiene evaluaciones cargadas, no hay informe que hacer.',
            });
            queryClient.invalidateQueries({ queryKey: claveInformes });
        },
        onError: fallar('No se pudieron generar los borradores'),
    });

    const guardarNota = useMutation({
        mutationFn: () =>
            bffClient.put(`/api/v1/school/teams/${teamId}/report-note`, { ...periodo, body: nota }),
        onSuccess: () => {
            toast({ title: '✅ Nota del equipo guardada' });
            setNota('');
        },
        onError: fallar('No se pudo guardar la nota'),
    });

    const publicarEquipo = useMutation({
        mutationFn: () =>
            bffClient.post<{ results: { report_id: string; resultado: string; detalle: string | null }[] }>(
                '/api/v1/school/reports/publish-team',
                { ...periodo, team_id: teamId },
            ),
        onSuccess: (r) => {
            const publicados = r.results.filter((x) => x.resultado === 'publicado').length;
            const errores = r.results.filter((x) => x.resultado === 'error');
            toast({
                title: `${publicados} informes publicados`,
                description: errores.length
                    ? `${errores.length} con problema: ${errores[0].detalle}`
                    : 'Snapshot congelado. Ya se pueden enviar.',
                variant: errores.length ? 'destructive' : 'default',
            });
            queryClient.invalidateQueries({ queryKey: claveInformes });
        },
        onError: fallar('No se pudo publicar el lote'),
    });

    const enviar = useMutation({
        mutationFn: () =>
            bffClient.post<{ sent: number; skipped: number }>('/api/v1/school/reports/send', periodo),
        onSuccess: (r) => {
            toast({
                title: `${r.sent} informes enviados`,
                description: r.skipped > 0
                    ? `${r.skipped} sin enviar, casi siempre por falta de acudiente vinculado.`
                    : 'Correo enviado y notificación encolada.',
            });
            queryClient.invalidateQueries({ queryKey: claveInformes });
        },
        onError: fallar('No se pudieron enviar'),
    });

    const guardarNotaIndividual = useMutation({
        mutationFn: ({ id, texto }: { id: string; texto: string }) =>
            bffClient.put(`/api/v1/school/reports/${id}/note`, { note: texto }),
        onSuccess: () => {
            toast({ title: '✅ Nota individual guardada' });
            setNotaIndividual(null);
            queryClient.invalidateQueries({ queryKey: claveInformes });
        },
        onError: fallar('No se pudo guardar la nota individual'),
    });

    /** El coach envía solo si la escuela le delegó la liberación. */
    const puedeCoachEnviar = isCoach && releaseBy === 'coach';

    const publicables = reports.filter(
        (r) => r.team_id === teamId && (r.status === 'borrador' || r.status === 'listo'),
    ).length;

    const ocupado = generar.isPending || guardarNota.isPending || publicarEquipo.isPending
        || enviar.isPending || guardarNotaIndividual.isPending;

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
                    Informe Mensual
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {isCoach
                        ? 'Tu nota del mes para cada equipo.'
                        : 'Generar, escribir la nota de cada equipo, publicar y enviar a las familias.'}
                </p>
            </div>

            {/* ── Periodo ── */}
            <Card>
                <CardContent className="pt-5 flex flex-wrap items-end gap-3">
                    <div>
                        <Label className="text-xs">Mes</Label>
                        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MESES.map((m, i) => (
                                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Año</Label>
                        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[hoy.getFullYear() - 1, hoy.getFullYear()].map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
                    </Button>

                    {!isCoach && (
                        <div className="ml-auto">
                            <Label className="text-xs">Quién publica y envía</Label>
                            <Select
                                value={releaseBy}
                                onValueChange={(v) => cambiarLiberacion.mutate(v as 'school' | 'coach')}
                            >
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="school">Solo la administración</SelectItem>
                                    <SelectItem value="coach">Cada entrenador, lo suyo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
            </Card>

            {isCoach && (
                <div className="rounded-lg border bg-accent/10 p-3 text-sm">
                    Escribí la nota de cada uno de tus equipos. La escuela genera los
                    borradores y hace el envío a las familias.
                </div>
            )}

            {/* ── Paso 1: generar. Solo la escuela. ── */}
            {!isCoach && (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">1 · Generar borradores</CardTitle>
                    <CardDescription>
                        Crea un informe por atleta <strong>con mediciones en el mes</strong>. Se puede
                        repetir sin duplicar ni pisar notas ya escritas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => generar.mutate()} disabled={ocupado}>
                        {generar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Generar borradores de {MESES[month - 1]}
                    </Button>

                    {resumen && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            {[
                                { label: 'Total', valor: resumen.total },
                                { label: 'Borradores', valor: resumen.borrador },
                                { label: 'Publicados', valor: resumen.publicados },
                                { label: 'Enviados', valor: resumen.enviados },
                            ].map((b) => (
                                <div key={b.label} className="rounded-lg border p-2.5">
                                    <div className="text-xl font-bold tabular-nums">{b.valor}</div>
                                    <div className="text-[11px] text-muted-foreground">{b.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* El dato que le sirve al admin para perseguir a las familias
                        que no activaron cuenta. No es un error del sistema. */}
                    {resumen && resumen.sin_destinatario > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-xs leading-relaxed">
                                <strong>{resumen.sin_destinatario}</strong> informes publicados no tienen a
                                quién enviarse: esas familias no han vinculado su cuenta. El informe queda
                                guardado y lo verán al entrar.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {/* ── Nota del equipo y publicación ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{isCoach ? 'Nota del equipo' : '2 · Nota del equipo y publicación'}</CardTitle>
                    <CardDescription>
                        La nota de equipo es obligatoria para publicar. Un párrafo por equipo, no uno
                        por atleta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label className="text-xs">Equipo</Label>
                        <Select value={teamId} onValueChange={setTeamId}>
                            <SelectTrigger><SelectValue placeholder="Elegir equipo" /></SelectTrigger>
                            <SelectContent>
                                {(equipos ?? []).map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-xs">
                            Cómo le fue al equipo en {MESES[month - 1]}
                        </Label>
                        <Textarea
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            rows={4}
                            placeholder="Lo que trabajaron este mes, cómo respondió el grupo, qué sigue…"
                            disabled={!teamId}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Mínimo 20 caracteres. Va en el informe de todos los atletas del equipo.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => guardarNota.mutate()}
                            disabled={ocupado || !teamId || nota.trim().length < 20}
                        >
                            {guardarNota.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Guardar nota
                        </Button>

                        <Button
                            onClick={() => publicarEquipo.mutate()}
                            disabled={ocupado || !teamId || publicables === 0}
                        >
                            {publicarEquipo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Users className="h-4 w-4 mr-2" aria-hidden="true" />
                            Publicar {publicables > 0 ? `${publicables} informes` : 'lote'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ── Enviar. La escuela siempre; el coach solo si se lo habilitaron. ── */}
            {(!isCoach || puedeCoachEnviar) && (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">3 · Enviar</CardTitle>
                    <CardDescription>
                        Correo con el resumen y el enlace, más notificación en la app. Publicar no
                        envía: esto es lo que le llega a la familia.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => enviar.mutate()}
                        disabled={ocupado || !resumen || resumen.publicados === 0}
                    >
                        {enviar.isPending
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Send className="h-4 w-4 mr-2" aria-hidden="true" />}
                        Enviar los publicados
                    </Button>
                </CardContent>
            </Card>
            )}

            {/* ── Listado ── */}
            {reports.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Informes de {MESES[month - 1]} {year}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y border-t">
                            {reports.map((r) => {
                                const editando = notaIndividual?.id === r.id;
                                // Publicado = congelado: cambiar la nota despues
                                // exige regenerar, que versiona y audita.
                                const editable = r.status !== 'publicado';

                                return (
                                <div key={r.id} className="px-4 py-2.5 text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="flex-1 min-w-0">
                                            <span className="block truncate font-medium">{r.athlete_name}</span>
                                            <span className="block text-[11px] text-muted-foreground truncate">
                                                {r.teams?.name ?? 'Sin equipo'}
                                                {r.coach_note && ' · con nota individual'}
                                            </span>
                                        </span>
                                        <Badge variant={r.status === 'publicado' ? 'default' : 'secondary'}>
                                            {r.status}
                                        </Badge>
                                        {r.sent_at && (
                                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-label="enviado" />
                                        )}
                                        {r.status === 'publicado' && !r.recipient_id && (
                                            <span className="text-[11px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                                sin acudiente
                                            </span>
                                        )}
                                        {editable && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => setNotaIndividual(
                                                    editando ? null : { id: r.id, texto: r.coach_note ?? '' },
                                                )}
                                            >
                                                {r.coach_note ? 'Editar nota' : 'Nota individual'}
                                            </Button>
                                        )}
                                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                            {r.scheduled_for}
                                        </span>
                                    </div>

                                    {editando && (
                                        <div className="mt-2.5 space-y-2">
                                            <Textarea
                                                value={notaIndividual.texto}
                                                onChange={(e) => setNotaIndividual({ id: r.id, texto: e.target.value })}
                                                rows={3}
                                                placeholder={`Algo puntual sobre ${r.athlete_name.split(' ')[0]}, si hay que decirlo…`}
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Opcional. Va solo en el informe de este atleta, además de la nota
                                                del equipo. Dejala vacía para quitarla.
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    disabled={ocupado}
                                                    onClick={() => guardarNotaIndividual.mutate(notaIndividual)}
                                                >
                                                    {guardarNotaIndividual.isPending && (
                                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                    )}
                                                    Guardar
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setNotaIndividual(null)}>
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
