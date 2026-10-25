/**
 * volleyball.ts — analizador de saque y remate de voleibol (SportMaps Body, piloto).
 *
 * ┌─ CUMPLIMIENTO DE G-IMAGEN (ROADMAP, track VID) ─────────────────────────────────┐
 * │ Este módulo NO recibe, guarda ni sube video. Trabaja sobre las coordenadas de   │
 * │ pose (33 puntos) que MediaPipe calcula EN EL DISPOSITIVO. Lo único que sale de  │
 * │ aquí son números (métricas). El video vive y muere en el navegador; no se       │
 * │ almacena imagen de menores, así que el gate de consentimiento no se activa.     │
 * │ Si alguna fase futura necesita persistir video, G-IMAGEN vuelve a aplicar.      │
 * └─────────────────────────────────────────────────────────────────────────────────┘
 *
 * Métricas, de la más a la menos fiable:
 *  1. elbow_angle_contact    — ángulo del codo del brazo que golpea, en el punto de contacto (°).
 *  2. arm_extension_contact  — qué tan estirado está el brazo en el contacto (% de la longitud
 *                              total del brazo; 100 = brazo recto).
 *  3. jump_height_cm         — altura de salto por TIEMPO DE VUELO: h = g·t²/8. No depende de la
 *                              escala de la imagen ni de la distancia a la cámara.
 *
 * Ángulo y extensión usan las coordenadas "world" de MediaPipe (3D, en metros, centradas en la
 * cadera), que no se deforman por el ángulo de la cámara como sí lo haría un ángulo en pixeles.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface Landmark { x: number; y: number; z: number; visibility?: number; }

/** Un cuadro procesado: tiempo en segundos + los puntos de pose de ese cuadro. */
export interface PoseSample {
  t: number;
  /** Normalizados a la imagen (x,y en 0..1; y crece hacia abajo). */
  lms: Landmark[];
  /** Metros, origen en la cadera. Si falta, se degrada a 2D y se avisa. */
  world?: Landmark[];
}

export const VOLLEYBALL_ANALYZERS = ['volleyball_serve', 'volleyball_spike'] as const;
export type VolleyballAnalyzerCode = typeof VOLLEYBALL_ANALYZERS[number];
export function isVolleyballAnalyzer(code: string): code is VolleyballAnalyzerCode {
  return (VOLLEYBALL_ANALYZERS as readonly string[]).includes(code);
}

export type Arm = 'left' | 'right';

export interface AnalysisNote { level: 'warn' | 'info'; text: string; }

export interface VolleyballAnalysis {
  analyzer: VolleyballAnalyzerCode;
  ok: boolean;
  /** Solo números. Claves estables para la Fase 2 (mapeo a performance_entries). */
  metrics: Record<string, number>;
  hittingArm: Arm | null;
  hittingArmSource: 'auto' | 'manual';
  /** fps efectivos de lo que se analizó (cuadros procesados / tiempo). */
  fps: number;
  /** fps del archivo/cámara según el navegador, si se pudo medir. */
  sourceFps: number | null;
  contactTimeS: number | null;
  flight: { takeoffT: number; landingT: number; rawFlightTimeS: number } | null;
  notes: AnalysisNote[];
}

export interface AnalyzeOptions {
  /** Si se omite, se elige el brazo cuya muñeca llega más alto. */
  hittingArm?: Arm;
  /** fps reportados por el navegador (requestVideoFrameCallback o track settings). */
  sourceFps?: number | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────
export const MIN_RECOMMENDED_FPS = 60;
const G = 9.81;
const MIN_VISIBILITY = 0.5;
/** Umbral de "pies en el aire" = fracción del torso; sobre ~6 cm el ruido de pose no lo cruza. */
const AIR_THRESHOLD_TORSO_FRACTION = 0.12;
/** Saltos plausibles de voleibol juvenil/adulto: 0,2–1,0 s de vuelo ≈ 5–122 cm. */
const MIN_FLIGHT_S = 0.2;
const MAX_FLIGHT_S = 1.0;
/** Diferencia de altura entre muñecas (normalizada) bajo la cual no se confía en el auto-brazo. */
const ARM_AMBIGUITY_MARGIN = 0.03;
const MIN_SAMPLES = 10;

const L = {
  L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_ANKLE: 27, R_ANKLE: 28, L_HEEL: 29, R_HEEL: 30,
} as const;
const FOOT_POINTS = [L.L_ANKLE, L.R_ANKLE, L.L_HEEL, L.R_HEEL];

// ── Utilidades numéricas ──────────────────────────────────────────────────────
const round = (n: number, d = 1) => { const f = 10 ** d; return Math.round(n * f) / f; };

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

/** Media móvil de 3 puntos que ignora NaN (el cuadro sin dato queda NaN). */
function smooth3(xs: number[]): number[] {
  return xs.map((v, i) => {
    if (!Number.isFinite(v)) return NaN;
    const win = [xs[i - 1], v, xs[i + 1]].filter(Number.isFinite) as number[];
    return win.reduce((s, x) => s + x, 0) / win.length;
  });
}

const sub = (a: Landmark, b: Landmark) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

function angle3D(a: Landmark, b: Landmark, c: Landmark): number {
  const u = sub(a, b), v = sub(c, b);
  const m = norm(u) * norm(v);
  if (m === 0) return NaN;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / m;
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

const visible = (lm: Landmark | undefined) => !!lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;

function armIdx(arm: Arm) {
  return arm === 'left'
    ? { s: L.L_SHOULDER, e: L.L_ELBOW, w: L.L_WRIST }
    : { s: L.R_SHOULDER, e: L.R_ELBOW, w: L.R_WRIST };
}

/** fps efectivos = 1 / mediana del intervalo entre cuadros analizados. */
export function estimateEffectiveFps(samples: PoseSample[]): number {
  const dts: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt > 0) dts.push(dt);
  }
  const m = median(dts);
  return Number.isFinite(m) && m > 0 ? 1 / m : 0;
}

// ── Brazo y punto de contacto ─────────────────────────────────────────────────
/** Serie de altura de la muñeca en imagen (menor = más alto). NaN si no es visible. */
function wristSeries(samples: PoseSample[], arm: Arm): number[] {
  const { w } = armIdx(arm);
  return smooth3(samples.map(s => (visible(s.lms[w]) ? s.lms[w].y : NaN)));
}

function peakHeight(series: number[]): { idx: number; y: number } | null {
  let idx = -1, y = Infinity;
  series.forEach((v, i) => { if (Number.isFinite(v) && v < y) { y = v; idx = i; } });
  return idx >= 0 ? { idx, y } : null;
}

// ── Vuelo ─────────────────────────────────────────────────────────────────────
interface FlightResult {
  takeoffT: number; landingT: number; rawFlightTimeS: number; thresholdM: number;
}

function detectFlight(samples: PoseSample[], effFps: number): FlightResult | null {
  // Altura de los pies por cuadro: promedio de tobillos y talones visibles (≥2 puntos).
  const pts: { t: number; y: number }[] = [];
  for (const s of samples) {
    const ys = FOOT_POINTS.map(i => s.lms[i]).filter(visible).map(lm => lm.y);
    if (ys.length >= 2) pts.push({ t: s.t, y: ys.reduce((a, b) => a + b, 0) / ys.length });
  }
  if (pts.length < MIN_SAMPLES) return null;
  const ysm = smooth3(pts.map(p => p.y));

  // Torso (hombros→caderas) en imagen: fija la escala del umbral. Mediana sobre el clip.
  const torsoY = median(samples.map(s => {
    const a = s.lms[L.L_SHOULDER], b = s.lms[L.R_SHOULDER], c = s.lms[L.L_HIP], d = s.lms[L.R_HIP];
    return visible(a) && visible(b) && visible(c) && visible(d)
      ? Math.abs((c.y + d.y) / 2 - (a.y + b.y) / 2) : NaN;
  }).filter(Number.isFinite));
  if (!Number.isFinite(torsoY) || torsoY <= 0) return null;

  // Torso en metros (coordenadas world) — solo para corregir el umbral, ver más abajo.
  const torsoM = median(samples.map(s => {
    const w = s.world; if (!w) return NaN;
    const a = w[L.L_SHOULDER], b = w[L.R_SHOULDER], c = w[L.L_HIP], d = w[L.R_HIP];
    if (!a || !b || !c || !d) return NaN;
    const ms = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: 1 };
    const mh = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2, z: (c.z + d.z) / 2, visibility: 1 };
    return norm(sub(ms, mh));
  }).filter(Number.isFinite));

  // "Suelo" = donde pasan más cuadros (los pies más bajos en imagen = y más grande).
  const ground = percentile(ysm.filter(Number.isFinite), 85);
  const thr = AIR_THRESHOLD_TORSO_FRACTION * torsoY;
  const air = ysm.map(y => Number.isFinite(y) && y < ground - thr);

  // Racha más larga en el aire, sin saltar huecos de datos (> 2,5 intervalos = hueco).
  const maxGap = effFps > 0 ? 2.5 / effFps : Infinity;
  let best: [number, number] | null = null;
  let i = 0;
  while (i < air.length) {
    if (!air[i]) { i++; continue; }
    let j = i;
    while (j + 1 < air.length && air[j + 1] && pts[j + 1].t - pts[j].t <= maxGap) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
    i = j + 1;
  }
  if (!best || best[1] - best[0] + 1 < 3 || best[0] === 0 || best[1] === air.length - 1) return null;

  // Cruce del umbral con interpolación lineal (precisión sub-cuadro).
  const level = ground - thr;
  const cross = (a: number, b: number) => {
    const ya = ysm[a], yb = ysm[b];
    const f = yb === ya ? 0 : (level - ya) / (yb - ya);
    return pts[a].t + Math.max(0, Math.min(1, f)) * (pts[b].t - pts[a].t);
  };
  const takeoffT = cross(best[0] - 1, best[0]);
  const landingT = cross(best[1], best[1] + 1);

  return {
    takeoffT, landingT, rawFlightTimeS: landingT - takeoffT,
    thresholdM: Number.isFinite(torsoM) ? AIR_THRESHOLD_TORSO_FRACTION * torsoM : NaN,
  };
}

// ── Análisis ──────────────────────────────────────────────────────────────────
export function analyzeVolleyball(
  samples: PoseSample[],
  analyzer: VolleyballAnalyzerCode,
  opts: AnalyzeOptions = {},
): VolleyballAnalysis {
  const notes: AnalysisNote[] = [];
  const fps = estimateEffectiveFps(samples);
  const sourceFps = opts.sourceFps && opts.sourceFps > 0 ? opts.sourceFps : null;
  const result: VolleyballAnalysis = {
    analyzer, ok: false, metrics: {}, hittingArm: null,
    hittingArmSource: opts.hittingArm ? 'manual' : 'auto',
    fps: round(fps), sourceFps: sourceFps ? round(sourceFps) : null,
    contactTimeS: null, flight: null, notes,
  };

  if (samples.length < MIN_SAMPLES || fps === 0) {
    notes.push({ level: 'warn', text: 'No se detectó una pose suficiente. El deportista debe verse completo, de cuerpo entero, durante todo el gesto.' });
    return result;
  }

  // fps: lo que limita la precisión es lo MÁS BAJO entre el video y lo procesado.
  const worstFps = Math.min(fps, sourceFps ?? Infinity);
  if (worstFps < MIN_RECOMMENDED_FPS) {
    const dtMs = 1000 / worstFps;
    notes.push({
      level: 'warn',
      text: `El video está a ~${round(worstFps, 0)} fps (recomendado: ${MIN_RECOMMENDED_FPS} o más). El punto de contacto puede errar ±1 cuadro (±${round(dtMs, 0)} ms) y el brazo se mueve muy rápido en ese instante: tomar el codo y la extensión como orientativos.`,
    });
  }
  if (sourceFps && fps < sourceFps * 0.75) {
    notes.push({
      level: 'warn',
      text: `El video tiene ~${round(sourceFps, 0)} fps pero solo se analizaron ~${round(fps, 0)}: el dispositivo saltó cuadros. Repetir con el equipo sin otras apps abiertas.`,
    });
  }

  // 1) Brazo que golpea
  const series = { left: wristSeries(samples, 'left'), right: wristSeries(samples, 'right') };
  const peaks = { left: peakHeight(series.left), right: peakHeight(series.right) };
  let arm: Arm | null = opts.hittingArm ?? null;
  if (!arm) {
    if (!peaks.left && !peaks.right) {
      notes.push({ level: 'warn', text: 'Las muñecas no se ven con claridad. Revisar encuadre e iluminación.' });
      return result;
    }
    arm = !peaks.right || (peaks.left && peaks.left.y < peaks.right.y) ? 'left' : 'right';
    if (peaks.left && peaks.right && Math.abs(peaks.left.y - peaks.right.y) < ARM_AMBIGUITY_MARGIN) {
      notes.push({ level: 'warn', text: 'Ambas manos llegan a una altura parecida: el brazo de golpeo se eligió automáticamente y puede estar errado. Indicarlo a mano.' });
    }
  }
  result.hittingArm = arm;

  // 2) Punto de contacto = muñeca en su punto más alto
  const peak = peaks[arm];
  if (!peak) {
    notes.push({ level: 'warn', text: 'No se ve la muñeca del brazo de golpeo. No se puede ubicar el contacto.' });
    return result;
  }
  // El suavizado ubica el pico sin que el ruido lo mueva, pero lo ensancha: se afina con el dato
  // crudo en ±1 cuadro (a 60 fps un cuadro son 17 ms y el brazo se mueve rápido ahí).
  const { w: wi } = armIdx(arm);
  let ci = peak.idx;
  for (const k of [ci - 1, ci + 1]) {
    const cand = samples[k]?.lms[wi], cur = samples[ci].lms[wi];
    if (cand && visible(cand) && cand.y < cur.y) ci = k;
  }
  result.contactTimeS = round(samples[ci].t, 3);
  const idx = armIdx(arm);
  const sample = samples[ci];

  const elbowVisible = visible(sample.lms[idx.e]) && visible(sample.lms[idx.s]);
  if (!elbowVisible) {
    notes.push({ level: 'warn', text: 'Hombro o codo poco visibles en el contacto: el ángulo no es confiable.' });
  }

  if (sample.world) {
    const s = sample.world[idx.s], e = sample.world[idx.e], w = sample.world[idx.w];
    const elbow = angle3D(s, e, w);
    if (Number.isFinite(elbow)) result.metrics.elbow_angle_contact = round(elbow);
    const arm_len = norm(sub(s, e)) + norm(sub(e, w));
    if (arm_len > 0) result.metrics.arm_extension_contact = round(Math.min(1, norm(sub(s, w)) / arm_len) * 100);
  } else {
    // Degradación: ángulo en imagen (se deforma con la perspectiva).
    const s = sample.lms[idx.s], e = sample.lms[idx.e], w = sample.lms[idx.w];
    const elbow = angle3D({ ...s, z: 0 }, { ...e, z: 0 }, { ...w, z: 0 });
    if (Number.isFinite(elbow)) result.metrics.elbow_angle_contact = round(elbow);
    notes.push({ level: 'warn', text: 'No llegaron coordenadas 3D: el ángulo se calculó sobre la imagen y depende del ángulo de la cámara. La extensión no se calculó.' });
  }

  // 3) Altura de salto por tiempo de vuelo
  const flight = detectFlight(samples, fps);
  if (!flight) {
    notes.push(analyzer === 'volleyball_spike'
      ? { level: 'warn', text: 'No se detectó fase de vuelo. Para medir el salto se necesitan los pies completos en cuadro, la cámara fija, y el despegue y el aterrizaje dentro del clip.' }
      : { level: 'info', text: 'No se detectó salto. Es lo esperado en un saque flotante o por abajo; si fue saque en salto, revisar que se vean los pies.' });
  } else if (flight.rawFlightTimeS < MIN_FLIGHT_S || flight.rawFlightTimeS > MAX_FLIGHT_S) {
    notes.push({ level: 'warn', text: `El tiempo de vuelo medido (${round(flight.rawFlightTimeS, 2)} s) no es plausible para un salto: se descarta. Suele pasar si la cámara se mueve o el deportista se acerca/aleja de ella.` });
  } else {
    // Flight time medido en el cruce de un umbral sobre el suelo → subestima. Un salto parabólico
    // de apogeo H y umbral u dura T' = T·√(1−u/H), luego H = g·T'²/8 + u. Se corrige con u en
    // metros (torso world); la corrección es ~6 cm y NO depende de la escala de la imagen.
    const hRaw = (G * flight.rawFlightTimeS ** 2) / 8;
    const u = Number.isFinite(flight.thresholdM) ? flight.thresholdM : 0;
    const h = hRaw + u;
    const tCorr = Math.sqrt((8 * h) / G); // tiempo equivalente: h = g·t²/8 se cumple exacto
    // Error ±1 cuadro por borde, combinado: σT ≈ √2/fps → σh = g·T/4·σT
    const sigmaH = (G * tCorr / 4) * (Math.SQRT2 / fps);
    result.metrics.jump_height_cm = round(h * 100);
    result.metrics.flight_time_s = round(tCorr, 3);
    result.metrics.jump_height_uncertainty_cm = round(sigmaH * 100);
    result.flight = {
      takeoffT: round(flight.takeoffT, 3), landingT: round(flight.landingT, 3),
      rawFlightTimeS: round(flight.rawFlightTimeS, 3),
    };
    if (u === 0) {
      notes.push({ level: 'warn', text: 'Sin coordenadas 3D no se pudo corregir el umbral de despegue: la altura puede estar subestimada unos 5 cm.' });
    }
    if (worstFps < MIN_RECOMMENDED_FPS) {
      notes.push({ level: 'warn', text: `Altura de salto con incertidumbre ≈ ±${round(sigmaH * 100, 0)} cm a esta tasa de cuadros.` });
    }
  }

  result.metrics.frames_analyzed = samples.length;
  result.ok = result.metrics.elbow_angle_contact !== undefined;
  return result;
}
