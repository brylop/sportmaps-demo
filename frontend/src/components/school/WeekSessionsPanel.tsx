/**
 * WeekSessionsPanel — "Sesiones de la semana" para el owner/admin.
 *
 * Pedido de Club Carmel (2026-09-18): "ver las sesiones que crean los
 * entrenadores". La página ya las mostraba, pero equipo por equipo: había que
 * saber qué equipo mirar. Acá salen todas las sesiones de todos los equipos de
 * la escuela para una semana, con su entrenador, y un clic salta al detalle del
 * equipo. Solo lectura: no crea ni edita nada.
 *
 * Fuente: `training_sessions` (contenido de la sesión) — NO `attendance_sessions`
 * (pasar lista), que es otra cosa aunque se llame parecido.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, ClipboardList, ArrowRight } from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamLite {
  id: string;
  name: string;
  coach_id?: string | null;
  team_coaches?: { coach_id: string }[] | null;
}

interface WeekSessionsPanelProps {
  schoolId: string;
  teams: TeamLite[];
  onSelectTeam: (teamId: string) => void;
}

interface SessionRow {
  id: string;
  team_id: string;
  session_date: string;
  objectives: unknown;
  session_blocks: unknown;
  microcycle_day_id: string | null;
}

const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');

const objectiveText = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string').join(' · ');
  return '';
};

export function WeekSessionsPanel({ schoolId, teams, onSelectTeam }: WeekSessionsPanelProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Semana lunes→domingo. Se calcula en la zona del navegador: la fecha de la
  // sesión es un `date` sin hora, así que un desfase de horas no la mueve de día.
  const { from, to, days } = useMemo(() => {
    const monday = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
    const list = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    return { from: toYmd(monday), to: toYmd(list[6]), days: list };
  }, [weekOffset]);

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const coachIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of teams) {
      if (t.coach_id) ids.add(t.coach_id);
      for (const tc of t.team_coaches ?? []) if (tc.coach_id) ids.add(tc.coach_id);
    }
    return [...ids];
  }, [teams]);

  const { data: coachNames } = useQuery({
    queryKey: ['week-sessions-coaches', schoolId, coachIds.join(',')],
    queryFn: async () => {
      if (coachIds.length === 0) return {} as Record<string, string>;
      // teams.coach_id y team_coaches.coach_id son school_staff.id (no auth.uid()).
      const { data, error } = await supabase
        .from('school_staff')
        .select('id, full_name')
        .in('id', coachIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((s: any) => [s.id, s.full_name])) as Record<string, string>;
    },
    enabled: coachIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['week-sessions', schoolId, from, to, teamIds.join(',')],
    queryFn: async () => {
      if (teamIds.length === 0) return [] as SessionRow[];
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, team_id, session_date, objectives, session_blocks, microcycle_day_id')
        .in('team_id', teamIds)
        .gte('session_date', from)
        .lte('session_date', to)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return (data || []) as SessionRow[];
    },
    enabled: teamIds.length > 0,
  });

  const coachLabel = (team: TeamLite | undefined): string => {
    if (!team) return '';
    const names = new Set<string>();
    if (team.coach_id && coachNames?.[team.coach_id]) names.add(coachNames[team.coach_id]);
    for (const tc of team.team_coaches ?? []) {
      if (coachNames?.[tc.coach_id]) names.add(coachNames[tc.coach_id]);
    }
    return [...names].join(', ');
  };

  const byDay = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    for (const s of sessions ?? []) {
      const list = map.get(s.session_date) ?? [];
      list.push(s);
      map.set(s.session_date, list);
    }
    return map;
  }, [sessions]);

  const total = sessions?.length ?? 0;
  const rangeLabel = `${format(days[0], 'd MMM', { locale: es })} – ${format(days[6], 'd MMM', { locale: es })}`;

  return (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Sesiones de la semana
          </CardTitle>
          <CardDescription>
            {rangeLabel} · {total} sesi{total === 1 ? 'ón' : 'ones'} en {teams.length} equipo{teams.length === 1 ? '' : 's'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>
            Esta semana
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Semana siguiente" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 text-center">
            <ClipboardList className="w-8 h-8 opacity-30" />
            <p className="text-sm">Ningún entrenador cargó sesiones esta semana.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((d) => {
              const key = toYmd(d);
              const list = byDay.get(key);
              if (!list || list.length === 0) return null;
              return (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {format(d, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                  <ul className="space-y-2">
                    {list.map((s) => {
                      const team = teamById.get(s.team_id);
                      const coach = coachLabel(team);
                      const objective = objectiveText(s.objectives);
                      const blocks = Array.isArray(s.session_blocks) ? s.session_blocks.length : 0;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onSelectTeam(s.team_id)}
                            className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors
                                       hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-medium truncate">{team?.name ?? 'Equipo'}</span>
                                {coach && <span className="text-xs text-muted-foreground truncate">· {coach}</span>}
                                {s.microcycle_day_id && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Mesociclo</Badge>
                                )}
                                {blocks > 0 && (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{blocks} bloque{blocks === 1 ? '' : 's'}</Badge>
                                )}
                              </div>
                              {objective && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{objective}</p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
