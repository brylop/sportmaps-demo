/**
 * Informe mensual de un hijo — acudiente V2.
 *
 * Arriba una frase (asistencia del mes) y el consejo del profe; debajo lo
 * mejor del mes, en qué trabajar y todas las mediciones por tipo. Al abrirlo
 * se marca como visto (useAthleteReportDetail) y el PDF sale del mismo
 * `snapshot` congelado vía el BFF.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAthleteReportDetail } from '@/hooks/useAthleteReports';
import { BAND_STYLE, CATEGORY_ORDER, CATEGORY_STYLE, fmtWithUnit } from '@/lib/school/performanceDisplay';
import { downloadAthleteReportPdf, type SnapshotMetric } from '@/lib/school/reportsQueries';
import { capitalize, firstName } from '@/components/parent/v2/hijos/hijosUtils';
import { InlineError, Section, SectionSkeleton } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, Cifra, PaginaHijo, VolverLegado } from '@/components/parent/hijo-detalle/HijoDetalle';
import { deltaIsGood, deltaText, metricLabel, plural } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

function MetricRow({ metric }: { metric: SnapshotMetric }) {
  const band = metric.band ? BAND_STYLE[metric.band] : null;
  const delta = deltaText(metric.delta, metric.unit);
  const good = deltaIsGood(metric.delta, metric.higher_is_better);
  return (
    <div className="flex min-h-touch items-center gap-3 border-t px-4 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{metricLabel(metric.label, metric.metric_key)}</p>
        {metric.hint && <p className="text-xs text-muted-foreground">{metric.hint}</p>}
      </div>
      {delta && (
        <span
          className={cn(
            'shrink-0 text-xs font-semibold tabular-nums',
            good === true && 'text-green-700 dark:text-green-400',
            good === false && 'text-red-700 dark:text-red-400',
          )}
        >
          {delta}
        </span>
      )}
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums',
          band ? band.chip : 'border-border bg-muted text-foreground',
        )}
        title={band?.label}
      >
        {fmtWithUnit(metric.value, metric.unit)}
      </span>
    </div>
  );
}

export default function ChildReportDetailPage() {
  const { id, reportId } = useParams<{ id: string; reportId: string }>();
  const { data: report, isLoading, isError, refetch } = useAthleteReportDetail(reportId);
  const { toast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!reportId) return;
    setDownloadingPdf(true);
    try {
      await downloadAthleteReportPdf(reportId);
    } catch (e: unknown) {
      toast({
        title: 'No se pudo descargar el PDF',
        description: e instanceof Error ? e.message : 'Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <PaginaHijo>
        <SectionSkeleton rows={4} label="Cargando el informe" />
      </PaginaHijo>
    );
  }

  if (isError || !report) {
    return (
      <PaginaHijo>
        <VolverLegado to={`/children/${id}/reports`} label="Volver a informes" />
        <InlineError message="No pudimos abrir este informe. Revisa tu conexión e intenta de nuevo." onRetry={() => refetch()} />
      </PaginaHijo>
    );
  }

  const s = report.snapshot;
  const nombre = firstName(s.athlete?.name ?? '') || 'Tu hijo';
  const metricsByCategory = new Map<string, SnapshotMetric[]>();
  for (const m of s.metrics) {
    const cat = m.category && m.category in CATEGORY_STYLE ? m.category : 'other';
    if (!metricsByCategory.has(cat)) metricsByCategory.set(cat, []);
    metricsByCategory.get(cat)!.push(m);
  }

  const att = s.attendance;
  const fraseAsistencia =
    att.total > 0
      ? `${nombre} vino a ${att.present} de ${plural(att.total, 'entreno', 'entrenos')} este mes${att.pct !== null ? ` (${att.pct} %)` : ''}.`
      : `Este mes no hubo entrenos con lista para ${nombre}.`;

  return (
    <PaginaHijo>
      <VolverLegado to={`/children/${id}/reports`} label="Volver a informes" />
      <CabeceraHijo
        titulo={`Informe de ${s.period.label.toLowerCase()}`}
        sub={[s.school?.name, s.governing_team?.name].filter(Boolean).join(' · ')}
      />

      <Section>
        <div className="space-y-3 p-4">
          <p className="text-base font-semibold">{fraseAsistencia}</p>
          {s.coach_note && (
            <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="whitespace-pre-wrap">
                <span className="font-semibold">Lo que dice el profe: </span>
                {s.coach_note}
              </p>
            </div>
          )}
          {s.training_load && (
            <p className="text-sm text-muted-foreground">
              Registró qué tan duro fue en {plural(s.training_load.sessions_count, 'entreno', 'entrenos')} ({s.training_load.total_ua.toFixed(0)} UA de esfuerzo en el mes).
            </p>
          )}
          <Button
            variant="outline"
            className="min-h-touch w-full gap-2 sm:w-auto"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {downloadingPdf ? 'Preparando el PDF…' : 'Descargar PDF'}
          </Button>
        </div>
      </Section>

      {s.team_notes.length > 0 && (
        <Section title="Del equipo">
          {s.team_notes.map((n) => (
            <div key={n.team_id} className="border-t px-4 py-3 first:border-t-0">
              <p className="text-xs font-semibold text-muted-foreground">{n.team_name}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.body}</p>
            </div>
          ))}
        </Section>
      )}

      {s.football && (
        <Section title="Partidos del mes">
          <div className="grid grid-cols-3 gap-2 p-4 pt-2 sm:grid-cols-6">
            <Cifra valor={s.football.matches_played} etiqueta="Partidos" />
            <Cifra valor={`${s.football.minutes_played}'`} etiqueta="Minutos" />
            <Cifra valor={s.football.goals} etiqueta="Goles" />
            <Cifra valor={s.football.assists} etiqueta="Asistencias" />
            <Cifra valor={s.football.yellow_cards} etiqueta="Amarillas" />
            <Cifra valor={s.football.red_cards} etiqueta="Rojas" />
          </div>
        </Section>
      )}

      {s.highlights.length > 0 && (
        <Section title="Lo mejor del mes">
          <div className="mt-1">
            {s.highlights.map((m) => <MetricRow key={m.metric_key} metric={m} />)}
          </div>
        </Section>
      )}

      {s.to_work_on.length > 0 && (
        <Section title="Para trabajar">
          <div className="mt-1">
            {s.to_work_on.map((m) => <MetricRow key={m.metric_key} metric={m} />)}
          </div>
        </Section>
      )}

      {CATEGORY_ORDER.filter((cat) => metricsByCategory.has(cat)).map((cat) => (
        <Section key={cat} title={capitalize(CATEGORY_STYLE[cat].label)}>
          <div className="mt-1">
            {metricsByCategory.get(cat)!.map((m) => <MetricRow key={m.metric_key} metric={m} />)}
          </div>
        </Section>
      ))}

      {s.metrics.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Cada medición se compara con la anterior de {nombre}. Nunca con otros niños.
        </p>
      )}
    </PaginaHijo>
  );
}
