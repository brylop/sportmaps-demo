/**
 * Rastro del recorrido (M6e, opcional): por dónde pasó cada jugador hasta el
 * instante, en el piso y del color de su camiseta. Un solo LineSegments para
 * todos (un draw call), reescrito en cada cuadro.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toMeters, type Court3D, type PlayerVisual } from '@/lib/school/tactical3d';
import { trailPoints } from '@/lib/school/tactical3dMotion';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { track, useResources } from './resources';
import type { LiveRef } from './figureKit';

const TRAIL_Y = 0.03;
const WHITE = new THREE.Color('#ffffff');

export function Trails3D({ court, frames, keys, visuals, live, layer }: {
  court: Court3D;
  frames: TacticalFrame[];
  keys: string[];
  visuals: Record<string, PlayerVisual>;
  live: LiveRef;
  layer: 'main' | 'overlay';
}) {
  // Peor caso: cada jugador pasa por todos los cuadros (+ el instante actual).
  const maxSegs = Math.max(1, keys.length * frames.length);
  const r = useResources(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegs * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxSegs * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    return {
      geo: track(geo),
      mat: track(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false })),
    };
  }, [maxSegs]);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const main = layer === 'main' ? live.current.main : live.current.overlay;
    const pos = r.geo.getAttribute('position') as THREE.BufferAttribute;
    const col = r.geo.getAttribute('color') as THREE.BufferAttribute;
    let n = 0;
    if (main) {
      for (const key of keys) {
        const pts = trailPoints(frames, key, main);
        color.set(visuals[key]?.color ?? '#ffffff').lerp(WHITE, 0.25);
        for (let i = 1; i < pts.length && n < maxSegs; i++) {
          const a = toMeters(court, pts[i - 1].x, pts[i - 1].y);
          const b = toMeters(court, pts[i].x, pts[i].y);
          pos.setXYZ(n * 2, a.x, TRAIL_Y, a.z);
          pos.setXYZ(n * 2 + 1, b.x, TRAIL_Y, b.z);
          col.setXYZ(n * 2, color.r, color.g, color.b);
          col.setXYZ(n * 2 + 1, color.r, color.g, color.b);
          n++;
        }
      }
    }
    r.geo.setDrawRange(0, n * 2);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return <lineSegments geometry={r.geo} material={r.mat} renderOrder={3} name={`trails-${layer}`} frustumCulled={false} />;
}
