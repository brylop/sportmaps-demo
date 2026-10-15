/**
 * M6b «Configuración de los equipos»: estado de la pizarra + «Equipos
 * almacenados». La pizarra solo engancha: guarda `teams` con la jugada, lo
 * pone en TacticalTeamsContext (lo leen los pines y la capa de dibujo) y abre
 * el diálogo. Sin configuración (null) todo se dibuja como siempre.
 */
import { createContext, useCallback, useContext, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeTeamsConfig, type TacticalTeamsConfig } from '@/lib/school/tacticalTeams';
import {
  createRivalTeam, deleteRivalTeam, listRivalTeams, updateRivalTeam, type RivalTeamInput,
} from '@/lib/school/tacticalRivalTeams';

export interface BoardTeamsContextValue {
  teams: TacticalTeamsConfig;
  /** ¿El deporte tiene arquero? (para reconocer al del rival). */
  hasGoalkeeper: boolean;
}
export const TacticalTeamsContext = createContext<BoardTeamsContextValue | null>(null);

/** Configuración de equipos de la jugada abierta (null = aspecto de siempre). */
export function useTeamsConfig(): TacticalTeamsConfig | null {
  return useContext(TacticalTeamsContext)?.teams ?? null;
}
export function useTeamsContext(): BoardTeamsContextValue | null {
  return useContext(TacticalTeamsContext);
}

export function useBoardTeams() {
  const [teams, setTeams] = useState<TacticalTeamsConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Lo guardado con la jugada (jsonb tal cual) → estado. */
  const load = useCallback((raw: unknown) => setTeams(normalizeTeamsConfig(raw)), []);
  return { teams, setTeams, load, dialogOpen, setDialogOpen };
}

const KEY = ['tactical-rival-teams'];

export function useRivalTeams(enabled: boolean) {
  return useQuery({ queryKey: KEY, queryFn: listRivalTeams, enabled, staleTime: 60_000, retry: false });
}

export function useSaveRivalTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string | null; body: RivalTeamInput }) => (id ? updateRivalTeam(id, body) : createRivalTeam(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRivalTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRivalTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
