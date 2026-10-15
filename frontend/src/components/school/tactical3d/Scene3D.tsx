/**
 * Escena del visor 3D: reloj de reproducción, luces, cancha, jugadores,
 * dibujos, cámaras y el medidor de fps. Todo lo que vive DENTRO del <Canvas>.
 *
 * M6e: cámaras de transmisión + director (CameraRig3D), carrera de las figuras
 * (FigureMotion3D), balón en parábola (BallFlight3D), rastro (Trails3D) y foco
 * del cuadro congelado (Spotlight3D). Todo sale del MISMO instante `t`.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { advancePlayback, type PlaybackClock } from '@/lib/school/tacticalAnimation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import {
  computeLive, createFpsMeter,
  type LiveState, type Court3D as Court3DModel, type PlayerVisual,
} from '@/lib/school/tactical3d';
import type { CameraKind, PlayerView } from '@/lib/school/tactical3dCameras';
import { ballArc } from '@/lib/school/tactical3dMotion';
import { Court3D } from './Court3D';
import { LabelDeclutter, Players3D } from './Figures3D';
import type { LiveRef } from './figureKit';
import { Drawings3D } from './Drawings3D';
import { CameraRig3D } from './CameraRig3D';
import { FigureMotion3D } from './FigureMotion3D';
import { BallFlight3D } from './BallFlight3D';
import { Trails3D } from './Trails3D';
import { Spotlight3D } from './Spotlight3D';
import { RecorderTap3D } from './RecorderTap3D';

export interface Scene3DProps {
  court: Court3DModel;
  frames: TacticalFrame[];
  overlayFrames: TacticalFrame[] | null;
  overlayColor: string;
  keys: string[];
  overlayKeys: string[];
  visuals: Record<string, PlayerVisual>;
  overlayVisuals: Record<string, PlayerVisual>;
  clock: PlaybackClock;
  playing: boolean;
  speed: number;
  totalMs: number;
  /** Fin del tramo que se reproduce (la repetición para antes del total). */
  stopAtMs?: number | null;
  onEnded: () => void;
  cameraKind: CameraKind;
  director: boolean;
  playerKey: string | null;
  playerView: PlayerView;
  /** Jugador tocado (aro de selección y foco del congelado). */
  selectedKey: string | null;
  onSelectPlayer: (key: string) => void;
  onShot?: (kind: CameraKind) => void;
  showTrails: boolean;
  frozen: boolean;
  /** Canvas 2D donde se copia cada cuadro mientras se graba el video (null = no se graba). */
  recordTarget: HTMLCanvasElement | null;
  reducedMotion: boolean;
  minFps: number;
  onFpsVerdict: (verdict: 'ok' | 'slow', fps: number, info: { geometries: number; textures: number; programs: number }) => void;
  /** Solo pruebas: escribe el estado de la cámara en window.__TACTICAL3D__. */
  debug?: boolean;
}

export function Scene3D(p: Scene3DProps) {
  const live = useRef<LiveState>(computeLive(p.court, p.frames, p.overlayFrames, p.clock.get())) as LiveRef;
  const playingRef = useRef(p.playing);
  playingRef.current = p.playing;
  const lastT = useRef<number>(-1);
  const end = p.stopAtMs != null ? Math.min(p.stopAtMs, p.totalMs) : p.totalMs;

  // Antes que todos (prioridad negativa no toma el render): avanza el reloj y
  // calcula el instante una vez para todas las capas.
  useFrame((_, delta) => {
    let t = p.clock.get();
    if (playingRef.current) {
      // Grabando: nunca más de 1/30 s de jugada por cuadro dibujado. En un
      // celular lento el video sale más lento, pero con todos los cuadros (si
      // no, el reloj real se comía la jugada en 3 cuadros).
      const dtMs = p.recordTarget ? Math.min(delta * 1000, 1000 / 30) : delta * 1000;
      const next = advancePlayback(t, dtMs, p.speed, end, false);
      t = next.t;
      p.clock.set(t);
      if (next.ended) p.onEnded();
    }
    if (t !== lastT.current) {
      lastT.current = t;
      const lv = computeLive(p.court, p.frames, p.overlayFrames, t);
      lv.ballLift = ballArc(p.court, p.frames, lv.main).lift;
      live.current = lv;
    }
  }, -2);

  // Congelado: la escena se oscurece y el foco se lleva la luz.
  const dim = p.frozen ? 0.35 : 1;

  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <fog attach="fog" args={['#0b1220', p.court.lengthM * 2.2, p.court.lengthM * 6]} />
      <hemisphereLight args={['#f8fafc', '#334155', 1.1 * dim]} />
      <directionalLight position={[-p.court.widthM, p.court.lengthM, p.court.lengthM * 0.4]} intensity={1.6 * dim} />
      <Court3D court={p.court} />
      <Drawings3D court={p.court} live={live} />
      {p.overlayFrames && <Drawings3D court={p.court} live={live} layer="overlay" tint={p.overlayColor} />}
      {p.showTrails && <Trails3D court={p.court} frames={p.frames} keys={p.keys} visuals={p.visuals} live={live} layer="main" />}
      {p.showTrails && p.overlayFrames && <Trails3D court={p.court} frames={p.overlayFrames} keys={p.overlayKeys} visuals={p.overlayVisuals} live={live} layer="overlay" />}
      <Players3D court={p.court} keys={p.keys} visuals={p.visuals} live={live} layer="main" selectedKey={p.selectedKey} onSelect={p.onSelectPlayer} />
      {p.overlayFrames && <Players3D court={p.court} keys={p.overlayKeys} visuals={p.overlayVisuals} live={live} layer="overlay" />}
      <FigureMotion3D court={p.court} frames={p.frames} overlayFrames={p.overlayFrames} live={live} enabled={!p.reducedMotion}
        hideKey={p.cameraKind === 'jugador' && p.playerView === 'pov' && !p.director ? p.playerKey : null} />
      <BallFlight3D court={p.court} live={live} />
      <Spotlight3D court={p.court} live={live} active={p.frozen} selectedKey={p.selectedKey} pulse={!p.reducedMotion} />
      <LabelDeclutter />
      <CameraRig3D
        court={p.court}
        frames={p.frames}
        kind={p.cameraKind}
        director={p.director}
        playerKey={p.playerKey}
        playerView={p.playerView}
        live={live}
        reducedMotion={p.reducedMotion}
        onShot={p.onShot}
      />
      {p.recordTarget && <RecorderTap3D target={p.recordTarget} />}
      <FpsProbe minFps={p.minFps} onVerdict={p.onFpsVerdict} />
      {p.debug && <DebugProbe live={live} />}
    </>
  );
}

// ─── fps ────────────────────────────────────────────────────────────────────

function FpsProbe({ minFps, onVerdict }: { minFps: number; onVerdict: Scene3DProps['onFpsVerdict'] }) {
  const meter = useMemo(() => createFpsMeter(undefined, minFps), [minFps]);
  const gl = useThree((s) => s.gl);
  const cb = useRef(onVerdict);
  cb.current = onVerdict;
  useFrame(() => {
    const v = meter.tick(performance.now());
    if (v === 'ok' || v === 'slow') {
      cb.current(v, meter.fps, {
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      });
    }
  });
  return null;
}

/** Estado para los e2e: cámara, instante y altura del balón. */
function DebugProbe({ live }: { live: LiveRef }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    const w = window as unknown as { __TACTICAL3D__?: Record<string, unknown> };
    w.__TACTICAL3D__ = {
      ...(w.__TACTICAL3D__ ?? {}),
      t: live.current.t,
      ballLift: live.current.ballLift ?? 0,
      ball: live.current.ball,
      cam: [camera.position.x, camera.position.y, camera.position.z],
      frames: frames.current,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    };
  });
  return null;
}
