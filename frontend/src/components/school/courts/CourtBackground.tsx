/**
 * Fondo de cancha según el deporte (T4, docs/specs/pizarra-nivel-tacticalpad.md).
 * Misma firma que FootballPitchBackground + `sport`: el tablero, el LineupModal
 * y TacticalStaticSvg cambian una línea para soportar todos los deportes.
 *
 * Fútbol 11 sigue siendo EXACTAMENTE FootballPitchBackground (envuelto, sin
 * tocar su dibujo), así las jugadas y los PDF viejos salen idénticos.
 */
import type { ComponentType } from 'react';
import { FootballPitchBackground } from '../FootballPitchBackground';
import { DEFAULT_SPORT, isTacticalSport, type TacticalSport } from '@/lib/school/tacticalSports';
import type { CourtBackgroundProps } from './courtGeometry';
import { BasketballCourtBackground } from './BasketballCourtBackground';
import { FutsalCourtBackground } from './FutsalCourtBackground';
import { GenericCourtBackground } from './GenericCourtBackground';
import { HandballCourtBackground } from './HandballCourtBackground';
import { Football5CourtBackground, Football7CourtBackground } from './SmallFootballCourtBackground';
import { VolleyballCourtBackground } from './VolleyballCourtBackground';
import { BadmintonCourtBackground, BeachVolleyballCourtBackground, PadelCourtBackground, TennisCourtBackground } from './NetCourtBackgrounds';
import { AmericanFootballCourtBackground, FieldHockeyCourtBackground, RugbyCourtBackground, UltimateCourtBackground } from './FieldCourtBackgrounds';
import { NetballCourtBackground, RinkHockeyCourtBackground, WaterPoloCourtBackground } from './RinkPoolCourtBackgrounds';

/** Fútbol 11 con el nombre de la familia *CourtBackground. */
export function FootballCourtBackground({ viewBox }: CourtBackgroundProps = {}) {
  return <FootballPitchBackground viewBox={viewBox} />;
}

const COURT_BACKGROUNDS: Record<TacticalSport, ComponentType<CourtBackgroundProps>> = {
  futbol: FootballCourtBackground,
  futbol7: Football7CourtBackground,
  futbol5: Football5CourtBackground,
  futsal: FutsalCourtBackground,
  voleibol: VolleyballCourtBackground,
  baloncesto: BasketballCourtBackground,
  balonmano: HandballCourtBackground,
  rugby: RugbyCourtBackground,
  futbol_americano: AmericanFootballCourtBackground,
  tenis: TennisCourtBackground,
  padel: PadelCourtBackground,
  badminton: BadmintonCourtBackground,
  voley_playa: BeachVolleyballCourtBackground,
  hockey_cesped: FieldHockeyCourtBackground,
  hockey_patines: RinkHockeyCourtBackground,
  netball: NetballCourtBackground,
  waterpolo: WaterPoloCourtBackground,
  ultimate: UltimateCourtBackground,
  generico: GenericCourtBackground,
};

export function CourtBackground({ sport, viewBox }: CourtBackgroundProps & { sport?: TacticalSport | null }) {
  const Bg = COURT_BACKGROUNDS[isTacticalSport(sport) ? sport : DEFAULT_SPORT];
  return viewBox === undefined ? <Bg /> : <Bg viewBox={viewBox} />;
}
