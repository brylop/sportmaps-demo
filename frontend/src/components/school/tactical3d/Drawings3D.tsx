/**
 * Lo dibujado en la pizarra, en 3D: el material (conos, platos, arcos,
 * vallitas, aros, escaleras, estacas, maniquíes, rivales, balón) en formas
 * simples de pocos polígonos, y las flechas, curvas, recorridos y trazos como
 * cintas pintadas sobre el piso con la misma comba que en el 2D.
 *
 * Las figuras cambian mucho menos que los jugadores: esta capa se re-renderiza
 * solo cuando cambia lo que hay que dibujar (firma), no en cada cuadro.
 */
import { memo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import { isPointShape, OBJECT_BOX, type ObjectType } from '@/lib/school/tacticalGeometry';
import { ARROW_COLOR_HEX, objectColor } from '@/lib/school/tacticalPalette';
import { figureScale, strokePath, toMeters, type Court3D, type PlayerVisual, type Vec3 } from '@/lib/school/tactical3d';
import { chipLook, pointScale, rivalSlots, type TacticalTeamsConfig } from '@/lib/school/tacticalTeams';
import { sportDef } from '@/lib/school/tacticalSports';
import type { InterpolatedArrow } from '@/lib/school/tacticalAnimation';
import { Ball3D, PlayerFigure } from './Figures3D';
import { setFigureOpacity, useFigureGeometries, type FigureGeometries, type LiveRef } from './figureKit';
import { Goal } from './Court3D';
import { labelTexture } from './textures';
import { track, useResources } from './resources';

const round = (n: number) => Math.round(n * 20) / 20;
const signature = (arrows: InterpolatedArrow[]) =>
  arrows.map((a) => `${a.shape.type ?? 'arrow'}:${round(a.shape.x1)},${round(a.shape.y1)},${round(a.shape.x2)},${round(a.shape.y2)}:${a.shape.rot ?? 0}:${a.shape.size ?? 1}:${Math.round(a.opacity * 20)}`).join('|');

export function Drawings3D({ court, live, layer = 'main', tint, teams }: {
  court: Court3D; live: LiveRef; layer?: 'main' | 'overlay'; tint?: string;
  /** M6b: rivales con los colores y números del equipo de afuera. */
  teams?: TacticalTeamsConfig | null;
}) {
  const [arrows, setArrows] = useState<InterpolatedArrow[]>([]);
  const sig = useRef('');
  useFrame(() => {
    const f = layer === 'main' ? live.current.main : live.current.overlay;
    const next = f?.arrows ?? [];
    const s = signature(next);
    if (s !== sig.current) { sig.current = s; setArrows(next); }
  });
  const geos = useFigureGeometries();
  const rivals = teams ? rivalSlots(arrows.map((a) => a.shape), teams, sportDef(court.sport).hasGoalkeeper) : null;
  return (
    <group name={`drawings-${layer}`}>
      {arrows.map((a, i) => {
        const t = a.shape.type ?? 'arrow';
        if (isPointShape(t)) {
          // El balón de la jugada lo dibuja Ball3D (sigue al balón del cuadro).
          if (t === 'ball' && layer === 'main') return null;
          const slot = rivals?.get(i);
          const rival: PlayerVisual | undefined = teams && slot ? (() => {
            const look = chipLook(teams.away, slot.isGK);
            return { number: teams.away.inner === 'none' ? null : slot.number, label: slot.alias, isGoalkeeper: slot.isGK, color: look.fill, shorts: look.accent, numberColor: look.text };
          })() : undefined;
          return <PointObject key={`${i}:${t}`} court={court} shape={a.shape} type={t} opacity={a.opacity} geos={geos} tint={tint}
            rival={rival} scaleMul={pointScale(teams, t)} />;
        }
        if (t === 'zone') return <Zone key={`${i}:zone`} court={court} shape={a.shape} opacity={a.opacity} tint={tint} />;
        if (t === 'text') return <FloorText key={`${i}:text`} court={court} shape={a.shape} opacity={a.opacity} />;
        return <Stroke key={`${i}:${t}`} court={court} shape={a.shape} opacity={a.opacity} tint={tint} />;
      })}
    </group>
  );
}

const shapeColor = (s: TacticalArrow, tint?: string) => tint ?? ARROW_COLOR_HEX[s.color ?? 'white'];

// ─── Cintas sobre el piso ───────────────────────────────────────────────────

/** Polilínea → cinta plana (dos vértices por punto) a `lift` del piso. */
function ribbonGeometry(points: Vec3[], width: number, lift = 0.03): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const nx = -dz * (width / 2);
    const nz = dx * (width / 2);
    const p = points[i];
    pos.push(p.x + nx, p.y + lift, p.z + nz, p.x - nx, p.y + lift, p.z - nz);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function headGeometry(tip: Vec3, from: Vec3, size: number, lift = 0.035): THREE.BufferGeometry {
  let dx = tip.x - from.x;
  let dz = tip.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const bx = tip.x - dx * size;
  const bz = tip.z - dz * size;
  const nx = -dz * size * 0.55;
  const nz = dx * size * 0.55;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    tip.x, tip.y + lift, tip.z, bx + nx, tip.y + lift, bz + nz, bx - nx, tip.y + lift, bz - nz,
  ], 3));
  return g;
}

const Stroke = memo(function Stroke({ court, shape, opacity, tint }: { court: Court3D; shape: TacticalArrow; opacity: number; tint?: string }) {
  const s = figureScale(court);
  const r = useResources(() => {
    const path = strokePath(court, shape, 1.6 * s);
    const width = 0.16 * s;
    const out: Record<string, { dispose: () => void }> = {
      mat: track(new THREE.MeshBasicMaterial({ color: shapeColor(shape, tint), transparent: true, side: THREE.DoubleSide, depthWrite: false })),
    };
    if (path && path.points.length >= 2) {
      const pts = path.points;
      const headSize = 0.9 * s;
      // La cinta termina donde arranca la punta.
      const body = path.head ? trimEnd(pts, headSize * 0.8) : pts;
      out.body = track(ribbonGeometry(body, width));
      if (path.head) out.head = track(headGeometry(pts[pts.length - 1], pts[pts.length - 2], headSize));
    }
    return out;
  }, [court, shape, tint, s]);
  const mat = r.mat as THREE.MeshBasicMaterial;
  mat.opacity = 0.92 * opacity;
  return (
    <group>
      {r.body && <mesh geometry={r.body as THREE.BufferGeometry} material={mat} renderOrder={3} />}
      {r.head && <mesh geometry={r.head as THREE.BufferGeometry} material={mat} renderOrder={3} />}
    </group>
  );
});

function trimEnd(pts: Vec3[], cut: number): Vec3[] {
  const out = pts.slice();
  let left = cut;
  while (out.length >= 2 && left > 0) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > left) {
      const k = (d - left) / d;
      out[out.length - 1] = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
      break;
    }
    left -= d;
    out.pop();
  }
  return out.length >= 2 ? out : pts;
}

const Zone = memo(function Zone({ court, shape, opacity, tint }: { court: Court3D; shape: TacticalArrow; opacity: number; tint?: string }) {
  const a = toMeters(court, Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2));
  const b = toMeters(court, Math.max(shape.x1, shape.x2), Math.max(shape.y1, shape.y2));
  const w = Math.max(0.1, b.x - a.x);
  const h = Math.max(0.1, b.z - a.z);
  const r = useResources(() => ({
    geo: track(new THREE.PlaneGeometry(w, h)),
    mat: track(new THREE.MeshBasicMaterial({ color: shapeColor(shape, tint), transparent: true, depthWrite: false, side: THREE.DoubleSide })),
  }), [w, h, shape.color, tint]);
  r.mat.opacity = 0.28 * opacity;
  return <mesh geometry={r.geo} material={r.mat} rotation-x={-Math.PI / 2} position={[(a.x + b.x) / 2, 0.025, (a.z + b.z) / 2]} renderOrder={2} />;
});

const FloorText = memo(function FloorText({ court, shape, opacity }: { court: Court3D; shape: TacticalArrow; opacity: number }) {
  const m = toMeters(court, shape.x1, shape.y1);
  const r = useResources(() => {
    const lbl = labelTexture(null, shape.text ?? '', '#0f172a');
    return {
      tex: track(lbl.texture),
      mat: track(new THREE.SpriteMaterial({ map: lbl.texture, sizeAttenuation: false, depthTest: false, transparent: true })),
    };
  }, [shape.text]);
  r.mat.opacity = opacity;
  const img = r.tex.image as HTMLCanvasElement;
  const k = 0.03 * (shape.size ?? 1);
  return <sprite material={r.mat} position={[m.x, 0.6, m.z]} scale={[k * (img.width / img.height), k, 1]} renderOrder={9} />;
});

// ─── Material ───────────────────────────────────────────────────────────────

const PointObject = memo(function PointObject({ court, shape, type, opacity, geos, tint, rival, scaleMul = 1 }: {
  court: Court3D; shape: TacticalArrow; type: ObjectType; opacity: number; geos: FigureGeometries; tint?: string;
  rival?: PlayerVisual; scaleMul?: number;
}) {
  const m = toMeters(court, shape.x1, shape.y1);
  const s = figureScale(court) * (shape.size ?? 1) * scaleMul;
  // La pizarra gira en pantalla (y hacia abajo) = horario visto desde arriba.
  const rotY = -((shape.rot ?? 0) * Math.PI) / 180;
  if (type === 'ball') return <Ball3D court={court} position={[shape.x1, shape.y1]} opacity={opacity} />;
  if (type === 'opponent' || type === 'mannequin') {
    const color = tint ?? (type === 'opponent' ? '#dc2626' : objectColor(shape.color, '#facc15'));
    return (
      <group position={[m.x, 0, m.z]}>
        <FadingFigure
          visual={rival && type === 'opponent' && !tint ? rival : { number: type === 'opponent' ? 'R' : null, label: type === 'opponent' ? 'Rival' : '', color }}
          scale={s}
          geos={geos}
          opacity={opacity}
        />
      </group>
    );
  }
  if (type === 'goal' || type === 'mini_goal') {
    // Ancho del arco movible = el de su ícono en la pizarra, pasado a metros.
    const width = (OBJECT_BOX[type].w / court.sx) * (shape.size ?? 1);
    const height = type === 'goal' ? Math.min(2.44, width / 3) : Math.min(1.2, width / 2.2);
    return <Goal width={width} height={height} z={m.z} x={m.x} dir={1} rotY={rotY} />;
  }
  return (
    <group position={[m.x, 0, m.z]} rotation-y={rotY} scale={s}>
      <SimpleObject type={type} color={tint ?? shape.color} opacity={opacity} />
    </group>
  );
});

function FadingFigure({ opacity, ...props }: Parameters<typeof PlayerFigure>[0] & { opacity: number }) {
  const ref = useRef<THREE.Group | null>(null);
  useFrame(() => { if (ref.current) setFigureOpacity(ref.current, opacity); });
  return <PlayerFigure {...props} groupRef={(g) => { ref.current = g; }} />;
}

function SimpleObject({ type, color, opacity }: { type: ObjectType; color?: TacticalArrow['color'] | string; opacity: number }) {
  const r = useResources(() => {
    const hex = (fallback: string) => (typeof color === 'string' && color.startsWith('#')
      ? color
      : objectColor(color as TacticalArrow['color'], fallback));
    return { obj: track(buildObject(type, hex)) };
  }, [type, color]);
  useFrame(() => { for (const mat of r.obj.materials) mat.opacity = opacity; });
  return <primitive object={r.obj.root} />;
}

/** Material de pocos polígonos, construido una vez por objeto. */
function buildObject(type: ObjectType, hex: (fallback: string) => string) {
  const disposables: { dispose: () => void }[] = [];
  const materials: THREE.Material[] = [];
  const root = new THREE.Group();
  const mat = (c: string) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: true });
    disposables.push(m); materials.push(m); return m;
  };
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    disposables.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, 0, rz);
    root.add(mesh);
  };
  switch (type) {
    case 'cone': {
      add(new THREE.ConeGeometry(0.14, 0.34, 10), mat(hex('#f97316')), 0, 0.17);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), mat(hex('#f97316')), 0, 0.01);
      break;
    }
    case 'marker':
      add(new THREE.CylinderGeometry(0.06, 0.12, 0.05, 14), mat(hex('#facc15')), 0, 0.025);
      break;
    case 'hurdle': {
      const post = mat('#f8fafc');
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), post, -0.3, 0.15);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), post, 0.3, 0.15);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 6), mat(hex('#facc15')), 0, 0.3, 0, 0, Math.PI / 2);
      break;
    }
    case 'ring':
      add(new THREE.TorusGeometry(0.35, 0.03, 6, 24), mat(hex('#facc15')), 0, 0.03, 0, Math.PI / 2);
      break;
    case 'ladder': {
      const c = mat(hex('#facc15'));
      const len = 4;
      add(new THREE.BoxGeometry(0.03, 0.02, len), c, -0.25, 0.01);
      add(new THREE.BoxGeometry(0.03, 0.02, len), c, 0.25, 0.01);
      for (let i = 0; i <= 8; i++) add(new THREE.BoxGeometry(0.5, 0.015, 0.03), c, 0, 0.012, -len / 2 + (i * len) / 8);
      break;
    }
    case 'pole': {
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), mat(hex('#ef4444')), 0, 0.8);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), mat('#1f2937'), 0, 0.015);
      break;
    }
    default:
      break;
  }
  return { root, materials, dispose: () => { for (const d of disposables) d.dispose(); } };
}
