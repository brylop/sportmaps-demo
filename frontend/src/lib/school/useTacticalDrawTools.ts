/**
 * M6d — estado de las herramientas nuevas de dibujo (estilo de línea, forma de
 * zona, numeración automática) y del polígono en construcción. Hooks aparte de
 * TacticalBoard.tsx para que la pizarra solo tenga el punto de enganche.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { TacticalArrow } from './footballQueries';
import type { ArrowPoint } from './tacticalGeometry';
import {
  buildPolygonZone, POLYGON_MAX_POINTS, type DrawOptions, type LineStyle, type ZoneForm,
} from './tacticalDrawing';

export function useTacticalDrawTools(snapTargets: ArrowPoint[]) {
  const [lineStyle, setLineStyle] = useState<LineStyle | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>('rect');
  const [autoNumber, setAutoNumber] = useState(false);
  const drawOptions: DrawOptions = useMemo(
    () => ({ lineStyle, zoneForm, autoNumber, snapTargets }),
    [lineStyle, zoneForm, autoNumber, snapTargets],
  );
  return { lineStyle, setLineStyle, zoneForm, setZoneForm, autoNumber, setAutoNumber, drawOptions };
}
export type TacticalDrawTools = ReturnType<typeof useTacticalDrawTools>;

/** Distancia (en % de cancha, medida en espacio SVG) a la que tocar el primer
 *  vértice cierra el polígono. */
export const POLYGON_CLOSE_PCT = 3.5;

export function closesPolygon(points: ArrowPoint[], p: ArrowPoint): boolean {
  if (points.length < 3) return false;
  const f = points[0];
  return Math.hypot((p.x - f.x) * 3, (p.y - f.y) * 3.4) <= POLYGON_CLOSE_PCT * 3.2;
}

/** Polígono por toques: cada toque agrega un vértice; tocar el primero (o
 *  llegar al tope, o «Cerrar») lo crea. */
export function usePolygonDraft(onCreate: (shape: TacticalArrow) => void, color: TacticalArrow['color']) {
  const [points, setPoints] = useState<ArrowPoint[]>([]);
  const [cursor, setCursor] = useState<ArrowPoint | null>(null);
  const ref = useRef(points);
  ref.current = points;
  const finish = useCallback((pts: ArrowPoint[]) => {
    const shape = buildPolygonZone(pts, color);
    setPoints([]);
    setCursor(null);
    if (shape) onCreate(shape);
  }, [onCreate, color]);
  const add = useCallback((p: ArrowPoint) => {
    const cur = ref.current;
    if (closesPolygon(cur, p)) { finish(cur); return; }
    const next = [...cur, p];
    if (next.length >= POLYGON_MAX_POINTS) { finish(next); return; }
    setPoints(next);
  }, [finish]);
  const close = useCallback(() => finish(ref.current), [finish]);
  const cancel = useCallback(() => { setPoints([]); setCursor(null); }, []);
  return { points, cursor, setCursor, add, close, cancel, active: points.length > 0 };
}
