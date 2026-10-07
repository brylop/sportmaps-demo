import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { listOpenEpisodes } from '@/lib/clinical/api';
import { clinicalErrorMessage, SPECIALTY_LABEL } from '@/lib/clinical/labels';
import { listEpisodeNoteStats } from '@/lib/clinical/record-extra';

function staleTone(days: number | null) {
  if (days === null) return 'border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400';
  if (days > 14) return 'border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400';
  if (days > 7) return 'border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-400';
  return 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400';
}

export default function FollowUpsPage() {
  const episodesQ = useQuery({ queryKey: ['clinical', 'open-episodes'], queryFn: listOpenEpisodes });
  const ids = useMemo(() => (episodesQ.data ?? []).map((e) => e.id).sort(), [episodesQ.data]);
  const statsQ = useQuery({
    queryKey: ['clinical', 'episode-stats', ids],
    queryFn: () => listEpisodeNoteStats(ids),
    enabled: episodesQ.isSuccess,
  });

  const rows = useMemo(() => {
    const today = new Date();
    const list = (episodesQ.data ?? []).map((e) => {
      const s = statsQ.data?.[e.id];
      const last = s?.lastNoteAt ?? null;
      return {
        ...e,
        sessions: s?.sessions ?? 0,
        lastNoteAt: last,
        daysSince: last ? differenceInCalendarDays(today, parseISO(last)) : null,
      };
    });
    // Primero los que nunca tuvieron nota; luego la última nota más antigua.
    return list.sort((a, b) => {
      if (!a.lastNoteAt && !b.lastNoteAt) return a.opened_at.localeCompare(b.opened_at);
      if (!a.lastNoteAt) return -1;
      if (!b.lastNoteAt) return 1;
      return a.lastNoteAt.localeCompare(b.lastNoteAt);
    });
  }, [episodesQ.data, statsQ.data]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /> Seguimientos</h1>
        <p className="text-sm text-muted-foreground">
          Pacientes en tratamiento. Arriba, los que llevan más tiempo sin una nota.
        </p>
      </div>

      {episodesQ.isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
      ) : episodesQ.isError ? (
        <Card><CardContent className="py-8 text-center space-y-2">
          <p className="text-sm">{clinicalErrorMessage(episodesQ.error)}</p>
          <Button variant="outline" onClick={() => episodesQ.refetch()}>Reintentar</Button>
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-2">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">No tienes tratamientos abiertos</p>
          <p className="text-sm text-muted-foreground">Cuando abras un episodio de atención a un paciente, aparecerá aquí.</p>
          <Button asChild variant="outline" className="mt-2"><Link to="/pacientes">Ir a pacientes</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {statsQ.isError && (
            <p className="text-xs text-destructive">No pudimos contar las sesiones: {clinicalErrorMessage(statsQ.error)}</p>
          )}
          {rows.map((r) => (
            <Link key={r.id} to={`/pacientes/${r.patient_id}`}
              className="block rounded-xl border bg-card hover:bg-accent/50 transition-colors p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium truncate">{r.patient?.full_name ?? 'Paciente'}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {SPECIALTY_LABEL[r.specialty]} · abierto el {format(parseISO(r.opened_at), "d 'de' MMM yyyy", { locale: es })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {statsQ.isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[11px]">
                          {r.sessions}{r.planned_sessions ? `/${r.planned_sessions}` : ''} {r.sessions === 1 && !r.planned_sessions ? 'sesión' : 'sesiones'}
                        </Badge>
                        <Badge variant="outline" className={`text-[11px] ${staleTone(r.daysSince)}`}>
                          {r.daysSince === null ? 'Sin notas aún'
                            : r.daysSince === 0 ? 'Última nota hoy'
                              : `Última nota hace ${r.daysSince} ${r.daysSince === 1 ? 'día' : 'días'}`}
                        </Badge>
                      </>
                    )}
                  </div>
                  {r.planned_sessions ? (
                    <Progress value={Math.min(100, (r.sessions / r.planned_sessions) * 100)} className="h-1.5 max-w-xs" />
                  ) : null}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
