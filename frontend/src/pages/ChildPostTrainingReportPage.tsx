/**
 * Informe grupal de Evaluación Post-Entrenamiento — vista del ACUDIENTE V2
 * («Lo que trabajó el equipo»; spec evaluacion-post-entrenamiento.md §5.3):
 * el agregado del equipo con la respuesta de su hijo resaltada encima, sin
 * nombres de otros deportistas.
 *
 * Hermana de CoachTeamPostTrainingReportPage.tsx, pero:
 *   - sin selector de equipo (se resuelve el del hijo — ver la consulta del equipo activo)
 *   - sin notas por bloque, sin botón de publicar
 *   - cada tarjeta de pregunta resalta dónde cae SU hijo sobre el agregado
 *
 * Consume /reports/team/:teamId/preview-for-parent, que YA validó (en el
 * BFF) que el hijo es del padre y está inscrito activamente en ese equipo —
 * esta pantalla no repite esa lógica de autorización, solo la pinta.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { cn } from '@/lib/utils';
import { firstName } from '@/components/parent/v2/hijos/hijosUtils';
import { EmptyNote, InlineError, Pill, Section, SectionSkeleton } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, PaginaHijo, VolverLegado } from '@/components/parent/hijo-detalle/HijoDetalle';
import { useHijoBasico } from '@/components/parent/hijo-detalle/useHijoDetalle';
import { POST_TRAINING_SECTIONS, metricLabel, plural, respondieron } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

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

/**
 * Una pregunta: la distribución/promedio del EQUIPO y la respuesta del hijo
 * resaltada encima — sin exponer valores de otros deportistas.
 */
function MetricCard({ team, mine, nombre, showLabel }: { team: SessionMetricSummary; mine: SessionMetricSummary | undefined; nombre: string; showLabel: boolean }) {
  return (
    <div className="space-y-2 border-t px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showLabel && <span className="text-sm font-medium">{metricLabel(team.label, team.metric_key)}</span>}
        <span className="text-xs text-muted-foreground">{plural(team.n, 'respuesta del equipo', 'respuestas del equipo')}</span>
      </div>

      {team.aggregation === 'avg' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/60 px-3 py-2.5">
            <p className="text-lg font-semibold tabular-nums">{team.avg ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Promedio del equipo</p>
          </div>
          {mine?.avg !== undefined && (
            <div className="rounded-xl bg-primary/10 px-3 py-2.5">
              <p className="text-lg font-semibold tabular-nums text-primary">{mine.avg}</p>
              <p className="text-xs font-medium text-primary">{nombre}</p>
            </div>
          )}
        </div>
      )}

      {team.aggregation === 'distribution' && (
        <ul className="space-y-1.5">
          {(team.distribution ?? []).map((o) => {
            // «el punto de su hijo pulsa sobre la distribución del equipo»:
            // se resalta la opción que él eligió, sin decir quién eligió las demás.
            const esLaSuya = (mine?.distribution ?? []).some((mo) => mo.value === o.value && mo.n > 0);
            return (
              <li key={o.value} className={cn('rounded-lg px-2 py-1.5', esLaSuya && 'bg-primary/10 ring-1 ring-primary/30')}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={cn('min-w-0', esLaSuya ? 'font-semibold text-primary' : 'text-foreground')}>
                    {o.label}
                    {esLaSuya && <span className="font-normal"> · {nombre}</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {o.pct} % ({o.n})
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className={cn('h-full rounded-full', esLaSuya ? 'bg-primary' : 'bg-muted-foreground/40')} style={{ width: `${o.pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {team.aggregation === 'count' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            <span className="font-semibold">{team.count}</span> de {team.n} lo marcaron
          </span>
          {mine && <Pill tone={mine.count! > 0 ? 'info' : 'neutral'}>{nombre} {mine.count! > 0 ? 'sí lo marcó' : 'no lo marcó'}</Pill>}
        </div>
      )}
    </div>
  );
}

export default function ChildPostTrainingReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: child } = useHijoBasico(id);

  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth() + 1;

  // Simplificación deliberada: si el hijo tiene más de un equipo activo, se
  // muestra el más reciente (mayor start_date). Hoy la inmensa mayoría de
  // deportistas tiene un solo equipo activo por escuela.
  const { data: equipoActivo, isLoading: loadingEquipo, isError: equipoError, refetch: refetchEquipo } = useQuery({
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

  const { data: preview, isLoading: previewLoading, error: previewError, refetch } = useQuery<ParentPreviewResponse>({
    queryKey: ['post-entreno-parent-preview', id, teamId, year, month],
    queryFn: () =>
      bffClient.get<ParentPreviewResponse>(
        `/api/v1/school/reports/team/${teamId}/preview-for-parent?child_id=${id}&year=${year}&month=${month}`,
      ),
    enabled: !!teamId && !!id,
    // 404 = «todavía no publicado»: es una respuesta, no un fallo. Reintentarlo
    // dejaba al acudiente ~10 s mirando el esqueleto antes de decírselo.
    retry: (count, err) => (err as { status?: number })?.status !== 404 && count < 2,
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

  const nombre = firstName(preview?.child_name || child?.full_name || '') || 'Tu hijo';
  const teamName = preview?.team_snapshot.team.name ?? equipoActivo?.teams?.name ?? null;

  const cabecera = (
    <>
      <VolverLegado to="/children?tab=informes" label="Volver a informes" />
      <CabeceraHijo
        titulo="Lo que trabajó el equipo"
        sub={teamName ? `${teamName}${preview ? ` · ${preview.team_snapshot.period.label}` : ''}` : `Cómo le fue a ${nombre} frente a su equipo, sin nombres de otros.`}
      />
    </>
  );

  if (loadingEquipo || (teamId && previewLoading)) {
    return (
      <PaginaHijo>
        {cabecera}
        <SectionSkeleton rows={4} label="Cargando el informe del equipo" />
      </PaginaHijo>
    );
  }

  if (equipoError) {
    return (
      <PaginaHijo>
        {cabecera}
        <InlineError message="No pudimos saber en qué equipo está. Revisa tu conexión e intenta de nuevo." onRetry={() => refetchEquipo()} />
      </PaginaHijo>
    );
  }

  if (!teamId) {
    return (
      <PaginaHijo>
        {cabecera}
        <EmptyNote icon={<Users className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">{nombre} no está en un equipo activo en este momento.</p>
          <p className="mt-1">Cuando entre a un equipo, aquí verás lo que trabajaron en los entrenos.</p>
        </EmptyNote>
      </PaginaHijo>
    );
  }

  if (previewError) {
    const status = (previewError as { status?: number })?.status;
    return (
      <PaginaHijo>
        {cabecera}
        {status === 404 ? (
          <EmptyNote icon={<Users className="h-8 w-8 opacity-40" aria-hidden="true" />}>
            <p className="font-medium text-foreground">El profe todavía no publica el informe de este mes.</p>
            <p className="mt-1">Cuando lo haga, verás aquí cómo le fue a {nombre} frente a {teamName ?? 'su equipo'}.</p>
          </EmptyNote>
        ) : (
          <InlineError message="No pudimos cargar el informe del equipo. Revisa tu conexión e intenta de nuevo." onRetry={() => refetch()} />
        )}
      </PaginaHijo>
    );
  }

  const s = preview?.team_snapshot;

  return (
    <PaginaHijo>
      {cabecera}

      {s && (
        <Section>
          <div className="space-y-3 p-4">
            <p className="text-base font-semibold">
              {s.athlete_count > 0
                ? `Este mes ${respondieron(s.athlete_count)} después de ${plural(s.sessions_count, 'entreno', 'entrenos')}.`
                : `Todavía nadie del equipo ha respondido cómo le fue en ${s.period.label.toLowerCase()}.`}
            </p>
            {preview?.coach_note && (
              <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="whitespace-pre-wrap">
                  <span className="font-semibold">El profe al equipo: </span>
                  {preview.coach_note}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Lo resaltado es lo que respondió {nombre}. No se muestran nombres de otros deportistas.</p>
          </div>
        </Section>
      )}

      {POST_TRAINING_SECTIONS.map((section) => {
        const metrics =
          section.key === 'focus'
            ? focusMetrics
            : (section.metricKeys.map((k) => metricsByKey.get(k)).filter(Boolean) as SessionMetricSummary[]);
        if (metrics.length === 0) return null;
        return (
          <Section key={section.key} title={section.title}>
            <div className="mt-1">
              {metrics.map((m) => (
                <MetricCard
                  key={m.metric_key}
                  team={m}
                  mine={mineByKey.get(m.metric_key)}
                  nombre={nombre}
                  showLabel={section.key === 'focus'}
                />
              ))}
            </div>
          </Section>
        );
      })}
    </PaginaHijo>
  );
}
