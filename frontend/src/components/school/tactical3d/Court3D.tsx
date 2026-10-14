/**
 * Cancha 3D: el piso lleva como textura el MISMO fondo SVG de la pizarra
 * (líneas idénticas al 2D) a escala real, y encima los elementos con volumen
 * del deporte: arcos, red de vóley o canastas. Medidas de courtGeometry.ts.
 */
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BASKET_M, VOLLEY_POST_OUTSIDE_M } from '@/components/school/courts/courtGeometry';
import { sportDef } from '@/lib/school/tacticalSports';
import { BASKET_HEIGHTS_M, fixtureFor, VOLLEY_NET_M, type Court3D as Court3DModel } from '@/lib/school/tactical3d';
import { loadCourtTexture } from './textures';
import { release, track, useResources } from './resources';

export function Court3D({ court, onReady }: { court: Court3DModel; onReady?: () => void }) {
  const gl = useThree((s) => s.gl);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const colors = sportDef(court.sport).colors;

  useEffect(() => {
    let alive = true;
    let loaded: THREE.CanvasTexture | null = null;
    loadCourtTexture(court.sport, gl.capabilities.maxTextureSize)
      .then((t) => {
        if (!alive) { t.dispose(); return; }
        loaded = track(t);
        setTexture(t);
      })
      .catch(() => { /* sin textura queda el piso liso del color de la cancha */ })
      .finally(() => { if (alive) onReady?.(); });
    return () => { alive = false; release(loaded); };
  }, [court.sport, gl, onReady]);

  const r = useResources(() => ({
    floorGeo: track(new THREE.PlaneGeometry(court.floorW, court.floorL)),
    groundGeo: track(new THREE.PlaneGeometry(court.floorW * 8, court.floorL * 8)),
    groundMat: track(new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.surround).multiplyScalar(0.55), roughness: 1 })),
  }), [court.floorW, court.floorL, colors.surround]);

  return (
    <group>
      <mesh geometry={r.groundGeo} material={r.groundMat} rotation-x={-Math.PI / 2} position-y={-0.02} />
      <mesh geometry={r.floorGeo} rotation-x={-Math.PI / 2} name="court-floor">
        {texture
          ? <meshStandardMaterial key="tex" map={texture} roughness={0.95} />
          : <meshStandardMaterial key="flat" color={colors.court} roughness={0.95} />}
      </mesh>
      <Fixtures court={court} />
    </group>
  );
}

function Fixtures({ court }: { court: Court3DModel }) {
  const fx = fixtureFor(court.sport);
  if (fx.kind === 'goals') {
    return (
      <>
        <Goal width={fx.width} height={fx.height} z={-court.lengthM / 2} dir={-1} />
        <Goal width={fx.width} height={fx.height} z={court.lengthM / 2} dir={1} />
      </>
    );
  }
  if (fx.kind === 'net') return <VolleyNet widthM={court.widthM} />;
  if (fx.kind === 'hoops') {
    return (
      <>
        <Hoop baselineZ={-court.lengthM / 2} dir={-1} />
        <Hoop baselineZ={court.lengthM / 2} dir={1} />
      </>
    );
  }
  return null;
}

/** Arco sobre la línea de fondo `z`; la red se va hacia afuera (`dir`). */
export function Goal({ width, height, z, dir, x = 0, rotY = 0 }: { width: number; height: number; z: number; dir: 1 | -1; x?: number; rotY?: number }) {
  const depth = Math.max(0.8, height * 0.6);
  const r = useResources(() => ({
    post: track(new THREE.CylinderGeometry(0.06, 0.06, height, 10)),
    bar: track(new THREE.CylinderGeometry(0.06, 0.06, width, 10)),
    netBack: track(new THREE.PlaneGeometry(width, height, Math.round(width * 5), Math.round(height * 5))),
    netSide: track(new THREE.PlaneGeometry(depth, height, Math.round(depth * 5), Math.round(height * 5))),
    netTop: track(new THREE.PlaneGeometry(width, depth, Math.round(width * 5), Math.round(depth * 5))),
    postMat: track(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 })),
    netMat: track(new THREE.MeshBasicMaterial({ color: '#e2e8f0', wireframe: true, transparent: true, opacity: 0.45 })),
  }), [width, height, depth]);
  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      {[-width / 2, width / 2].map((px) => (
        <mesh key={px} geometry={r.post} material={r.postMat} position={[px, height / 2, 0]} />
      ))}
      <mesh geometry={r.bar} material={r.postMat} position={[0, height, 0]} rotation-z={Math.PI / 2} />
      <mesh geometry={r.netBack} material={r.netMat} position={[0, height / 2, dir * depth]} />
      {[-width / 2, width / 2].map((px) => (
        <mesh key={px} geometry={r.netSide} material={r.netMat} position={[px, height / 2, (dir * depth) / 2]} rotation-y={Math.PI / 2} />
      ))}
      <mesh geometry={r.netTop} material={r.netMat} position={[0, height, (dir * depth) / 2]} rotation-x={Math.PI / 2} />
    </group>
  );
}

function VolleyNet({ widthM }: { widthM: number }) {
  const postOutside = VOLLEY_POST_OUTSIDE_M;
  const { height, meshHeight, antennaAbove } = VOLLEY_NET_M;
  const span = widthM + 2 * postOutside;
  const r = useResources(() => ({
    post: track(new THREE.CylinderGeometry(0.05, 0.05, height + 0.1, 12)),
    mesh: track(new THREE.PlaneGeometry(span, meshHeight, Math.round(span * 8), Math.round(meshHeight * 8))),
    band: track(new THREE.BoxGeometry(span, 0.07, 0.02)),
    antenna: track(new THREE.CylinderGeometry(0.01, 0.01, meshHeight + antennaAbove, 6)),
    postMat: track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.4, roughness: 0.4 })),
    meshMat: track(new THREE.MeshBasicMaterial({ color: '#0f172a', wireframe: true, transparent: true, opacity: 0.7 })),
    bandMat: track(new THREE.MeshStandardMaterial({ color: '#f8fafc' })),
    antennaMat: track(new THREE.MeshStandardMaterial({ color: '#ef4444' })),
  }), [span, height, meshHeight, antennaAbove]);
  return (
    <group name="volley-net">
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} geometry={r.post} material={r.postMat} position={[x, (height + 0.1) / 2, 0]} />
      ))}
      <mesh geometry={r.mesh} material={r.meshMat} position={[0, height - meshHeight / 2, 0]} />
      <mesh geometry={r.band} material={r.bandMat} position={[0, height - 0.035, 0]} />
      <mesh geometry={r.band} material={r.bandMat} position={[0, height - meshHeight, 0]} />
      {[-widthM / 2, widthM / 2].map((x) => (
        <mesh key={x} geometry={r.antenna} material={r.antennaMat} position={[x, height - meshHeight + (meshHeight + antennaAbove) / 2, 0]} />
      ))}
    </group>
  );
}

/** Canasta FIBA en la línea de fondo `baselineZ` (`dir` = hacia afuera). */
function Hoop({ baselineZ, dir }: { baselineZ: number; dir: 1 | -1 }) {
  const { boardFromBaseline, rimFromBaseline, boardWidth, rimRadius } = BASKET_M;
  const { boardHeight, boardBottom, rimHeight } = BASKET_HEIGHTS_M;
  const boardZ = baselineZ - dir * boardFromBaseline;
  const rimZ = baselineZ - dir * rimFromBaseline;
  const poleZ = baselineZ + dir * 1;
  const top = boardBottom + boardHeight * 0.6;
  const armLen = Math.abs(poleZ - boardZ);
  const r = useResources(() => ({
    board: track(new THREE.BoxGeometry(boardWidth, boardHeight, 0.05)),
    square: track(edgesOf(new THREE.PlaneGeometry(0.59, 0.45))),
    rim: track(new THREE.TorusGeometry(rimRadius, 0.018, 8, 28)),
    pole: track(new THREE.CylinderGeometry(0.1, 0.12, top, 12)),
    arm: track(new THREE.BoxGeometry(0.12, 0.12, armLen)),
    boardMat: track(new THREE.MeshStandardMaterial({ color: '#f8fafc', transparent: true, opacity: 0.75, roughness: 0.2 })),
    lineMat: track(new THREE.LineBasicMaterial({ color: '#ea580c' })),
    rimMat: track(new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.3, roughness: 0.4 })),
    poleMat: track(new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.5 })),
  }), [boardWidth, boardHeight, rimRadius, top, armLen]);
  return (
    <group name="basket-hoop">
      <mesh geometry={r.pole} material={r.poleMat} position={[0, top / 2, poleZ]} />
      <mesh geometry={r.arm} material={r.poleMat} position={[0, top, (poleZ + boardZ) / 2]} />
      <mesh geometry={r.board} material={r.boardMat} position={[0, boardBottom + boardHeight / 2, boardZ]} />
      <lineSegments geometry={r.square} material={r.lineMat} position={[0, rimHeight + 0.225, boardZ - dir * 0.03]} />
      <mesh geometry={r.rim} material={r.rimMat} position={[0, rimHeight, rimZ]} rotation-x={Math.PI / 2} />
    </group>
  );
}

/** Bordes de una geometría (libera la original). */
function edgesOf(g: THREE.BufferGeometry): THREE.EdgesGeometry {
  const e = new THREE.EdgesGeometry(g);
  g.dispose();
  return e;
}
