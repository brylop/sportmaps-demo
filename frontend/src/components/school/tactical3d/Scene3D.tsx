/**
 * Escena del visor 3D: reloj de reproducción, luces, cancha, jugadores,
 * dibujos, cámaras y el medidor de fps. Todo lo que vive DENTRO del <Canvas>.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { advancePlayback, type PlaybackClock, type PlaybackSpeed } from '@/lib/school/tacticalAnimation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import {
  computeLive, createFpsMeter, fixedCameraPose, playerCameraPose, toMeters,
  type CameraMode, type LiveState, type Court3D as Court3DModel, type PlayerVisual,
} from '@/lib/school/tactical3d';
import { Court3D } from './Court3D';
import { Ball3D, LabelDeclutter, Players3D } from './Figures3D';
import type { LiveRef } from './figureKit';
import { Drawings3D } from './Drawings3D';
import type { TacticalTeamsConfig } from '@/lib/school/tacticalTeams';

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
  speed: PlaybackSpeed;
  totalMs: number;
  onEnded: () => void;
  cameraMode: CameraMode;
  playerKey: string | null;
  onSelectPlayer: (key: string) => void;
  reducedMotion: boolean;
  minFps: number;
  onFpsVerdict: (verdict: 'ok' | 'slow', fps: number, info: { geometries: number; textures: number; programs: number }) => void;
  /** M6b: configuración de los equipos (rivales con sus colores y números). */
  teams?: TacticalTeamsConfig | null;
}

export function Scene3D(p: Scene3DProps) {
  const live = useRef<LiveState>(computeLive(p.court, p.frames, p.overlayFrames, p.clock.get())) as LiveRef;
  const playingRef = useRef(p.playing);
  playingRef.current = p.playing;
  const lastT = useRef<number>(-1);

  // Antes que todos (prioridad negativa no toma el render): avanza el reloj y
  // calcula el instante una vez para todas las capas.
  useFrame((_, delta) => {
    let t = p.clock.get();
    if (playingRef.current) {
      const next = advancePlayback(t, delta * 1000, p.speed, p.totalMs, false);
      t = next.t;
      p.clock.set(t);
      if (next.ended) p.onEnded();
    }
    if (t !== lastT.current) {
      lastT.current = t;
      live.current = computeLive(p.court, p.frames, p.overlayFrames, t);
    }
  }, -2);

  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <fog attach="fog" args={['#0b1220', p.court.lengthM * 2.2, p.court.lengthM * 6]} />
      <hemisphereLight args={['#f8fafc', '#334155', 1.1]} />
      <directionalLight position={[-p.court.widthM, p.court.lengthM, p.court.lengthM * 0.4]} intensity={1.6} />
      <Court3D court={p.court} />
      <Drawings3D court={p.court} live={live} teams={p.teams} />
      {p.overlayFrames && <Drawings3D court={p.court} live={live} layer="overlay" tint={p.overlayColor} />}
      <Players3D court={p.court} keys={p.keys} visuals={p.visuals} live={live} layer="main" selectedKey={p.playerKey} onSelect={p.onSelectPlayer} />
      {p.overlayFrames && <Players3D court={p.court} keys={p.overlayKeys} visuals={p.overlayVisuals} live={live} layer="overlay" />}
      <Ball3D court={p.court} live={live} />
      <LabelDeclutter />
      <CameraRig court={p.court} mode={p.cameraMode} playerKey={p.playerKey} live={live} reducedMotion={p.reducedMotion} />
      <FpsProbe minFps={p.minFps} onVerdict={p.onFpsVerdict} />
    </>
  );
}

// ─── Cámaras ────────────────────────────────────────────────────────────────

const TRANSITION_S = 0.9;
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function CameraRig({ court, mode, playerKey, live, reducedMotion }: {
  court: Court3DModel; mode: CameraMode; playerKey: string | null; live: LiveRef; reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.maxPolarAngle = Math.PI / 2 - 0.06; // nunca por debajo del piso
    c.minDistance = 2;
    c.maxDistance = court.lengthM * 3;
    c.screenSpacePanning = false;
    return c;
  }, [camera, gl, court.lengthM]);
  useEffect(() => () => controls.dispose(), [controls]);

  // Hacia dónde mira la cámara ahora (en las fijas = el centro de la órbita).
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const anim = useRef<{ fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; elapsed: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (mode === 'jugador') return;
    const pose = fixedCameraPose(court, mode, aspect, camera.fov);
    const toPos = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
    const toTarget = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
    if (reducedMotion || first.current) {
      // Sin animación automática (prefers-reduced-motion) y al abrir: corte directo.
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      anim.current = null;
    } else {
      anim.current = { fromPos: camera.position.clone(), fromTarget: target.clone(), toPos, toTarget, elapsed: 0 };
    }
    first.current = false;
  }, [mode, court, aspect, camera, controls, reducedMotion, target]);

  useFrame((_, delta) => {
    if (mode === 'jugador') {
      controls.enabled = false;
      const p = live.current.main.players.find((x) => x.key === playerKey);
      if (!p) return;
      const pose = playerCameraPose(court, toMeters(court, p.x, p.y), live.current.ball);
      desired.set(pose.position.x, pose.position.y, pose.position.z);
      const look = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
      if (reducedMotion || first.current) {
        camera.position.copy(desired);
        target.copy(look);
      } else {
        // Sigue al jugador con un poco de suavizado (si no, cada paso sacude).
        const k = 1 - Math.exp(-delta * 8);
        camera.position.lerp(desired, k);
        target.lerp(look, k);
      }
      first.current = false;
      camera.lookAt(target);
      return;
    }
    const a = anim.current;
    if (a) {
      a.elapsed += delta;
      const k = ease(Math.min(1, a.elapsed / TRANSITION_S));
      camera.position.lerpVectors(a.fromPos, a.toPos, k);
      controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
      if (k >= 1) anim.current = null;
    }
    controls.enabled = !anim.current;
    controls.update();
    target.copy(controls.target);
  });
  return null;
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
