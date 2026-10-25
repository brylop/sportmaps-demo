import { describe, it, expect } from 'vitest';
import { analyzeVolleyball, type Landmark, type PoseSample } from './volleyball';

const G = 9.81;
const lm = (x: number, y: number, z = 0): Landmark => ({ x, y, z, visibility: 1 });
const blank = () => Array.from({ length: 33 }, () => lm(0, 0));

/**
 * Cuerpo sintético. Escala: 1 m = 0.5 en imagen (torso de 0,5 m = 0,25 de alto de imagen).
 * Suelo en y=0.9. `liftM` = metros que se elevan los pies. `bent` = brazo derecho a 90° en world.
 */
function frame(t: number, liftM: number, rightWristY: number, bent: boolean): PoseSample {
  const lms = blank();
  const world = blank();
  const footY = 0.9 - liftM * 0.5;
  [27, 28, 29, 30].forEach(i => { lms[i] = lm(0.5, footY); });
  lms[11] = lm(0.45, 0.45); lms[12] = lm(0.55, 0.45);
  lms[23] = lm(0.46, 0.7);  lms[24] = lm(0.54, 0.7);
  lms[13] = lm(0.4, 0.4);   lms[14] = lm(0.6, 0.4);
  lms[15] = lm(0.4, 0.6);   lms[16] = lm(0.6, rightWristY);

  // world: caderas en el origen, hombros 0,5 m arriba (y negativo = arriba)
  world[11] = lm(-0.2, -0.5); world[12] = lm(0.2, -0.5);
  world[23] = lm(-0.1, 0);    world[24] = lm(0.1, 0);
  world[13] = lm(-0.2, -0.2); world[15] = lm(-0.2, 0.1);
  world[14] = lm(0.2, -0.8);
  world[16] = bent ? lm(0.5, -0.8) : lm(0.2, -1.1);
  return { t, lms, world };
}

/** Clip: 0,5 s de pie, salto de apogeo `heightM`, 0,5 s de pie. El contacto cae en el apogeo. */
function clip(fps: number, heightM: number): PoseSample[] {
  const T = Math.sqrt((8 * heightM) / G);
  const t0 = 0.5, total = 0.5 + T + 0.5;
  const out: PoseSample[] = [];
  for (let k = 0; k * (1 / fps) <= total; k++) {
    const t = k / fps;
    const s = t - t0;
    const lift = s > 0 && s < T ? Math.max(0, (G * T / 2) * s - (G * s * s) / 2) : 0;
    const atApex = Math.abs(s - T / 2) <= 0.5 / fps;
    out.push(frame(t, lift, atApex ? 0.1 : 0.5, atApex));
  }
  return out;
}

describe('analyzeVolleyball', () => {
  it('recupera la altura de salto por tiempo de vuelo (60 fps, 45 cm)', () => {
    const r = analyzeVolleyball(clip(60, 0.45), 'volleyball_spike');
    expect(r.ok).toBe(true);
    expect(r.metrics.jump_height_cm).toBeGreaterThan(41);
    expect(r.metrics.jump_height_cm).toBeLessThan(49);
    expect(r.notes.some(n => n.text.includes('fps'))).toBe(false);
  });

  it('recupera la altura con otra escala (no depende de la distancia a la cámara)', () => {
    // Mismo salto, persona "más lejos": todo en imagen se encoge a la mitad.
    const far = clip(60, 0.45).map(s => ({
      ...s,
      lms: s.lms.map(p => ({ ...p, y: 0.9 + (p.y - 0.9) * 0.5, x: 0.5 + (p.x - 0.5) * 0.5 })),
    }));
    const r = analyzeVolleyball(far, 'volleyball_spike');
    expect(r.metrics.jump_height_cm).toBeGreaterThan(41);
    expect(r.metrics.jump_height_cm).toBeLessThan(49);
  });

  it('mide el ángulo del codo y la extensión en el contacto', () => {
    const r = analyzeVolleyball(clip(60, 0.45), 'volleyball_spike');
    expect(r.hittingArm).toBe('right');
    expect(r.metrics.elbow_angle_contact).toBeCloseTo(90, 0);
    // |hombro→muñeca| = 0,424 m sobre brazo de 0,6 m
    expect(r.metrics.arm_extension_contact).toBeCloseTo(70.7, 0);
  });

  it('avisa si el video está por debajo de 60 fps', () => {
    const r = analyzeVolleyball(clip(30, 0.45), 'volleyball_spike');
    expect(r.fps).toBeCloseTo(30, 0);
    expect(r.notes.some(n => n.level === 'warn' && n.text.includes('fps'))).toBe(true);
    expect(r.metrics.jump_height_uncertainty_cm).toBeGreaterThan(0);
  });

  it('avisa si el navegador reporta menos fps de los que se procesaron', () => {
    const r = analyzeVolleyball(clip(60, 0.45), 'volleyball_spike', { sourceFps: 120 });
    expect(r.notes.some(n => n.text.includes('saltó cuadros'))).toBe(true);
  });

  it('respeta el brazo indicado a mano', () => {
    const r = analyzeVolleyball(clip(60, 0.45), 'volleyball_spike', { hittingArm: 'left' });
    expect(r.hittingArm).toBe('left');
    expect(r.hittingArmSource).toBe('manual');
  });

  it('en un saque sin salto no es un error: nota informativa, sin altura', () => {
    const flat = clip(60, 0.45).map(s => {
      const lms = s.lms.map(p => ({ ...p }));
      [27, 28, 29, 30].forEach(i => { lms[i].y = 0.9; });
      return { ...s, lms };
    });
    const r = analyzeVolleyball(flat, 'volleyball_serve');
    expect(r.metrics.jump_height_cm).toBeUndefined();
    expect(r.notes.find(n => n.text.includes('No se detectó salto'))?.level).toBe('info');
    expect(r.metrics.elbow_angle_contact).toBeDefined();
  });

  it('en un remate sin salto detectado sí es advertencia', () => {
    const flat = clip(60, 0.45).map(s => {
      const lms = s.lms.map(p => ({ ...p }));
      [27, 28, 29, 30].forEach(i => { lms[i].y = 0.9; });
      return { ...s, lms };
    });
    const r = analyzeVolleyball(flat, 'volleyball_spike');
    expect(r.notes.find(n => n.text.includes('fase de vuelo'))?.level).toBe('warn');
  });

  it('con pocos cuadros no inventa métricas', () => {
    const r = analyzeVolleyball(clip(60, 0.45).slice(0, 4), 'volleyball_spike');
    expect(r.ok).toBe(false);
    expect(r.metrics).toEqual({});
  });
});
