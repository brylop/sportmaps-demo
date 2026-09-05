import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import {
  ArrowLeft, School, Users, MessageSquare, CalendarCheck,
  TrendingUp, AlertTriangle, Trophy, Download, Loader2,
} from 'lucide-react';
import { useAthleteReportDetail } from '@/hooks/useAthleteReports';
import { CATEGORY_STYLE, CATEGORY_ORDER, BAND_STYLE, fmtWithUnit } from '@/lib/school/performanceDisplay';
import { downloadAthleteReportPdf, type SnapshotMetric } from '@/lib/school/reportsQueries';
import { useToast } from '@/hooks/use-toast';

function MetricRow({ metric }: { metric: SnapshotMetric }) {
  const band = metric.band ? BAND_STYLE[metric.band] : null;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{metric.label}</p>
        {metric.hint && <p className="text-[11px] text-muted-foreground truncate">{metric.hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {metric.delta !== null && (
          <span className={`text-[11px] font-semibold ${metric.delta > 0 === metric.higher_is_better ? 'text-green-600' : metric.delta === 0 ? 'text-muted-foreground' : 'text-red-600'}`}>
            {metric.delta > 0 ? '+' : ''}{fmtWithUnit(metric.delta, metric.unit)}
          </span>
        )}
        <Badge variant="outline" className={band ? band.chip : ''}>
          {fmtWithUnit(metric.value, metric.unit)}
        </Badge>
      </div>
    </div>
  );
}

export default function ChildReportDetailPage() {
  const { id, reportId } = useParams<{ id: string; reportId: string }>();
  const { data: report, isLoading, error, refetch } = useAthleteReportDetail(reportId);
  const { toast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!reportId) return;
    setDownloadingPdf(true);
    try {
      await downloadAthleteReportPdf(reportId);
    } catch (e: any) {
      toast({ title: 'No se pudo descargar el PDF', description: e?.message, variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando informe..." />;
  }

  if (error || !report) {
    return (
      <ErrorState
        title="Error al cargar el informe"
        message="Hubo un problema al recuperar este informe mensual."
        onRetry={() => refetch()}
      />
    );
  }

  const s = report.snapshot;
  const metricsByCategory = new Map<string, SnapshotMetric[]>();
  for (const m of s.metrics) {
    const cat = m.category ?? 'other';
    if (!metricsByCategory.has(cat)) metricsByCategory.set(cat, []);
    metricsByCategory.get(cat)!.push(m);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to={`/children/${id}/reports`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-2 w-fit">
            <ArrowLeft className="h-3 w-3" /> Volver a informes
          </Link>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{s.period.label}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <School className="h-3.5 w-3.5" /> {s.school.name}
            {s.governing_team && (
              <>
                <span>·</span>
                <Users className="h-3.5 w-3.5" /> {s.governing_team.name}
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleDownloadPdf} disabled={downloadingPdf}>
          {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Descargar PDF
        </Button>
      </div>

      {/* ── Fútbol (si aplica) ─────────────────────────────────────────── */}
      {s.football && (
        <Card className="border-green-600/30 bg-gradient-to-br from-green-600/5 to-transparent overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400 flex items-center gap-1.5 mb-3">
              <Trophy className="h-3.5 w-3.5" /> Fútbol este mes
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
              <div>
                <p className="text-xl font-black">{s.football.matches_played}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Partidos</p>
              </div>
              <div>
                <p className="text-xl font-black">{s.football.minutes_played}'</p>
                <p className="text-[10px] text-muted-foreground uppercase">Minutos</p>
              </div>
              <div>
                <p className="text-xl font-black text-green-600">⚽ {s.football.goals}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Goles</p>
              </div>
              <div>
                <p className="text-xl font-black text-blue-600">🅰️ {s.football.assists}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Asistencias</p>
              </div>
              <div>
                <p className="text-xl font-black text-yellow-600">🟨 {s.football.yellow_cards}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Amarillas</p>
              </div>
              <div>
                <p className="text-xl font-black text-red-700">🟥 {s.football.red_cards}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Rojas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Nota del coach ─────────────────────────────────────────────── */}
      {s.coach_note && (
        <Card>
          <CardContent className="p-4 flex gap-3">
            <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                Nota del entrenador
              </p>
              <p className="text-sm">{s.coach_note}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Notas de equipo ────────────────────────────────────────────── */}
      {s.team_notes.length > 0 && (
        <div className="space-y-2">
          {s.team_notes.map((n) => (
            <Card key={n.team_id}>
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  {n.team_name}
                </p>
                <p className="text-sm">{n.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Asistencia ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              Asistencia: {s.attendance.present} de {s.attendance.total}
              {s.attendance.pct !== null && ` (${s.attendance.pct}%)`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Destacados ─────────────────────────────────────────────────── */}
      {s.highlights.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-green-600" /> Lo mejor del mes
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.highlights.map((m) => (
              <Card key={m.metric_key} className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-3">
                  <MetricRow metric={m} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── A trabajar ─────────────────────────────────────────────────── */}
      {s.to_work_on.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> En qué trabajar
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.to_work_on.map((m) => (
              <Card key={m.metric_key} className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-3">
                  <MetricRow metric={m} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Todas las métricas, por categoría ─────────────────────────── */}
      {CATEGORY_ORDER.filter((cat) => metricsByCategory.has(cat)).map((cat) => (
        <div key={cat}>
          <h2 className="text-sm font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${CATEGORY_STYLE[cat].swatch}`} />
            {CATEGORY_STYLE[cat].label}
          </h2>
          <Card>
            <CardContent className="p-4 divide-y divide-border">
              {metricsByCategory.get(cat)!.map((m) => (
                <MetricRow key={m.metric_key} metric={m} />
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
