/**
 * Balón de la jugada en 3D (M6e): rueda en los pases cortos y vuela en
 * parábola en los largos y remates (la altura la calcula tactical3dMotion.
 * ballArc y la deja el bucle de la escena en `live.ballLift`). La sombra se
 * queda en el piso, se achica y se aclara con la altura: así se lee que va
 * por el aire y nunca «flota».
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ballFor, figureScale, type Court3D } from '@/lib/school/tactical3d';
import { ballTexture } from './textures';
import { track, useResources } from './resources';
import type { LiveRef } from './figureKit';

export function BallFlight3D({ court, live }: { court: Court3D; live: LiveRef }) {
  const spec = ballFor(court.sport);
  // Exagerado a propósito (igual que Ball3D): un balón real no se ve desde la tribuna.
  const radius = spec.radius * figureScale(court) * 1.8;
  const base = Math.max(radius, spec.height * figureScale(court));
  const r = useResources(() => {
    const tex = track(ballTexture(spec.style));
    return {
      tex,
      geo: track(new THREE.SphereGeometry(radius, 20, 14)),
      mat: track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true })),
      shadowGeo: track(new THREE.CircleGeometry(radius * 1.2, 16)),
      shadowMat: track(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false })),
    };
  }, [spec.style, radius]);
  const group = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const last = useRef<{ x: number; y: number; z: number } | null>(null);
  const axis = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const g = group.current;
    const b = ball.current;
    const sh = shadow.current;
    if (!g || !b || !sh) return;
    const state = live.current.ball;
    if (!state || state.opacity <= 0.01) { g.visible = false; last.current = null; return; }
    const lift = live.current.ballLift ?? 0;
    g.visible = true;
    g.position.set(state.x, 0, state.z);
    b.position.y = base + lift;
    r.mat.opacity = state.opacity;
    // Sombra: más chica y clara cuanto más alto (a 8 m queda en ~40 %).
    const k = 1 / (1 + lift * 0.18);
    sh.scale.setScalar(0.6 + 0.4 * k);
    r.shadowMat.opacity = 0.35 * state.opacity * k;
    // Gira sobre el eje perpendicular al avance: distancia / radio (rueda) y
    // la mitad en el aire (efecto, sin pretender física).
    const prev = last.current;
    if (prev) {
      const dx = state.x - prev.x;
      const dz = state.z - prev.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        axis.set(dz, 0, -dx).normalize();
        b.rotateOnWorldAxis(axis, (d / radius) * (lift > 0.05 ? 0.5 : 1));
      }
    }
    last.current = { x: state.x, y: lift, z: state.z };
  });

  return (
    <group ref={group} name="ball">
      <mesh ref={ball} geometry={r.geo} material={r.mat} position-y={base} name="ball-mesh" />
      <mesh ref={shadow} geometry={r.shadowGeo} material={r.shadowMat} rotation-x={-Math.PI / 2} position-y={0.012} />
    </group>
  );
}
