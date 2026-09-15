/**
 * Informe grupal de Evaluación Post-Entrenamiento — vista del PADRE
 * (spec evaluacion-post-entrenamiento.md §5.3): "la misma plantilla con el
 * dato de su hija sobrepuesta al grupo — el punto 'Valentina' pulsa sobre la
 * distribución del equipo. Sin nombres de otras deportistas."
 *
 * Hermana de CoachTeamPostTrainingReportPage.tsx, pero:
 *   - sin selector de equipo (se resuelve el del hijo — ver `resolverEquipo`)
 *   - sin notas por bloque, sin botón de publicar
 *   - cada tarjeta de métrica resalta dónde cae SU hija sobre el agregado
 *
 * Consume /reports/team/:teamId/preview-for-parent, que YA validó (en el
 * BFF) que el hijo es del padre y está inscrito activamente en ese equipo —
 * esta pantalla no repite esa lógica de autorización, solo la pinta.
 */
import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { ArrowLeft, MessageSquare, Users } from 'lucide-react';

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
interface ParentPreviewResponse {
  team_snapshot: TeamReportSnapshot;
  child_metrics: SessionMetricSummary[];
  child_name: string;
  coach_note: string | null;
}

// Mismo agrupamiento por sección que usa el coach — para que el padre vea la
// misma estructura, solo que sin la nota ni el botón de publicar.
const SECTIONS: { key: string; title: string; metricKeys: string[] }[] = [
  { key: 'rpe_borg', title: 'Cansancio (BORG)', metricKeys: ['rpe_borg'] },
  { key: 'task_comprehension', title: 'Comprensión de las tareas', metricKeys: ['task_comprehension'] },
  { key: 'self_effort_pct', title: 'Esfuerzo y entrega', metricKeys: ['self_effort_pct'] },
  { key: 'satisfaction', title: 'Satisfacción y alegría', metricKeys: ['satisfaction'] },
  { key: 'focus', title: 'Aspectos a mejorar', metricKeys: [] }, // se completa dinámico: focus_*
];

/**
 * Tarjeta de métrica con la distribución/promedio del EQUIPO y el dato de la
 * hija resaltado encima — sin exponer valores de otras deportistas.
 */
function MetricCard({ team, mine }: { team: SessionMetricSummary; mine: SessionMetricSummary | undefined }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{team.label}</span>
        <Badge variant="secondary" className="text-xs">{team.n} respuesta{team.n === 1 ? '' : 's'} del equipo</Badge>
      </div>

      {team.aggregation === 'avg' && (
        <div className="flex items-end gap-4">
          <div>
            <div className="text-2xl font-bold text-muted-foreground">{team.avg}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Promedio del equipo</div>
          </div>
          {mine?.avg !== undefined && (
            <div>
              <div className="text-2xl font-bold text-primary">{mine.avg}</div>
              <div className="text-[10px] uppercase tracking-wide text-primary">Tu hija</div>
            </div>
          )}
        </div>
      )}

      {team.aggregation === 'distribution' && (
        <div className="space-y-1.5">
          {(team.distribution ?? []).map((o) => {
            // "el punto de mi hija pulsa sobre la distribución del equipo":
            // resaltamos la barra de la opción que ella misma eligió, sin
            // decir cuántas otras deportistas eligieron cada una.
            const esLaSuya = (mine?.distribution ?? []).some((mo) => mo.value === o.value && mo.n > 0);
            return (
              <div
                key={o.value}
                className={`flex items-center gap-2 text-sm rounded-md -mx-1 px-1 ${esLaSuya ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
              >
                <span className={`w-40 truncate ${esLaSuya ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                  {o.label}{esLaSuya && ' · tu hija'}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${esLaSuya ? 'bg-primary' : 'bg-muted-foreground/40'}`} style={{ width: `${o.pct}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums">{o.pct}% ({o.n})</span>
              </div>
            );
          })}
        </div>
      )}

      {team.aggregation === 'count' && (
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="font-semibold">{team.count}</span> de {team.n} respuestas del equipo
          </span>
          {mine && (
            <Badge variant={mine.count! > 0 ? 'default' : 'outline'} className="text-xs">
              Tu hija {mine.count! > 0 ? 'sí lo marcó' : 'no lo marcó'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChildPostTrainingReportPage() {
  const { id } = useParams<{ id: string }>();

  const { data: child } = useQuery({
    queryKey: ['child-basic', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('id, full_name').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth() + 1;

  // Simplificación deliberada: si el hijo tiene más de un equipo activo, se
  // muestra el más reciente (mayor start_date). Resolver "cuál mostrar"
  // cuando hay varios con datos distintos en el mismo periodo queda para una
  // fase siguiente si el caso real aparece — hoy la inmensa mayoría de
  // atletas tiene un solo equipo activo por escuela.
  const { data: equipoActivo, isLoading: loadingEquipo } = useQuery({
    queryKey: ['child-active-team', id],
    queryFn: async () => {
      // `teams(id, name)` es ambiguo: enrollments tiene DOS FKs a teams
      // (team_id y scheduling_team_id) y PostgREST rechaza el embed sin
      // desambiguar (PGRST201). Hay que nombrar la FK explícita.
      const { data, error } = await supabase
        .from('enrollments')
        .select('team_id, start_date, teams:teams!enrollments_team_id_fkey(id, name)')
        .eq('child_id', id!)
        .eq('status', 'active')
        .not('team_id', 'is', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { team_id: string; teams: { id: string; name: string } | null } | null;
    },
    enabled: !!id,
  });

  const teamId = equipoActivo?.team_id ?? null;

  const previewKey = ['post-entreno-parent-preview', id, teamId, year, month];
  const { data: preview, isLoading: previewLoading, error: previewError, refetch } = useQuery<ParentPreviewResponse>({
    queryKey: previewKey,
    queryFn: () =>
      bffClient.get<ParentPreviewResponse>(
        `/api/v1/school/reports/team/${teamId}/preview-for-parent?child_id=${id}&year=${year}&month=${month}`,
      ),
    enabled: !!teamId && !!id,
  });

  const metricsByKey = useMemo(
    () => new Map((preview?.team_snapshot.metrics_session ?? []).map((m) => [m.metric_key, m])),
    [preview],
  );
  const mineByKey = useMemo(
    () => new Map((preview?.child_metrics ?? []).map((m) => [m.metric_key, m])),
    [preview],
  );
  const focusMetrics = (preview?.team_snapshot.metrics_session ?? []).filter((m) => m.metric_key.startsWith('focus_'));

  if (loadingEquipo || (teamId && previewLoading)) {
    return <LoadingSpinner fullScreen text="Cargando informe..." />;
  }

  if (!teamId) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <Link to={`/children/${id}/reports`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3 w-3" /> Volver a informes
        </Link>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {child?.full_name ?? 'Tu hija'} no tiene un equipo activo en este momento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (previewError) {
    const status = (previewError as any)?.status;
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <Link to={`/children/${id}/reports`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3 w-3" /> Volver a informes
        </Link>
        {status === 404 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground max-w-xs">
                El informe de {equipoActivo?.teams?.name ?? 'su equipo'} de este mes todavía no ha sido publicado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ErrorState
            title="Error al cargar el informe"
            message="Hubo un problema al recuperar el informe del equipo."
            onRetry={() => refetch()}
          />
        )}
      </div>
    );
  }

  const s = preview?.team_snapshot;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <Link to={`/children/${id}/reports`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-2 w-fit">
          <ArrowLeft className="h-3 w-3" /> Volver a informes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Evaluación post-entrenamiento</h1>
        <p className="text-muted-foreground text-sm">
          Cómo le fue a {preview?.child_name ?? 'tu hija'} frente al resto del equipo, sin nombres de otras deportistas.
        </p>
      </div>

      {s && (
        <Card>
          <CardHeader>
            <CardTitle>{s.team.name} · {s.period.label}</CardTitle>
            <CardDescription>
              {s.athlete_count} deportista{s.athlete_count === 1 ? '' : 's'} respondió · {s.sessions_count} sesión{s.sessions_count === 1 ? '' : 'es'} del equipo este mes
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {preview?.coach_note && (
        <Card>
          <CardContent className="p-4 flex gap-3">
            <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                Nota del entrenador para el equipo
              </p>
              <p className="text-sm">{preview.coach_note}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {s && s.athlete_count === 0 && (
        <p className="text-center text-muted-foreground py-6">
          Todavía no hay autoevaluaciones registradas para este equipo en {s.period.label.toLowerCase()}.
        </p>
      )}

      {SECTIONS.map((section) => {
        const metrics = section.key === 'focus'
          ? focusMetrics
          : section.metricKeys.map((k) => metricsByKey.get(k)).filter(Boolean) as SessionMetricSummary[];

        if (metrics.length === 0) return null;

        return (
          <Card key={section.key}>
            <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {metrics.map((m) => (
                <MetricCard key={m.metric_key} team={m} mine={mineByKey.get(m.metric_key)} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
