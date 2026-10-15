/**
 * Rastros de la reproducción por cuadros (M6g, «Ajustes de la pizarra»):
 * la ruta que ya recorrió cada jugador (local / visitante), la trayectoria del
 * balón (continua o discontinua) y las líneas de pase cuando el balón cambia
 * de dueño. Va DEBAJO de las fichas en la capa de reproducción.
 *
 * Mismos cálculos que el GIF/video (lib/export/tacticalTrailsCanvas.ts):
 * lib/school/tacticalTrails.ts y tacticalPossession.ts.
 */
import { memo } from 'react';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalPlaybackOptions } from '@/lib/school/tacticalBoardSettings';
import { frameDuration } from '@/lib/school/tacticalAnimation';
import { passesUntil, type Pt } from '@/lib/school/tacticalPossession';
import { TRAIL_COLORS, ballTrailAt, playerTrailsAt, trailSegmentOpacity } from '@/lib/school/tacticalTrails';
import { viewBoxOf, type PitchView } from '@/lib/school/tacticalGeometry';

const vx = (p: Pt) => p.x * 3;
const vy = (p: Pt) => p.y * 3.4;

function Trail({ points, color, width, dashed, testId, dataKey }: { points: Pt[]; color: string; width: number; dashed?: boolean; testId: string; dataKey?: string }) {
  const n = points.length - 1;
  return (
    <g data-testid={testId} data-key={dataKey} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none"
      strokeDasharray={dashed ? '4 3' : undefined}>
      {points.slice(0, -1).map((p, i) => (
        <line key={i} x1={vx(p)} y1={vy(p)} x2={vx(points[i + 1])} y2={vy(points[i + 1])} opacity={trailSegmentOpacity(i, n)} />
      ))}
    </g>
  );
}

export const TacticalPlaybackTrails = memo(function TacticalPlaybackTrails({ frames, t, view, options }: {
  frames: TacticalFrame[];
  t: number;
  view: PitchView;
  options: TacticalPlaybackOptions | undefined;
}) {
  const passes = passesUntil(frames, t, frameDuration);
  const routes = options
    ? playerTrailsAt(frames, t, options.curve, frameDuration, { home: options.routeHome, away: options.routeAway })
    : [];
  const ball = options?.ballTrail ? ballTrailAt(frames, t, options.curve, frameDuration) : [];
  if (passes.length === 0 && routes.length === 0 && ball.length === 0) return null;
  return (
    <svg viewBox={viewBoxOf(view)} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" data-testid="playback-trails">
      <defs>
        <marker id="pass-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={TRAIL_COLORS.pass} />
        </marker>
      </defs>
      {routes.map((r) => (
        <Trail key={r.key} dataKey={r.key} testId={`route-${r.team}`} points={r.points} width={2.2}
          color={r.team === 'home' ? TRAIL_COLORS.home : TRAIL_COLORS.away} />
      ))}
      {ball.length >= 2 && (
        <Trail testId={options?.ballTrailDashed ? 'ball-trail-dashed' : 'ball-trail-solid'} points={ball} width={1.6}
          color={TRAIL_COLORS.ball} dashed={options?.ballTrailDashed} />
      )}
      {passes.map((p) => (
        <line key={`pass${p.toIndex}`} data-testid="pass-line" x1={vx(p.from)} y1={vy(p.from)} x2={vx(p.to)} y2={vy(p.to)}
          stroke={TRAIL_COLORS.pass} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.9} markerEnd="url(#pass-head)" />
      ))}
    </svg>
  );
});
