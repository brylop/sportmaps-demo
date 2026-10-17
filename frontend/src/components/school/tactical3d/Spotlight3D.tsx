/**
 * Foco del cuadro congelado (M6e, «freeze frame» de la transmisión): un haz
 * de luz y un halo sobre el jugador destacado mientras el resto de la escena
 * se oscurece (Scene3D baja las luces). La luz queda SIEMPRE montada, con
 * intensidad 0 si no hay congelado: encenderla no recompila los shaders.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { figureScale, toMeters, type Court3D } from '@/lib/school/tactical3d';
import { liveBallPct, spotlightKey } from '@/lib/school/tactical3dMotion';
import { track, useResources } from './resources';
import type { LiveRef } from './figureKit';

export function Spotlight3D({ court, live, active, selectedKey, pulse }: {
  court: Court3D;
  live: LiveRef;
  active: boolean;
  /** El elegido (tocándolo); sin elegido, el más cercano al balón (spotlightKey). */
  selectedKey: string | null;
  /** Halo que late (apagado con prefers-reduced-motion). */
  pulse: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const s = figureScale(court);
  const beamH = 9 * s;
  const r = useResources(() => ({
    haloGeo: track(new THREE.RingGeometry(0.62, 0.95, 40)),
    haloMat: track(new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })),
    beamGeo: track(new THREE.CylinderGeometry(0.25, 0.85, 1, 24, 1, true)),
    beamMat: track(new THREE.MeshBasicMaterial({ color: '#fef9c3', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })),
  }), []);
  const light = useMemo(() => {
    const l = new THREE.SpotLight('#fff7d6', 0, 0, 0.32, 0.55, 0);
    l.name = 'freeze-spot';
    return l;
  }, []);
  useEffect(() => {
    scene.add(light, light.target);
    return () => { scene.remove(light, light.target); light.dispose(); };
  }, [scene, light]);
  const halo = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = halo.current;
    const main = live.current.main;
    const key = active ? spotlightKey(main, liveBallPct(main), selectedKey) : null;
    const p = key ? main.players.find((q) => q.key === key) : null;
    if (!g) return;
    if (!p) { g.visible = false; light.intensity = 0; return; }
    const m = toMeters(court, p.x, p.y);
    g.visible = true;
    g.position.set(m.x, 0, m.z);
    const k = pulse ? 1 + Math.sin(clock.elapsedTime * 4) * 0.08 : 1;
    g.scale.set(s * k, 1, s * k);
    light.position.set(m.x, beamH + 3 * s, m.z + 2 * s);
    light.target.position.set(m.x, 0, m.z);
    light.target.updateMatrixWorld();
    // decay 0: sin caída por distancia, la intensidad es directa.
    light.intensity = 3.2;
  });

  return (
    <group ref={halo} name="freeze-halo" visible={false}>
      <mesh geometry={r.haloGeo} material={r.haloMat} rotation-x={-Math.PI / 2} position-y={0.03} renderOrder={4} />
      <mesh geometry={r.beamGeo} material={r.beamMat} position-y={beamH / 2} scale={[1, beamH, 1]} renderOrder={5} />
    </group>
  );
}
