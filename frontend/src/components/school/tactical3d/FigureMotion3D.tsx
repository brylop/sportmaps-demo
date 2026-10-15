/**
 * Animación de carrera de las figuras (M6e): mira hacia donde se mueve, mueve
 * las piernas desde la cadera, rebota y se inclina al correr; quieto, en
 * reposo. Sin modelos ni esqueletos: solo gira las piezas low-poly que ya
 * arma PlayerFigure (Figures3D.tsx), por fuera, sin tocar ese archivo.
 *
 * Va DESPUÉS de las capas de jugadores en la escena: ellas escriben la
 * posición del cuadro y acá se suma la postura. Si la figura cambia de forma
 * (otras piernas), solo gira el cuerpo entero: nunca rompe.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { figureScale, type Court3D } from '@/lib/school/tactical3d';
import { smoothAngle } from '@/lib/school/tactical3dCameras';
import { gaitOf, playerMotion } from '@/lib/school/tactical3dMotion';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { LiveRef } from './figureKit';

/** Pierna de PlayerFigure: cilindro de 0,52 m con la cadera arriba. */
const LEG_LEN = 0.52;

interface Rig {
  body: THREE.Object3D;
  legs: { mesh: THREE.Object3D; x: number; hip: number }[];
  /** Sombra y aro de selección: se quedan en el piso aunque el cuerpo rebote. */
  ground: { mesh: THREE.Object3D; y: number; rx: number }[];
  heading: number | null;
  count: number;
}

function rigOf(group: THREE.Object3D): Rig | null {
  const body = group.children.find((c) => (c as THREE.Group).isGroup);
  if (!body) return null;
  const shadowMat = group.userData.shadow as THREE.Material | undefined;
  const legs: Rig['legs'] = [];
  const ground: Rig['ground'] = [];
  for (const c of body.children) {
    const m = c as THREE.Mesh;
    if (!m.isMesh) continue;
    const g = m.geometry as THREE.BufferGeometry & { parameters?: { height?: number } };
    // Postura de reposo, guardada la primera vez (después se la mueve).
    const base = (m.userData.restPose ??= { x: m.position.x, y: m.position.y, rx: m.rotation.x }) as { x: number; y: number; rx: number };
    if (g.type === 'CylinderGeometry' && Math.abs((g.parameters?.height ?? 0) - LEG_LEN) < 1e-3) {
      legs.push({ mesh: m, x: base.x, hip: base.y + LEG_LEN / 2 });
    } else if (m.material === shadowMat || g.type === 'RingGeometry') {
      ground.push({ mesh: m, y: base.y, rx: base.rx });
    }
  }
  body.rotation.order = 'YXZ';
  return { body, legs: legs.length === 2 ? legs : [], ground, heading: null, count: body.children.length };
}

export function FigureMotion3D({ court, frames, overlayFrames, live, enabled = true, hideKey = null }: {
  court: Court3D;
  frames: TacticalFrame[];
  overlayFrames: TacticalFrame[] | null;
  live: LiveRef;
  /** prefers-reduced-motion: solo orientación, sin zancada. */
  enabled?: boolean;
  /** Jugador de la vista «sus ojos»: no se dibuja (la cámara está en su cabeza). */
  hideKey?: string | null;
}) {
  const scene = useThree((s) => s.scene);
  const rigs = useRef(new Map<THREE.Object3D, Rig | null>());
  const scale = figureScale(court);
  const layers = useMemo(() => ([['main', frames], ['overlay', overlayFrames]] as const), [frames, overlayFrames]);

  useFrame((_, delta) => {
    const lv = live.current;
    const dt = Math.min(Math.max(delta, 0), 0.1);
    for (const [layer, fr] of layers) {
      if (!fr) continue;
      const root = scene.getObjectByName(`players-${layer}`);
      if (!root) continue;
      for (const g of root.children) {
        if (!g.visible) continue;
        const key = g.name.slice(`player:${layer}:`.length);
        if (layer === 'main' && key === hideKey) { g.visible = false; continue; }
        let rig = rigs.current.get(g);
        // Se vuelve a leer si cambió la figura (p. ej. aparece el aro de selección).
        if (rig === undefined || (rig && rig.count !== rig.body.children.length)) {
          const prev = rig?.heading ?? null;
          rig = rigOf(g);
          if (rig) rig.heading = prev;
          rigs.current.set(g, rig);
        }
        if (!rig) continue;
        const m = playerMotion(court, fr, key, lv.t, scale);
        // Giro suave (al cambiar de tramo no «salta» de dirección).
        rig.heading = rig.heading === null ? m.heading : smoothAngle(rig.heading, m.heading, dt, 0.12);
        const gait = enabled ? gaitOf(m, scale) : { legSwing: 0, bob: 0, lean: 0, run: 0 };
        rig.body.rotation.y = rig.heading;
        rig.body.rotation.x = gait.lean;
        rig.body.position.y = gait.bob * scale;
        // Se compensan rebote e inclinación: sombra y aro quedan planos en el piso.
        for (const gr of rig.ground) { gr.mesh.position.y = gr.y - gait.bob; gr.mesh.rotation.x = gr.rx - gait.lean; }
        rig.legs.forEach((leg, i) => {
          const th = i === 0 ? gait.legSwing : -gait.legSwing;
          // Pivote en la cadera: el centro de la pierna recorre un arco.
          leg.mesh.rotation.x = th;
          leg.mesh.position.set(leg.x, leg.hip - (LEG_LEN / 2) * Math.cos(th), -(LEG_LEN / 2) * Math.sin(th));
        });
      }
    }
    // Figuras desmontadas: fuera del mapa.
    if (rigs.current.size > 64) for (const g of rigs.current.keys()) if (!g.parent) rigs.current.delete(g);
  });
  return null;
}
