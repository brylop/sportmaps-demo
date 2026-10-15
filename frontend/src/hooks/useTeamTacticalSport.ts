/**
 * Deporte de la pizarra táctica para un equipo (T4 de
 * docs/specs/pizarra-nivel-tacticalpad.md). Las pantallas que abren la
 * pizarra (LineupModal, SessionFormDialog, FootballDashboardModal,
 * WeekSessionsPanel, SessionViewer, TrainingPlansPage…) solo tienen `teamId`:
 * en vez de agregar `sport` al select de cada una, la pizarra lo pide aquí
 * una vez por equipo (teams.sport + nombre, que sportFromTeam interpreta) y
 * react-query lo comparte entre todas.
 *
 * Trae también `school_id`: la métrica de uso (T0) se registra en la escuela
 * del EQUIPO, no en la escuela activa del selector.
 *
 * Sin equipo, sin permiso o con error → fútbol (comportamiento de siempre).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SPORT, sportFromTeam, type TacticalSport } from '@/lib/school/tacticalSports';

export interface TeamTacticalSport {
  sport: TacticalSport;
  schoolId: string | null;
  isLoading: boolean;
}

interface TeamSportRow {
  id: string;
  name: string | null;
  sport: string | null;
  school_id: string | null;
}

export const teamTacticalSportKey = (teamId: string | null | undefined) => ['team-tactical-sport', teamId ?? null] as const;

export async function fetchTeamSportRow(teamId: string): Promise<TeamSportRow | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, sport, school_id')
    .eq('id', teamId)
    .maybeSingle();
  if (error) return null;
  return (data as TeamSportRow | null) ?? null;
}

export function useTeamTacticalSport(teamId: string | null | undefined, opts: { enabled?: boolean } = {}): TeamTacticalSport {
  const enabled = !!teamId && opts.enabled !== false;
  const { data, isLoading } = useQuery({
    queryKey: teamTacticalSportKey(teamId),
    queryFn: () => fetchTeamSportRow(teamId as string),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  return {
    sport: data ? sportFromTeam(data) : DEFAULT_SPORT,
    schoolId: data?.school_id ?? null,
    isLoading: enabled && isLoading,
  };
}
