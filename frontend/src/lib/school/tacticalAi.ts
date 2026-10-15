/**
 * «Analizar jugada» con IA (M3 de docs/specs/pizarra-multideporte-3d-ia.md, D6).
 * Llamadas al BFF (bff/src/routes/school/tactical-ai.ts) y conversión de las
 * sugerencias al formato de la pizarra. Lógica pura salvo las dos llamadas.
 *
 * El BFF devuelve los cuadros de cada sugerencia con las claves REALES de los
 * jugadores propios (las mismas del tablero) y los rivales como `rival:N`. La
 * pizarra dibuja a los rivales como material «Rival» (figura 'opponent'), así
 * que «Guardar como nueva jugada» pasa cada `rival:N` a una figura 'opponent'
 * en la MISMA posición de la lista en todos los cuadros (así se desliza entre
 * cuadros) y el balón a una figura 'ball' (la pizarra mueve el balón como
 * material, ver hydrateFrames({ ballAsObject })).
 */
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { salesWhatsappLink } from '@/lib/salesContact';
import type { TacticalArrow, TacticalArrowColor } from './footballQueries';
import { newFrameId } from './tacticalAnimation';
import { DEFAULT_FRAME_MS, MAX_FRAMES, type TacticalFrame } from './tacticalFrames';
import type { TacticalSport } from './tacticalSports';

export const AI_SPORTS: readonly TacticalSport[] = ['futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano'];
export const hasAiAnalysis = (sport: TacticalSport | null | undefined): boolean => !!sport && AI_SPORTS.includes(sport);

export const RIVAL_KEY_PREFIX = 'rival:';
export const isRivalKey = (k: string) => k.startsWith(RIVAL_KEY_PREFIX);

/**
 * Cupo de IA por COSTO REAL (spec §6, decisión 2026-10-14; BFF
 * services/tactical-ai-budget.ts). El coach ve «Te queda el 60 % de tu IA este
 * mes · unos 9 análisis de fútbol 11»; agotado, «Quiero más» abre WhatsApp con
 * el comercial (no hay compra en la app todavía: el precio se fija midiendo).
 */
export interface AiBalance {
  period: string;
  used_usd: number;
  budget_usd: number;
  remaining_usd: number;
  /** % usado (0–100). */
  pct: number;
  /** % que queda (0–100). */
  remaining_pct: number;
  exhausted: boolean;
  limited_by: 'user' | 'school' | null;
  approx_remaining: Partial<Record<TacticalSport, number>>;
  analyses: number;
  cache_hits: number;
  /** Solo cuando está agotado: mensaje pre-llenado para el comercial. */
  request_more_message?: string;
}

/** Nombre del deporte en la barra y en el mensaje («unos 9 análisis de fútbol 11»). */
export const AI_SPORT_LABEL: Partial<Record<TacticalSport, string>> = {
  futbol: 'fútbol 11', futbol7: 'fútbol 7', futbol5: 'fútbol 5', futsal: 'futsal',
  voleibol: 'voleibol', baloncesto: 'baloncesto', balonmano: 'balonmano',
};

export interface AiRisk { titulo: string; detalle: string; zona?: string }
export interface AiSuggestion { titulo: string; explicacion: string; frames: TacticalFrame[] }
export interface AiResult {
  lectura: string;
  riesgos: AiRisk[];
  contraataques: AiSuggestion[];
  variantes: AiSuggestion[];
}
export interface AiAnalysisResponse {
  result: AiResult;
  cached: boolean;
  balance: AiBalance | null;
  /** Clave interna del análisis (p1..pN) → clave real del tablero. */
  keys?: Record<string, string>;
}

export interface AnalyzeRequest {
  team_id: string;
  sport: TacticalSport;
  frames: TacticalFrame[];
  labels: Record<string, string>;
  colors: { own: TacticalArrowColor; rival: TacticalArrowColor };
}

export type AnalyzeOutcome =
  | { kind: 'ok'; data: AiAnalysisResponse }
  | { kind: 'needs_more'; balance: AiBalance | null; message: string; requestMoreMessage: string | null }
  | { kind: 'error'; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Color de los rivales dibujados (primer 'opponent'), o rojo. */
export function rivalColorOf(frames: TacticalFrame[]): TacticalArrowColor {
  for (const f of frames) for (const a of f.arrows) if (a.type === 'opponent' && a.color) return a.color;
  return 'red';
}

/** Lo que se manda: cuadros saneados y SOLO la etiqueta de puesto de cada
 *  jugador (el BFF descarta además todo lo que no sea vocabulario de puesto). */
export function buildAnalyzeRequest(args: {
  teamId: string;
  sport: TacticalSport;
  frames: TacticalFrame[];
  labelOf: (key: string) => string | undefined;
}): AnalyzeRequest {
  const frames = args.frames.slice(0, MAX_FRAMES).map((f) => ({
    id: f.id,
    duration_ms: f.duration_ms,
    players: f.players.map((p) => ({ key: p.key, x: round2(p.x), y: round2(p.y) })),
    ball: f.ball ? { x: round2(f.ball.x), y: round2(f.ball.y) } : null,
    // El texto y el lápiz no le sirven al análisis (y el texto puede tener nombres).
    arrows: f.arrows.filter((a) => a.type !== 'text' && a.type !== 'freehand'),
  }));
  const labels: Record<string, string> = {};
  for (const f of frames) for (const p of f.players) {
    const l = args.labelOf(p.key);
    if (l && !(p.key in labels)) labels[p.key] = l.slice(0, 40);
  }
  return { team_id: args.teamId, sport: args.sport, frames, labels, colors: { own: 'green', rival: rivalColorOf(frames) } };
}

function messageOf(err: unknown): string {
  if (err instanceof BFFError) {
    const body = err.body as { error?: string } | undefined;
    if (err.status === 429) return body?.error ?? 'Vas muy rápido: espera un minuto antes de analizar otra jugada.';
    if (body?.error) return body.error;
    if (err.status >= 500) return 'La IA no está disponible en este momento. Intenta en unos minutos.';
    return err.message;
  }
  return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
}

export async function analyzePlay(req: AnalyzeRequest): Promise<AnalyzeOutcome> {
  try {
    const data = await bffClient.post<AiAnalysisResponse>('/api/v1/school/tactical/analyze', req);
    return { kind: 'ok', data: { ...data, result: normalizeResult(data.result) } };
  } catch (err) {
    if (err instanceof BFFError && err.status === 402) {
      const body = err.body as { error?: string; balance?: AiBalance; request_more_message?: string } | undefined;
      return {
        kind: 'needs_more',
        balance: body?.balance ?? null,
        message: body?.error ?? 'Usaste tu IA de este mes.',
        requestMoreMessage: body?.request_more_message ?? null,
      };
    }
    return { kind: 'error', message: messageOf(err) };
  }
}

export async function fetchAiBalance(sport?: TacticalSport): Promise<AiBalance | null> {
  try {
    const q = sport ? `?sport=${encodeURIComponent(sport)}` : '';
    return await bffClient.get<AiBalance>(`/api/v1/school/tactical/ai-balance${q}`);
  } catch {
    return null;
  }
}

/** Defensa en el cliente: el BFF ya validó, pero un cuadro roto no debe romper la pizarra. */
export function normalizeResult(raw: unknown): AiResult {
  const r = (raw ?? {}) as Partial<AiResult>;
  const sugg = (list: unknown): AiSuggestion[] => (Array.isArray(list) ? list : [])
    .filter((s): s is AiSuggestion => !!s && typeof s === 'object' && Array.isArray((s as AiSuggestion).frames) && (s as AiSuggestion).frames.length > 0)
    .map((s) => ({ titulo: String(s.titulo ?? ''), explicacion: String(s.explicacion ?? ''), frames: s.frames }));
  return {
    lectura: typeof r.lectura === 'string' ? r.lectura : '',
    riesgos: Array.isArray(r.riesgos) ? r.riesgos.filter((x) => x && typeof x.titulo === 'string') : [],
    contraataques: sugg(r.contraataques),
    variantes: sugg(r.variantes),
  };
}

// ─── Textos sin claves internas ─────────────────────────────────────────────
//
// El análisis nombra a los jugadores por puesto, pero si el modelo escribe una
// clave interna («p5», «r4») el coach no sabe quién es. Antes de mostrar
// CUALQUIER texto se cambia: pN → etiqueta del jugador en la cancha (o «jugador
// N»), rN → «rival N». «(p5)» después de un puesto sobra y se quita.

const PAREN_KEY_RE = /\s*\(\s*[pr]\d{1,2}\s*\)/g;
const KEY_RE = /\b([pr])(\d{1,2})\b/g;

export function humanizeText(
  text: string,
  keys: Record<string, string> | undefined,
  labelOf: (boardKey: string) => string | undefined,
): string {
  if (!text) return text;
  return text
    .replace(PAREN_KEY_RE, '')
    .replace(KEY_RE, (_m, kind: string, n: string) => {
      if (kind === 'r') return `rival ${Number(n)}`;
      const real = keys?.[`p${Number(n)}`];
      const label = real ? labelOf(real)?.trim() : undefined;
      return label || `jugador ${Number(n)}`;
    });
}

/** Todo el texto del análisis (lectura, riesgos, contraataques, variantes) sin claves internas. */
export function humanizeResult(
  r: AiResult,
  keys: Record<string, string> | undefined,
  labelOf: (boardKey: string) => string | undefined,
): AiResult {
  const h = (t: string) => humanizeText(t, keys, labelOf);
  const sug = (s: AiSuggestion): AiSuggestion => ({ ...s, titulo: h(s.titulo), explicacion: h(s.explicacion) });
  return {
    lectura: h(r.lectura),
    riesgos: r.riesgos.map((x) => ({ ...x, titulo: h(x.titulo), detalle: h(x.detalle), ...(x.zona ? { zona: h(x.zona) } : {}) })),
    contraataques: r.contraataques.map(sug),
    variantes: r.variantes.map(sug),
  };
}

/** «Te queda el 60 % de tu IA este mes · unos 9 análisis de fútbol 11». */
export function quotaLabel(b: AiBalance | null, sport: TacticalSport): string | null {
  if (!b) return null;
  if (b.exhausted) return 'Usaste tu IA de este mes';
  const head = `Te queda el ${b.remaining_pct} % de tu IA este mes`;
  const n = b.approx_remaining?.[sport];
  const label = AI_SPORT_LABEL[sport];
  if (n == null || !label) return head;
  return `${head} · ${n === 1 ? 'un análisis' : `unos ${n} análisis`} de ${label}`;
}

const usdText = (n: number) => `US$ ${(Number.isFinite(n) ? n : 0).toFixed(2).replace('.', ',')}`;

/**
 * Mensaje de «Quiero más» si el BFF no lo mandó: deporte y consumo del mes,
 * nada de atletas (la función no recibe nada de ellos).
 */
export function fallbackMoreMessage(b: AiBalance | null, sport: TacticalSport): string {
  const label = AI_SPORT_LABEL[sport];
  const consumo = b ? ` Este mes: ${b.analyses} análisis, ${usdText(b.used_usd)} de ${usdText(b.budget_usd)}.` : '';
  return `Hola, uso la pizarra de SportMaps${label ? ` con ${label}` : ''} y se me acabó la IA del mes.${consumo} Quiero más cupo de IA.`;
}

const rivalIndex = (k: string) => Number(k.slice(RIVAL_KEY_PREFIX.length)) || 0;

/**
 * Sugerencia → cuadros de la pizarra (nuevos ids). Rivales como 'opponent' y
 * balón como 'ball', con índice estable entre cuadros: un rival que no está en
 * un cuadro se queda donde estuvo (o donde aparece después).
 */
export function suggestionToBoardFrames(s: AiSuggestion, rivalColor: TacticalArrowColor = 'red'): TacticalFrame[] {
  const frames = s.frames.slice(0, MAX_FRAMES);
  const rivals = [...new Set(frames.flatMap((f) => f.players.filter((p) => isRivalKey(p.key)).map((p) => p.key)))]
    .sort((a, b) => rivalIndex(a) - rivalIndex(b));
  const firstPos = new Map<string, { x: number; y: number }>();
  for (const f of frames) for (const p of f.players) if (isRivalKey(p.key) && !firstPos.has(p.key)) firstPos.set(p.key, { x: p.x, y: p.y });
  const firstBall = frames.find((f) => f.ball)?.ball ?? null;
  const last = new Map(firstPos);
  let lastBall = firstBall;
  return frames.map((f) => {
    for (const p of f.players) if (isRivalKey(p.key)) last.set(p.key, { x: p.x, y: p.y });
    if (f.ball) lastBall = f.ball;
    const opponents: TacticalArrow[] = rivals.map((k) => {
      const q = last.get(k)!;
      return { type: 'opponent', x1: q.x, y1: q.y, x2: q.x, y2: q.y, color: rivalColor };
    });
    const ball: TacticalArrow[] = lastBall ? [{ type: 'ball', x1: lastBall.x, y1: lastBall.y, x2: lastBall.x, y2: lastBall.y }] : [];
    return {
      id: newFrameId(),
      duration_ms: Number.isFinite(f.duration_ms) ? f.duration_ms : DEFAULT_FRAME_MS,
      players: f.players.filter((p) => !isRivalKey(p.key)).map((p) => ({ key: p.key, x: p.x, y: p.y })),
      ball: null,
      arrows: [...ball, ...opponents, ...f.arrows.map((a) => ({ ...a }))],
    };
  });
}

/** wa.me del comercial (lib/salesContact: VITE_SALES_WHATSAPP o +57 320 268 3539) con el mensaje. */
export function requestMoreHref(b: AiBalance | null, sport: TacticalSport, fromServer?: string | null): string {
  return salesWhatsappLink(fromServer || b?.request_more_message || fallbackMoreMessage(b, sport));
}
