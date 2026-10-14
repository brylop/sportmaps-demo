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
import type { TacticalArrow, TacticalArrowColor } from './footballQueries';
import { newFrameId } from './tacticalAnimation';
import { DEFAULT_FRAME_MS, MAX_FRAMES, type TacticalFrame } from './tacticalFrames';
import type { TacticalSport } from './tacticalSports';

export const AI_SPORTS: readonly TacticalSport[] = ['futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano'];
export const hasAiAnalysis = (sport: TacticalSport | null | undefined): boolean => !!sport && AI_SPORTS.includes(sport);

export const RIVAL_KEY_PREFIX = 'rival:';
export const isRivalKey = (k: string) => k.startsWith(RIVAL_KEY_PREFIX);

/** Paquete que se ofrece cuando se acaba el cupo (spec §6). */
export const AI_PACK_SIZE = 50;
/** Pantalla de adicionales de la escuela (MiPlanPage). */
export const AI_PURCHASE_HREF = '/mi-plan?upsell=pizarra_ia';

export interface AiBalance {
  ok?: boolean;
  remaining: number;
  free_remaining: number;
  paid_remaining: number;
  used: number;
  free_quota: number;
  period: string;
  needs_purchase: boolean;
}

export interface AiRisk { titulo: string; detalle: string; zona?: string }
export interface AiSuggestion { titulo: string; explicacion: string; frames: TacticalFrame[] }
export interface AiResult {
  lectura: string;
  riesgos: AiRisk[];
  contraataques: AiSuggestion[];
  variantes: AiSuggestion[];
}
export interface AiAnalysisResponse { result: AiResult; cached: boolean; balance: AiBalance | null }

export interface AnalyzeRequest {
  team_id: string;
  sport: TacticalSport;
  frames: TacticalFrame[];
  labels: Record<string, string>;
  colors: { own: TacticalArrowColor; rival: TacticalArrowColor };
}

export type AnalyzeOutcome =
  | { kind: 'ok'; data: AiAnalysisResponse }
  | { kind: 'needs_purchase'; balance: AiBalance | null; message: string }
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
      const body = err.body as { error?: string; balance?: AiBalance } | undefined;
      return { kind: 'needs_purchase', balance: body?.balance ?? null, message: body?.error ?? 'Se acabaron los análisis con IA de este mes.' };
    }
    return { kind: 'error', message: messageOf(err) };
  }
}

export async function fetchAiBalance(): Promise<AiBalance | null> {
  try {
    return await bffClient.get<AiBalance>('/api/v1/school/tactical/ai-balance');
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

/** «Te quedan 12 análisis este mes». */
export function balanceLabel(b: AiBalance | null): string | null {
  if (!b) return null;
  if (b.remaining <= 0) return 'No te quedan análisis este mes';
  const word = (n: number) => (n === 1 ? 'análisis' : 'análisis');
  if (b.paid_remaining > 0 && b.free_remaining > 0) {
    return `Te quedan ${b.free_remaining} ${word(b.free_remaining)} gratis este mes y ${b.paid_remaining} comprados`;
  }
  if (b.paid_remaining > 0) return `Te quedan ${b.paid_remaining} ${word(b.paid_remaining)} comprados`;
  return `Te quedan ${b.free_remaining} ${word(b.free_remaining)} este mes`;
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
