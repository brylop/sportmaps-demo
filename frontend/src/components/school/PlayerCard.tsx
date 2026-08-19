/**
 * Tarjeta de jugador (P1 del módulo de fútbol) — radar + destacados/a-trabajar
 * a partir de datos que YA están cargados donde se abre (roster del equipo),
 * sin pedir nada nuevo al BFF. Pensada para reusarse desde el tablero táctico
 * y desde el roster en general (docs/specs/football-tactical-experience.md).
 *
 * El radar normaliza por BANDA (verde/amarillo/rojo), no por el valor crudo:
 * las métricas tienen escalas y unidades distintas (segundos, repeticiones,
 * %), así que graficar valores crudos en el mismo eje no dice nada. Es una
 * normalización categórica simple (verde=85, amarillo=55, rojo=25), no una
 * interpolación fina dentro de la banda -- alcanza para "dónde está fuerte y
 * dónde no" de un vistazo, que es el objetivo de la tarjeta.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { BAND_STYLE, fmtWithUnit } from '@/lib/school/performanceDisplay';
import { computeMetricBand, type SportMetricDefinition, type MetricBand, type RosterSubject } from '@/lib/school/performanceQueries';

interface PlayerCardProps {
  open: boolean;
  onClose: () => void;
  subject: RosterSubject;
  metrics: SportMetricDefinition[];
  latestValues: Record<string, { value: number; recorded_at: string; band?: MetricBand }>;
}

const BAND_SCORE: Record<NonNullable<MetricBand>, number> = { green: 85, yellow: 55, red: 25 };

function initialsOf(name: string) {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function PlayerCard({ open, onClose, subject, metrics, latestValues }: PlayerCardProps) {
  const measured = metrics
    .map((m) => {
      const lv = latestValues[`${subject.subject_id}:${m.metric_key}`];
      if (!lv) return null;
      const band = lv.band ?? computeMetricBand(lv.value, m.thresholds);
      return { metric: m, value: lv.value, band, recordedAt: lv.recorded_at };
    })
    .filter((x): x is { metric: SportMetricDefinition; value: number; band: MetricBand; recordedAt: string } => x !== null);

  const radarData = measured.map((m) => ({
    label: m.metric.parent_label || m.metric.display_name,
    score: m.band ? BAND_SCORE[m.band] : 50,
  }));

  const highlights = measured.filter((m) => m.band === 'green');
  const toWork = measured.filter((m) => m.band === 'red' || m.band === 'yellow');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={subject.avatar_url ?? undefined} />
              <AvatarFallback>{initialsOf(subject.full_name)}</AvatarFallback>
            </Avatar>
            {subject.full_name}
          </DialogTitle>
          <DialogDescription>
            {measured.length === 0
              ? 'Sin mediciones registradas todavía.'
              : `${measured.length} ${measured.length === 1 ? 'métrica medida' : 'métricas medidas'}`}
          </DialogDescription>
        </DialogHeader>

        {measured.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Cuando se registre al menos una medición para este jugador, acá va a aparecer su radar y sus destacados.
          </p>
        ) : (
          <>
            <div className="h-52 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {highlights.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1 ${BAND_STYLE.green.chip.split(' ')[0]}`}>Lo que más destaca</p>
                <ul className="space-y-1">
                  {highlights.map((m) => (
                    <li key={m.metric.metric_key} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.metric.parent_label || m.metric.display_name}</span>
                      <span className="font-semibold shrink-0">{fmtWithUnit(m.value, m.metric.unit)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {toWork.length > 0 && (
              <div>
                <p className={`text-xs font-semibold mb-1 ${BAND_STYLE.yellow.chip.split(' ')[0]}`}>En qué trabajar</p>
                <ul className="space-y-1">
                  {toWork.map((m) => (
                    <li key={m.metric.metric_key} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.metric.parent_label || m.metric.display_name}</span>
                      <span className="font-semibold shrink-0">{fmtWithUnit(m.value, m.metric.unit)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
