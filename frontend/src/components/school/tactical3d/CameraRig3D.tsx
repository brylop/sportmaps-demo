/**
 * Rig de cámaras del visor 3D (M6e). Aplica, cuadro a cuadro, la pose que
 * calcula lib/school/tactical3dCameras.ts: sigue al balón o al jugador con
 * suavizado, encadena las cámaras con una transición de 600-900 ms y, con el
 * director automático, corta según la jugada. «Libre» deja la órbita al dedo.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ballFor, figureScale, toMeters, type CameraPose, type Court3D, type Vec3 } from '@/lib/school/tactical3d';
import {
  blendPose, cameraPose, createDirector, directorShot, FOLLOW_TAU_S, portraitFraming, smoothAngle, smoothToward, transitionMs,
  type CameraKind, type PlayerView,
} from '@/lib/school/tactical3dCameras';
import { ballHeadingAt, playerMotion } from '@/lib/school/tactical3dMotion';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { AnimationCurve } from '@/lib/school/tacticalBoardSettings';
import type { LiveRef } from './figureKit';

export interface CameraRigProps {
  court: Court3D;
  frames: TacticalFrame[];
  kind: CameraKind;
  director: boolean;
  playerKey: string | null;
  playerView: PlayerView;
  live: LiveRef;
  reducedMotion: boolean;
  /** Cámara que está al aire (la elegida o la del director). */
  onShot?: (kind: CameraKind) => void;
  /** Curva de velocidad de los Ajustes (M6g): la cámara «jugador» gira con la misma carrera. */
  curve?: AnimationCurve;
}

const vec = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);
const plain = (p: THREE.Vector3): Vec3 => ({ x: p.x, y: p.y, z: p.z });

export function CameraRig3D({ court, frames, kind, director, playerKey, playerView, live, reducedMotion, onShot, curve }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.maxPolarAngle = Math.PI / 2 - 0.06; // nunca por debajo del piso
    c.minDistance = 2;
    c.maxDistance = court.lengthM * 3;
    c.screenSpacePanning = false;
    c.enabled = false;
    return c;
  }, [camera, gl, court.lengthM]);
  useEffect(() => () => controls.dispose(), [controls]);

  const st = useRef({
    target: new THREE.Vector3(),
    ball: null as Vec3 | null,
    heading: null as number | null,
    ballHeading: null as number | null,
    droneS: 0,
    shot: null as CameraKind | null,
    tr: null as { from: CameraPose; elapsed: number; dur: number } | null,
    first: true,
  });
  const dir = useMemo(() => createDirector(), []);
  const shotCb = useRef(onShot);
  shotCb.current = onShot;
  useEffect(() => { if (!director) dir.reset(); }, [director, dir]);

  const ballSpec = ballFor(court.sport);
  const scale = figureScale(court);

  useFrame((_, delta) => {
    const s = st.current;
    const dt = Math.min(Math.max(delta, 0), 0.1);
    const lv = live.current;

    // 1. Qué cámara va al aire.
    const auto = director && !reducedMotion;
    const shot: CameraKind = auto ? dir.step(directorShot(court, frames, lv.t), performance.now()) : kind;
    if (shot !== s.shot) {
      const leavingLibre = s.shot === 'libre';
      if (leavingLibre) s.target.copy(controls.target);
      // Corte directo al abrir y con prefers-reduced-motion; si no, transición.
      s.tr = s.first || reducedMotion ? null : { from: { position: plain(camera.position), target: plain(s.target) }, elapsed: 0, dur: 750 };
      if (shot === 'libre') {
        controls.target.copy(s.target);
        controls.update();
      }
      s.shot = shot;
      shotCb.current?.(shot);
    }

    // 2. Balón suavizado (altura incluida: el arco de los pases largos).
    let ball: Vec3 | null = null;
    if (lv.ball && lv.ball.opacity > 0.01) {
      ball = { x: lv.ball.x, y: Math.max(ballSpec.radius, ballSpec.height * scale) + (lv.ballLift ?? 0), z: lv.ball.z };
    }
    const tau = FOLLOW_TAU_S[shot] ?? 0.4;
    s.ball = ball ? (s.ball && !s.first ? smoothToward(s.ball, ball, dt, tau) : ball) : s.ball;

    // 3. Jugador seguido y hacia dónde mira.
    let player: { x: number; z: number; heading: number } | null = null;
    if (shot === 'jugador' && playerKey) {
      const p = lv.main.players.find((q) => q.key === playerKey);
      if (p) {
        const m = toMeters(court, p.x, p.y);
        const h = playerMotion(court, frames, playerKey, lv.t, scale, curve).heading;
        s.heading = s.heading === null || s.first ? h : smoothAngle(s.heading, h, dt, 0.35);
        player = { ...m, heading: s.heading };
      }
    }
    if (shot === 'dron' && !reducedMotion) s.droneS += dt;
    // Sentido del balón (para ponerse detrás de él), con giro suave.
    const bh = ballHeadingAt(court, frames, lv.main);
    s.ballHeading = s.ballHeading === null || s.first ? bh : smoothAngle(s.ballHeading, bh, dt, 0.5);

    // Vertical: encuadre para la zona libre (ver portraitFraming); horizontal/escritorio, igual que siempre.
    const pf = portraitFraming(size.width, size.height, camera.fov);
    if (pf) {
      const vo = camera.view;
      if (!vo || !vo.enabled || vo.fullWidth !== size.width || vo.fullHeight !== size.height || vo.offsetY !== -pf.shiftPx) {
        camera.setViewOffset(size.width, size.height, 0, -pf.shiftPx, size.width, size.height);
      }
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    const aspect = pf ? pf.aspect : size.width / Math.max(1, size.height);
    const pose = cameraPose(shot, {
      court, aspect, fovDeg: pf ? pf.fovDeg : camera.fov, ball: s.ball, player, playerView, elapsedS: s.droneS, ballHeading: s.ballHeading,
    });
    s.first = false;

    if (!pose) {
      // Libre: la órbita manda.
      controls.enabled = true;
      controls.update();
      s.target.copy(controls.target);
      return;
    }
    controls.enabled = false;
    let out = pose;
    if (s.tr) {
      if (s.tr.elapsed === 0) s.tr.dur = transitionMs(s.tr.from, pose);
      s.tr.elapsed += dt * 1000;
      const b = blendPose(s.tr.from, pose, s.tr.elapsed, s.tr.dur);
      out = b.pose;
      if (b.done) s.tr = null;
    }
    camera.position.copy(vec(out.position));
    s.target.copy(vec(out.target));
    camera.lookAt(s.target);
  }, -1);
  return null;
}
