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

/** % del tablero → unidades del canvas. Por defecto el viewBox 300×340; con
 *  el «Campo» de M6d (cámara/orientación) el que llama pasa su `place`. */
export type PlaceFn = (xPct: number, yPct: number) => { x: number; y: number };
const DEFAULT_PLACE: PlaceFn = (x, y) => ({ x: x * 3, y: y * 3.4 });

function polyline(ctx: CanvasRenderingContext2D, raw: Pt[], color: string, width: number, dash: number[] | null, place: PlaceFn) {
  const points = raw.map((p) => place(p.x, p.y));
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
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

function passLine(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, place: PlaceFn) {
  const a = place(from.x, from.y); const b = place(to.x, to.y);
  const x1 = a.x; const y1 = a.y; const x2 = b.x; const y2 = b.y;
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
  place: PlaceFn = DEFAULT_PLACE,
  colors: { home: string; away: string } = TRAIL_COLORS,
): void {
  for (const p of passesUntil(frames, tMs, durationOf)) passLine(ctx, p.from, p.to, place);
  if (!opts) return;
  for (const tr of playerTrailsAt(frames, tMs, opts.curve, durationOf, { home: opts.routeHome, away: opts.routeAway })) {
    polyline(ctx, tr.points, tr.team === 'home' ? colors.home : colors.away, 2.2, null, place);
  }
  if (opts.ballTrail) {
    const pts = ballTrailAt(frames, tMs, opts.curve, durationOf);
    if (pts.length >= 2) polyline(ctx, pts, TRAIL_COLORS.ball, 1.6, opts.ballTrailDashed ? [4, 3] : null, place);
  }
}
