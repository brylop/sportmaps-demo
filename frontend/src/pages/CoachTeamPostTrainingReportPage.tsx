/**
 * Informe grupal de Evaluación Post-Entrenamiento — spec evaluacion-post-entrenamiento.md §5.3
 * (versión coach/admin). Agregados del equipo por mes, comentario por bloque,
 * y publicación. La versión del padre (su hija sobrepuesta al grupo) queda
 * fuera de este alcance — sigue pendiente §7 abierta #1 (a quién se le envía).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useCoachStaffId } from '@/hooks/useCoachStaffId';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface TeamOption {
  id: string;
  name: string;
  coach_id?: string;
  team_coaches?: { coach_id: string }[];
}

interface SessionMetricOption { value: number; label: string; n: number; pct: number; }
interface SessionMetricSummary {
  metric_key: string;
  label: string;
  category: string | null;
  aggregation: 'avg' | 'distribution' | 'count';
  n: number;
  avg?: number;
  distribution?: SessionMetricOption[];
  count?: number;
}
interface TeamReportSnapshot {
  period: { year: number; month: number; label: string };
  team: { id: string; name: string };
  athlete_count: number;
  sessions_count: number;
  metrics_session: SessionMetricSummary[];
}
interface SectionNote { section_key: string; body: string; updated_at: string; }
interface PreviewResponse {
  snapshot: TeamReportSnapshot;
  report: { id: string; status: 'borrador' | 'publicado'; published_at: string | null } | null;
  section_notes: SectionNote[];
}

const SECTIONS: { key: string; title: string; metricKeys: string[] }[] = [
  { key: 'rpe_borg', title: 'Cansancio (BORG)', metricKeys: ['rpe_borg'] },
  { key: 'task_comprehension', title: 'Comprensión de las tareas', metricKeys: ['task_comprehension'] },
  { key: 'self_effort_pct', title: 'Esfuerzo y entrega', metricKeys: ['self_effort_pct'] },
  { key: 'satisfaction', title: 'Satisfacción y alegría', metricKeys: ['satisfaction'] },
  { key: 'focus', title: 'Aspectos a mejorar', metricKeys: [] }, // se completa dinámico: focus_*
  { key: 'coach_effort_rating', title: 'Lo que vio el entrenador', metricKeys: ['coach_effort_rating'] },
  { key: 'general', title: 'Nota general del periodo', metricKeys: [] },
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function MetricCard({ metric }: { metric: SessionMetricSummary }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{metric.label}</span>
        <Badge variant="secondary" className="text-xs">{metric.n} respuesta{metric.n === 1 ? '' : 's'}</Badge>
      </div>
      {metric.aggregation === 'avg' && (
        <div className="text-2xl font-bold text-primary">{metric.avg}</div>
      )}
      {metric.aggregation === 'distribution' && (
        <div className="space-y-1.5">
          {(metric.distribution ?? []).map((o) => (
            <div key={o.value} className="flex items-center gap-2 text-sm">
              <span className="w-40 truncate text-muted-foreground">{o.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${o.pct}%` }} />
              </div>
              <span className="w-16 text-right tabular-nums">{o.pct}% ({o.n})</span>
            </div>
          ))}
        </div>
      )}
      {metric.aggregation === 'count' && (
        <div className="text-sm">
          <span className="font-semibold">{metric.count}</span> de {metric.n} respuestas
        </div>
      )}
    </div>
  );
}

export default function CoachTeamPostTrainingReportPage() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const { staffId } = useCoachStaffId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hoy = new Date();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const { data: teams = [], isLoading: teamsLoading } = useQuery<TeamOption[]>({
    queryKey: ['coach-teams-post-entreno', user?.id, schoolId, staffId],
    queryFn: async () => {
      if (!user?.id || !schoolId) return [];
      const { data, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, team_coaches(coach_id)')
        .eq('school_id', schoolId) as any);
      if (error) throw error;
      return ((data || []) as TeamOption[])
        .filter((t) =>
          t.coach_id === user.id || (staffId && t.coach_id === staffId) ||
          t.team_coaches?.some((tc) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id && !!schoolId,
  });

  const previewKey = ['post-entreno-team-report', selectedTeamId, year, month];
  const { data: preview, isLoading: previewLoading, isFetching } = useQuery<PreviewResponse>({
    queryKey: previewKey,
    queryFn: () =>
      bffClient.get<PreviewResponse>(`/api/v1/school/reports/team/${selectedTeamId}/preview?year=${year}&month=${month}`),
    enabled: !!selectedTeamId,
  });

  const notaFor = (sectionKey: string) => {
    if (notesDraft[sectionKey] !== undefined) return notesDraft[sectionKey];
    return preview?.section_notes.find((n) => n.section_key === sectionKey)?.body ?? '';
  };

  async function guardarNota(sectionKey: string) {
    if (!preview?.report?.id) return;
    const body = notaFor(sectionKey).trim();
    if (!body) return;
    setSavingSection(sectionKey);
    try {
      await bffClient.put('/api/v1/school/reports/team-section-note', {
        report_type: 'team',
        report_id: preview.report.id,
        section_key: sectionKey,
        body,
      });
      toast({ title: 'Nota guardada' });
      queryClient.invalidateQueries({ queryKey: previewKey });
    } catch (e: any) {
      toast({ title: 'No se pudo guardar la nota', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  }

  async function publicar() {
    if (!selectedTeamId) return;
    setPublishing(true);
    try {
      await bffClient.post(`/api/v1/school/reports/team/${selectedTeamId}/publish`, { year, month });
      toast({ title: 'Informe grupal publicado' });
      queryClient.invalidateQueries({ queryKey: previewKey });
    } catch (e: any) {
      toast({ title: 'No se pudo publicar', description: e?.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  }

  const snapshot = preview?.snapshot;
  const metricsByKey = new Map((snapshot?.metrics_session ?? []).map((m) => [m.metric_key, m]));
  const focusMetrics = (snapshot?.metrics_session ?? []).filter((m) => m.metric_key.startsWith('focus_'));
  const yaPublicado = preview?.report?.status === 'publicado';

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Evaluación post-entrenamiento — informe de equipo</h1>
        <p className="text-muted-foreground text-sm">
          Agregado mensual de las autoevaluaciones y del rating del entrenador, por equipo.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Equipo</label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={teamsLoading}>
              <SelectTrigger><SelectValue placeholder="Elige un equipo" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Mes</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Año</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[hoy.getFullYear(), hoy.getFullYear() - 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedTeamId && (
        <p className="text-center text-muted-foreground py-10">Elige un equipo para ver su informe.</p>
      )}

      {selectedTeamId && previewLoading && <LoadingSpinner />}

      {selectedTeamId && snapshot && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{snapshot.team.name} · {snapshot.period.label}</CardTitle>
                <CardDescription>
                  {snapshot.athlete_count} deportista{snapshot.athlete_count === 1 ? '' : 's'} respondió · {snapshot.sessions_count} sesión{snapshot.sessions_count === 1 ? '' : 'es'} del equipo este mes
                  {isFetching && <span className="ml-2 italic">actualizando…</span>}
                </CardDescription>
              </div>
              {yaPublicado ? (
                <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Publicado</Badge>
              ) : (
                <Button onClick={publicar} disabled={publishing || snapshot.athlete_count === 0}>
                  {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Publicar informe
                </Button>
              )}
            </CardHeader>
          </Card>

          {snapshot.athlete_count === 0 && (
            <p className="text-center text-muted-foreground py-6">
              Todavía no hay autoevaluaciones registradas para este equipo en {snapshot.period.label.toLowerCase()}.
            </p>
          )}

          {SECTIONS.map((section) => {
            const metrics = section.key === 'focus'
              ? focusMetrics
              : section.metricKeys.map((k) => metricsByKey.get(k)).filter(Boolean) as SessionMetricSummary[];

            if (section.key !== 'general' && metrics.length === 0) return null;

            return (
              <Card key={section.key}>
                <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {metrics.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metrics.map((m) => <MetricCard key={m.metric_key} metric={m} />)}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Textarea
                      placeholder={section.key === 'general'
                        ? 'Nota general del periodo para el equipo…'
                        : 'Comentario del entrenador sobre este bloque…'}
                      value={notaFor(section.key)}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [section.key]: e.target.value }))}
                      disabled={!preview?.report?.id || yaPublicado}
                      rows={3}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => guardarNota(section.key)}
                      disabled={!preview?.report?.id || yaPublicado || savingSection === section.key || !notaFor(section.key).trim()}
                    >
                      {savingSection === section.key && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                      Guardar nota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
