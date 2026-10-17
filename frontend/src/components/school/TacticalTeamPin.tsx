/**
 * M6b: lo que la pizarra (PitchPin / PlaybackPin) dibuja en lugar del disco o
 * la silueta de siempre cuando la jugada tiene «Configuración de los equipos».
 * Mismo SVG que las exportaciones (tacticalTeamGlyphs.tsx), en HTML.
 */
import type { ReactNode } from 'react';
import { chipInnerText, chipLook, type ChipSubject, type TacticalTeamsConfig } from '@/lib/school/tacticalTeams';
import { TeamChipGlyph } from './tacticalTeamGlyphs';

/** El pin de siempre mide 44 px; el tamaño global lo multiplica. */
const PIN_PX = 44;

export function TeamPinVisual({ teams, isGK, subject, dragging, onClick, children }: {
  teams: TacticalTeamsConfig;
  isGK: boolean;
  subject: ChipSubject;
  dragging?: boolean;
  onClick?: () => void;
  /** Insignias encima (goles/asistencias). */
  children?: ReactNode;
}) {
  const px = Math.round(PIN_PX * teams.player_scale);
  const look = chipLook(teams.home, isGK);
  return (
    <div
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      className={`relative cursor-pointer transition-transform drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] ${dragging ? 'scale-110' : ''}`}
      style={{ width: px, height: Math.round(px * 1.05) }}
      data-team-pin={look.style}
    >
      <svg viewBox="-12.5 -13 25 26" className="h-full w-full overflow-visible" aria-hidden="true">
        <TeamChipGlyph look={look} text={chipInnerText(teams.home, subject)} r={11} />
      </svg>
      {children}
    </div>
  );
}
