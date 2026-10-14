/**
 * «Analizar jugada» con IA (M3, docs/specs/pizarra-multideporte-3d-ia.md D6 y §6).
 *
 * Orden de una petición (todo con el cliente de servicio; el gate de quién
 * puede pedir lo hace la ruta):
 *   1. Jugada anónima + hash (tacticalAiShapes).
 *   2. Caché por (escuela, hash): si existe, se devuelve sin llamar al modelo y
 *      SIN descontar cupo.
 *   3. consume_tactical_ai_credit (FOR UPDATE en la base). Sin saldo →
 *      needs_purchase y NO se llama al modelo.
 *   4. Modelo (llm.service.generarJsonEstructurado) con tope de tiempo.
 *   5. Validación de la salida. Si el modelo falla o no sirve nada, se DEVUELVE
 *      el análisis (refund_tactical_ai_credit): el coach no paga un error.
 *   6. Se guarda en la caché (anónimo: claves p1..pN / r1..rN).
 */
import { supabase } from '../config/supabase';
import { generarJsonEstructurado, fallasDeError, type JsonEstructuradoResult } from './llm.service';
import {
  AI_RESULT_SCHEMA, AiOutputError, anonymizePlay, boardHash, buildSystemPrompt, buildUserPrompt,
  deanonymizeResult, promptLeaks, rosterNameTokens, validateAiResult,
  type AiResult, type AnalyzeInput,
} from '../routes/school/tacticalAiShapes';

export const TACTICAL_AI_TIMEOUT_MS = Number(process.env.TACTICAL_AI_TIMEOUT_MS) || 75_000;

export interface AiBalance {
  ok: boolean;
  remaining: number;
  free_remaining: number;
  paid_remaining: number;
  used: number;
  free_quota: number;
  period: string;
  needs_purchase: boolean;
}

export type AnalyzeOutcome =
  | { status: 200; body: { result: AiResult; cached: boolean; balance: AiBalance | null; keys: Record<string, string>; dropped?: string[] } }
  | { status: 402; body: { error: string; needs_purchase: true; balance: AiBalance } }
  | { status: 422 | 502 | 503 | 504; body: { error: string; detalle?: string } };

/** La RPC no existe todavía (migración sin aplicar): PostgREST PGRST202 / 42883. */
function isMissingRpc(err: any): boolean {
  const code = String(err?.code ?? '');
  return code === 'PGRST202' || code === '42883' || code === '42P01' || /could not find the function/i.test(String(err?.message ?? ''));
}

async function rpcBalance(name: 'consume_tactical_ai_credit' | 'refund_tactical_ai_credit' | 'tactical_ai_balance', schoolId: string) {
  const { data, error } = await supabase.rpc(name as any, { p_school_id: schoolId } as any);
  if (error) throw error;
  return data as unknown as AiBalance;
}

export async function getAiBalance(schoolId: string): Promise<AiBalance | null> {
  try {
    return await rpcBalance('tactical_ai_balance', schoolId);
  } catch (err) {
    if (isMissingRpc(err)) return null;
    throw err;
  }
}

/** Nombres del plantel del equipo (control extra de que ninguno llega al prompt). */
async function rosterNames(schoolId: string, teamId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('school_athletes' as any)
      .select('full_name')
      .eq('school_id', schoolId)
      .eq('enrolled_team_id', teamId);
    return ((data ?? []) as any[]).map((r) => String(r.full_name ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

const UNAVAILABLE: AnalyzeOutcome = {
  status: 503,
  body: { error: 'El análisis con IA todavía no está habilitado en esta cuenta. Intenta más tarde.' },
};

export async function analyzeTacticalPlay(args: {
  schoolId: string;
  userId: string;
  input: AnalyzeInput;
  log?: { warn: (o: any, m?: string) => void; info?: (o: any, m?: string) => void };
}): Promise<AnalyzeOutcome> {
  const { schoolId, userId, input, log } = args;
  const names = await rosterNames(schoolId, input.teamId);
  const { play, keyMap } = anonymizePlay(input, rosterNameTokens(names));
  const hash = boardHash(play);
  // p1..pN → clave real del tablero: el cliente la usa para que ningún «p5»
  // llegue a la pantalla aunque el modelo lo escriba en un texto.
  const keys = Object.fromEntries(keyMap);

  // 2. Caché
  const { data: cachedRow, error: cacheErr } = await supabase
    .from('tactical_ai_analyses' as any)
    .select('result')
    .eq('school_id', schoolId)
    .eq('board_hash', hash)
    .maybeSingle();
  if (cacheErr && !isMissingRpc(cacheErr)) log?.warn({ err: cacheErr }, 'tactical-ai: no se pudo leer la caché');
  if (cachedRow && (cachedRow as any).result) {
    const balance = await getAiBalance(schoolId).catch(() => null);
    return { status: 200, body: { result: deanonymizeResult((cachedRow as any).result as AiResult, keyMap), cached: true, balance, keys } };
  }

  // 3. Cupo
  let consumed: AiBalance;
  try {
    consumed = await rpcBalance('consume_tactical_ai_credit', schoolId);
  } catch (err) {
    if (isMissingRpc(err)) return UNAVAILABLE;
    throw err;
  }
  if (!consumed?.ok) {
    return {
      status: 402,
      body: { error: 'Se acabaron los análisis con IA de este mes.', needs_purchase: true, balance: consumed },
    };
  }

  const refund = async () => {
    try { return await rpcBalance('refund_tactical_ai_credit', schoolId); } catch (err) {
      log?.warn({ err }, 'tactical-ai: no se pudo devolver el análisis');
      return null;
    }
  };

  // 4. Modelo
  const system = buildSystemPrompt(input.sport);
  const user = buildUserPrompt(play);
  const leaks = promptLeaks(`${system}\n${user}`, [...names, ...keyMap.values()]);
  if (leaks.length) {
    // No debería pasar nunca (las claves se reemplazan y las etiquetas son
    // vocabulario): si pasa, no se manda nada.
    await refund();
    log?.warn({ count: leaks.length }, 'tactical-ai: el prompt tenía datos de atletas; no se envió');
    return { status: 422, body: { error: 'La jugada tiene datos personales en las etiquetas. Quítalos e intenta de nuevo.' } };
  }

  let llm: JsonEstructuradoResult;
  try {
    llm = await generarJsonEstructurado({
      system,
      user,
      schema: AI_RESULT_SCHEMA,
      maxTokens: 12_000,
      timeoutMs: TACTICAL_AI_TIMEOUT_MS,
      uso: { schoolId, feature: 'pizarra_ia' },
    });
  } catch (err: any) {
    await refund();
    const fallas = fallasDeError(err);
    log?.warn({ fallas }, 'tactical-ai: el modelo no respondió');
    const timeout = fallas.length > 0 && fallas.every((f) => /timeout|timed out|aborted/i.test(f.error));
    return timeout
      ? { status: 504, body: { error: 'La IA tardó demasiado en responder. No se descontó el análisis; intenta de nuevo.' } }
      : { status: 502, body: { error: 'La IA no está disponible en este momento. No se descontó el análisis; intenta en unos minutos.' } };
  }

  // 5. Validación
  let validated: { result: AiResult; dropped: string[] };
  try {
    validated = validateAiResult(llm.texto, { sport: input.sport, ownKeys: new Set(keyMap.keys()) });
  } catch (err) {
    await refund();
    log?.warn({ err: (err as Error).message, provider: llm.provider }, 'tactical-ai: salida inválida');
    return {
      status: 502,
      body: {
        error: 'La IA respondió algo que no se pudo usar. No se descontó el análisis; intenta de nuevo.',
        detalle: err instanceof AiOutputError ? err.code : undefined,
      },
    };
  }
  if (validated.dropped.length) log?.info?.({ dropped: validated.dropped }, 'tactical-ai: partes descartadas');

  // 6. Caché (anónima). Un choque de unique (dos coaches a la vez) no importa.
  const { error: insErr } = await supabase.from('tactical_ai_analyses' as any).insert({
    school_id: schoolId,
    team_id: input.teamId,
    board_hash: hash,
    sport: input.sport,
    result: validated.result,
    provider: llm.provider,
    model: String(llm.model).slice(0, 120),
    input_tokens: (llm.tokens?.input ?? 0) + (llm.tokens?.cacheRead ?? 0) + (llm.tokens?.cacheWrite ?? 0),
    output_tokens: llm.tokens?.output ?? 0,
    created_by: userId,
  } as any);
  if (insErr && String((insErr as any).code) !== '23505') log?.warn({ err: insErr }, 'tactical-ai: no se pudo guardar la caché');

  return {
    status: 200,
    body: {
      result: deanonymizeResult(validated.result, keyMap),
      cached: false,
      balance: consumed,
      keys,
      ...(validated.dropped.length ? { dropped: validated.dropped } : {}),
    },
  };
}
