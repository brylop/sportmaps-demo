/**
 * Rastros de la animación en canvas (M6g) para el GIF y el video: los mismos
 * que dibuja la capa 2D (TacticalPlaybackTrails), calculados con la misma
 * lógica pura (lib/school/tacticalTrails.ts + tacticalPossession.ts).
 * Dibuja en unidades del viewBox 300×340: el ctx ya viene escalado.
 */
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalPlaybackOptions } from '@/lib/school/tacticalBoardSettings';
import { passesUntil, type Pt } from '@/lib/school/tacticalPossession';
import { TRAIL_COLORS, ballTrailAt, playerTrailsAt, trailSegmentOpacity } from '@/lib/school/tacticalTrails';

const vx = (p: Pt) => p.x * 3;
const vy = (p: Pt) => p.y * 3.4;

function polyline(ctx: CanvasRenderingContext2D, points: Pt[], color: string, width: number, dash: number[] | null) {
  const n = points.length - 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash ?? []);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = trailSegmentOpacity(i, n);
    ctx.beginPath();
    ctx.moveTo(vx(points[i]), vy(points[i]));
    ctx.lineTo(vx(points[i + 1]), vy(points[i + 1]));
    ctx.stroke();
  }
  ctx.restore();
}

function passLine(ctx: CanvasRenderingContext2D, from: Pt, to: Pt) {
  const x1 = vx(from); const y1 = vy(from); const x2 = vx(to); const y2 = vy(to);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = TRAIL_COLORS.pass;
  ctx.fillStyle = TRAIL_COLORS.pass;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 6 * Math.cos(ang - 0.4), y2 - 6 * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - 6 * Math.cos(ang + 0.4), y2 - 6 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Rutas, trayectoria del balón y pases en el instante `tMs` de la jugada. */
export function drawPlaybackTrails(
  ctx: CanvasRenderingContext2D,
  frames: TacticalFrame[],
  tMs: number,
  opts: TacticalPlaybackOptions | undefined,
  durationOf: (f: TacticalFrame) => number,
): void {
  for (const p of passesUntil(frames, tMs, durationOf)) passLine(ctx, p.from, p.to);
  if (!opts) return;
  for (const tr of playerTrailsAt(frames, tMs, opts.curve, durationOf, { home: opts.routeHome, away: opts.routeAway })) {
    polyline(ctx, tr.points, tr.team === 'home' ? TRAIL_COLORS.home : TRAIL_COLORS.away, 2.2, null);
  }
  if (opts.ballTrail) {
    const pts = ballTrailAt(frames, tMs, opts.curve, durationOf);
    if (pts.length >= 2) polyline(ctx, pts, TRAIL_COLORS.ball, 1.6, opts.ballTrailDashed ? [4, 3] : null);
  }
}
