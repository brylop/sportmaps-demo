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
import { CourtConfigContext } from './courtLook';
import { CourtTemplateOverlay } from './CourtTemplateOverlay';
import { isDefaultCourt, type CourtConfig } from '@/lib/school/tacticalCourt';

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
  generico: GenericCourtBackground,
};

/** `court` (M6d, diálogo «Campo»): piso, colores y plantilla de líneas. Sin él
 *  (o con la configuración de siempre) la salida es la de antes, idéntica. */
export function CourtBackground({ sport, viewBox, court }: CourtBackgroundProps & { sport?: TacticalSport | null; court?: CourtConfig | null }) {
  const Bg = COURT_BACKGROUNDS[isTacticalSport(sport) ? sport : DEFAULT_SPORT];
  const bg = viewBox === undefined ? <Bg /> : <Bg viewBox={viewBox} />;
  if (!court || isDefaultCourt(court)) return bg;
  return (
    <CourtConfigContext.Provider value={court}>
      {bg}
      <CourtTemplateOverlay sport={sport} court={court} viewBox={viewBox} />
    </CourtConfigContext.Provider>
  );
}
