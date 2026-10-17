/**
 * Banco de pruebas del visor 3D (e2e/pizarra-3d-camaras.spec.ts). Monta el
 * MISMO Tactical3DViewer de la pizarra con jugadas fijas por deporte.
 *
 *   /e2e/harness/visor-3d.html?sport=futbol&cam=tv&t=1500&director=1
 *
 * `window.__harness` abre y cierra el visor (prueba de fugas) y expone la
 * contabilidad de recursos de GPU (tactical3dStats).
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import Tactical3DViewer from '@/components/school/tactical3d/Tactical3DViewer';
import { tactical3dStats } from '@/components/school/tactical3d/resources';
import { court3D, type Court3D } from '@/lib/school/tactical3d';
import type { CameraKind } from '@/lib/school/tactical3dCameras';
import { BOARD_H, BOARD_W, type TacticalSport } from '@/lib/school/tacticalSports';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

type P = Record<string, [number, number]>;

const pct = (c: Court3D, x: number, z: number) => ({
  x: ((x * c.sx + BOARD_W / 2) / BOARD_W) * 100,
  y: ((z * c.sy + BOARD_H / 2) / BOARD_H) * 100,
});

function build(c: Court3D, steps: { ms: number; players: P; ball: [number, number] }[]): TacticalFrame[] {
  return steps.map((s, i) => ({
    id: `f${i}`,
    duration_ms: s.ms,
    players: Object.entries(s.players).map(([key, [x, z]]) => ({ key, ...pct(c, x, z) })),
    ball: pct(c, s.ball[0], s.ball[1]),
    arrows: [],
  }));
}

/** Desplaza a todos (menos los dados) dz metros. */
const shift = (p: P, dz: number, moves: P = {}): P =>
  Object.fromEntries(Object.entries(p).map(([k, [x, z]]) => [k, moves[k] ?? [x, z + dz]]));

interface Play { frames: TacticalFrame[]; labels: Record<string, string>; jerseys: Record<string, number> }

function futbol(): Play {
  const c = court3D('futbol');
  const f0: P = {
    gk: [0, 49], ld: [24, 30], dc1: [8, 35], dc2: [-8, 35], li: [-24, 30],
    mc: [0, 22], mi: [-14, 16], md: [14, 16], ei: [-24, 2], dc: [0, 0], ed: [22, 2],
  };
  const f1 = shift(f0, -3, { mc: [0, 20] });
  const f2 = shift(f1, -6, { ei: [-24, -15], mc: [-2, 12] });
  const f3 = shift(f2, -4, { ei: [-14, -30], dc: [2, -36], ed: [16, -32], gk: [0, 40] });
  const f4 = shift(f3, -1, { ei: [-12, -31], dc: [3, -42], gk: [0, 40] });
  const frames = build(c, [
    { ms: 1000, players: f0, ball: [8, 35] },
    { ms: 1200, players: f1, ball: [0, 20] }, // pase corto
    { ms: 1600, players: f2, ball: [-24, -15] }, // cambio de frente largo
    { ms: 1400, players: f3, ball: [-13, -30] }, // conducción
    { ms: 900, players: f4, ball: [3, -52.3] }, // remate
  ]);
  const labels = { gk: 'Arquero', ld: 'Lateral der.', dc1: 'Central', dc2: 'Central', li: 'Lateral izq.', mc: 'Volante', mi: 'Interior', md: 'Interior', ei: 'Extremo izq.', dc: 'Delantero', ed: 'Extremo der.' };
  const jerseys = { gk: 1, ld: 2, dc1: 4, dc2: 3, li: 6, mc: 5, mi: 8, md: 10, ei: 11, dc: 9, ed: 7 };
  return { frames, labels, jerseys };
}

function voleibol(): Play {
  const c = court3D('voleibol');
  const f0: P = { s: [3, 7.5], z1: [-3, 6], c1: [0, 6.5], o: [3, 3], c2: [0, 2.5], z2: [-3, 2.5] };
  const f1 = { ...f0, c1: [0, 6.5] } as P;
  const f2 = { ...f1, s: [1.5, 1.2], z2: [-3, 3.5] } as P;
  const f3 = { ...f2, z2: [-3, 1] } as P;
  const frames = build(c, [
    { ms: 1000, players: f0, ball: [2, -8.6] }, // saque rival
    { ms: 1300, players: f1, ball: [0, 6.3] }, // recepción
    { ms: 1100, players: f2, ball: [1.5, 1.1] }, // colocación
    { ms: 900, players: f3, ball: [-2.8, 1.2] }, // armado al ataque
    { ms: 700, players: f3, ball: [-1.5, -6] }, // remate
  ]);
  const labels = { s: 'Armador', z1: 'Receptor', c1: 'Líbero', o: 'Opuesto', c2: 'Central', z2: 'Atacante' };
  const jerseys = { s: 2, z1: 4, c1: 7, o: 9, c2: 11, z2: 13 };
  return { frames, labels, jerseys };
}

function baloncesto(): Play {
  const c = court3D('baloncesto');
  const f0: P = { b: [0, 4], e: [-5, -2], a: [5, -2], ap: [-2, -8], p: [2, -9] };
  const f1: P = { b: [0, -1], e: [-6, -6], a: [5, -4], ap: [-2, -8], p: [2, -9] };
  const f2: P = { b: [1, -3], e: [-6, -7], a: [5, -5], ap: [-1, -10.5], p: [3, -10] };
  const frames = build(c, [
    { ms: 1000, players: f0, ball: [0, 4] },
    { ms: 1300, players: f1, ball: [0, -1] }, // sube el base
    { ms: 900, players: f1, ball: [-6, -6] }, // pase al escolta
    { ms: 1000, players: f2, ball: [-1, -10.4] }, // pase al poste
    { ms: 900, players: f2, ball: [0, -12.43] }, // tiro al aro
  ]);
  const labels = { b: 'Base', e: 'Escolta', a: 'Alero', ap: 'Ala-pívot', p: 'Pívot' };
  const jerseys = { b: 1, e: 2, a: 3, ap: 4, p: 5 };
  return { frames, labels, jerseys };
}

const PLAYS: Record<string, () => Play> = { futbol, voleibol, baloncesto };

const q = new URLSearchParams(location.search);
const sport = (q.get('sport') ?? 'futbol') as TacticalSport;
const play = (PLAYS[sport] ?? futbol)();

function App() {
  const [open, setOpen] = useState(q.get('closed') !== '1');
  const [fallback, setFallback] = useState<string | null>(null);
  (window as unknown as { __harness: unknown }).__harness = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    stats: tactical3dStats,
    frames: play.frames,
  };
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {fallback && <p data-testid="harness-fallback" style={{ color: 'white' }}>Caída a 2D: {fallback}</p>}
      {open && (
        <Tactical3DViewer
          sport={sport}
          frames={play.frames}
          playerLabels={play.labels}
          playerJerseys={play.jerseys}
          title={`Jugada de prueba · ${sport}`}
          onClose={() => setOpen(false)}
          onFallback={(r) => setFallback(r)}
          minFps={0}
          initialCamera={(q.get('cam') as CameraKind) ?? 'tv'}
          initialTimeMs={Number(q.get('t') ?? 0)}
          autoPlay={q.get('autoplay') === '1'}
          initialDirector={q.get('director') === '1'}
        />
      )}
    </div>
  );
}

// Como la app (main.tsx): en StrictMode. ?strict=0 lo apaga (diagnóstico).
createRoot(document.getElementById('root')!).render(q.get('strict') === '0' ? <App /> : <StrictMode><App /></StrictMode>);
