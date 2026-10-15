/**
 * «Equipos almacenados» (M6b): rivales guardados por escuela en el BFF
 * (/api/v1/school/tactical-rival-teams; tabla tactical_rival_teams, migración
 * 20261014162158). Solo número y alias en la plantilla; escudo genérico.
 */
import { bffClient } from '@/lib/api/bffClient';
import {
  normRoster, type RivalRosterEntry, type TacticalAwayConfig, type TeamChipStyle, type TeamCrest,
} from './tacticalTeams';

export interface RivalTeam {
  id: string;
  school_id: string;
  name: string;
  short_name: string | null;
  color_primary: string;
  color_secondary: string;
  color_number: string;
  crest: TeamCrest;
  chip_style: TeamChipStyle;
  roster: RivalRosterEntry[];
  created_at?: string;
  updated_at?: string;
}

export type RivalTeamInput = Omit<RivalTeam, 'id' | 'school_id' | 'created_at' | 'updated_at'>;

const BASE = '/api/v1/school/tactical-rival-teams';

export const listRivalTeams = () => bffClient.get<RivalTeam[]>(BASE);
export const createRivalTeam = (body: RivalTeamInput) => bffClient.post<RivalTeam>(BASE, body);
export const updateRivalTeam = (id: string, body: Partial<RivalTeamInput>) => bffClient.patch<RivalTeam>(`${BASE}/${id}`, body);
export const deleteRivalTeam = (id: string) => bffClient.delete<void>(`${BASE}/${id}`);

/** Configuración del rival de la jugada → cuerpo de «Guardar este rival». */
export function rivalInputFrom(away: TacticalAwayConfig): RivalTeamInput {
  const crest: TeamCrest = away.crest.kind === 'generated' ? away.crest : { kind: 'generated', shape: 'shield', design: 'plain', initials: '' };
  const short = crest.kind === 'generated' && crest.initials ? crest.initials.slice(0, 4) : null;
  return {
    name: away.name.trim() || 'Rival',
    short_name: short,
    color_primary: away.colors.primary,
    color_secondary: away.colors.secondary,
    color_number: away.colors.number,
    crest,
    chip_style: away.chip_style,
    roster: away.roster,
  };
}

/** Rival guardado → configuración del equipo de afuera (conserva lo que no
 *  vive en el rival guardado: qué mostrar, portero). */
export function applyRivalTeam(away: TacticalAwayConfig, r: RivalTeam): TacticalAwayConfig {
  return {
    ...away,
    name: r.name,
    crest: r.crest?.kind === 'generated' ? r.crest : away.crest,
    colors: { primary: r.color_primary, secondary: r.color_secondary, number: r.color_number },
    chip_style: r.chip_style,
    roster: normRoster(r.roster),
    rival_team_id: r.id,
  };
}
