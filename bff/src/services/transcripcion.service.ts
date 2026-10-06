/**
 * transcripcion.service — audio → texto (spec docs/specs/whatsapp-notas-de-voz.md, D1).
 *
 * Cadena: Groq `whisper-large-v3` → respaldo OpenAI `gpt-4o-mini-transcribe`.
 * Mismas llaves que ya usa el BFF (GROQ_API_KEY / OPENAI_API_KEY): cero
 * proveedores ni contratos nuevos. Groq no entrena con los datos ni los retiene
 * por defecto; es el perfil más limpio para audio de familias que hablan de
 * menores.
 *
 * Reglas:
 *  - El audio NUNCA se guarda: entra como Buffer en memoria, se manda al
 *    proveedor y se descarta. Este módulo no conoce Storage.
 *  - El texto transcrito NUNCA va a los logs: solo largo, duración y proveedor.
 *  - Nada de WhatsApp acá adentro: lo reusa MOD-30 (evaluación por voz del coach).
 *  - No lanza: devuelve `{ ok: false, motivo }`.
 *
 * Variables:
 *  - DISABLE_TRANSCRIPCION=true  → kill-switch global (motivo 'deshabilitada').
 *  - GROQ_STT_MODEL              → por si Groq retira el modelo sin aviso (ya pasó con OCR).
 *  - OPENAI_STT_MODEL            → idem para el respaldo.
 */

export const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** Timeout por proveedor. Un audio de 1 min vuelve de Groq en < 1 s. */
export const TIMEOUT_TRANSCRIPCION_MS = 15_000;

/**
 * Bytes por segundo de una nota de voz de WhatsApp (OGG/Opus mono ~16 kbps).
 * Solo para ESTIMAR la duración cuando el proveedor no la devuelve (OpenAI con
 * `gpt-4o-mini-transcribe` solo acepta `json`/`text`, sin duración).
 */
const BYTES_POR_SEGUNDO_VOZ = 2_000;

export type ProveedorStt = 'groq' | 'openai';

export interface IntentoFallido { proveedor: ProveedorStt; error: string }

export type ResultadoTranscripcion =
    | {
        ok: true;
        texto: string;
        /** Segundos. De `verbose_json` (Groq) o estimada por tamaño (OpenAI). */
        duracionS: number | null;
        duracionEstimada: boolean;
        /** Promedio ponderado por duración de `no_speech_prob` de los segmentos. */
        noSpeechProb: number | null;
        avgLogprob: number | null;
        /** exp(avg_logprob): 0–1, más alto = más seguro. null si el proveedor no lo da. */
        confianza: number | null;
        proveedor: ProveedorStt;
        modelo: string;
        ms: number;
        intentos: IntentoFallido[];
    }
    | { ok: false; motivo: string; intentos: IntentoFallido[] };

export interface OpcionesTranscripcion {
    /** ISO-639-1. 'es' por defecto. */
    idioma?: string;
    /** Vocabulario (nombres, escuela, dominio). Whisper usa hasta ~224 tokens. */
    prompt?: string;
    timeoutMs?: number;
}

const EXTENSION_POR_MIME: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
};

/** «audio/ogg; codecs=opus» → «audio/ogg». */
export function mimeBase(mime: string | null | undefined): string {
    return String(mime || '').split(';')[0].trim().toLowerCase();
}

function redondear(n: number | null, dec = 3): number | null {
    if (n === null || !Number.isFinite(n)) return null;
    const f = 10 ** dec;
    return Math.round(n * f) / f;
}

/** Promedios ponderados por duración de los segmentos de `verbose_json`. */
export function metricasDeSegmentos(segmentos: any[] | null | undefined): {
    noSpeechProb: number | null; avgLogprob: number | null;
} {
    const segs = Array.isArray(segmentos) ? segmentos : [];
    let peso = 0; let ns = 0; let lp = 0; let conNs = 0; let conLp = 0;
    for (const s of segs) {
        const d = Math.max(0.01, Number(s?.end ?? 0) - Number(s?.start ?? 0));
        if (Number.isFinite(Number(s?.no_speech_prob))) { ns += Number(s.no_speech_prob) * d; conNs++; }
        if (Number.isFinite(Number(s?.avg_logprob))) { lp += Number(s.avg_logprob) * d; conLp++; }
        peso += d;
    }
    return {
        noSpeechProb: conNs && peso ? redondear(ns / peso) : null,
        avgLogprob: conLp && peso ? redondear(lp / peso) : null,
    };
}

function formulario(buffer: Buffer, mime: string, modelo: string, extra: Record<string, string>): FormData {
    const base = mimeBase(mime) || 'audio/ogg';
    const ext = EXTENSION_POR_MIME[base] ?? 'ogg';
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(buffer)], { type: base }), `nota.${ext}`);
    fd.append('model', modelo);
    for (const [k, v] of Object.entries(extra)) if (v) fd.append(k, v);
    return fd;
}

async function errorDe(res: Response, proveedor: string): Promise<Error> {
    const cuerpo = await res.text().catch(() => '');
    return new Error(`${proveedor} ${res.status}: ${cuerpo.slice(0, 200)}`);
}

async function conGroq(buffer: Buffer, mime: string, o: Required<Pick<OpcionesTranscripcion, 'idioma' | 'timeoutMs'>> & OpcionesTranscripcion) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');
    const modelo = process.env.GROQ_STT_MODEL || 'whisper-large-v3';
    const res = await fetch(GROQ_STT_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(o.timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formulario(buffer, mime, modelo, {
            language: o.idioma,
            response_format: 'verbose_json',
            temperature: '0',
            prompt: o.prompt ?? '',
        }),
    });
    if (!res.ok) throw await errorDe(res, 'groq');
    const json: any = await res.json();
    const { noSpeechProb, avgLogprob } = metricasDeSegmentos(json?.segments);
    const duracion = Number(json?.duration);
    return {
        texto: String(json?.text ?? '').trim(),
        duracionS: Number.isFinite(duracion) ? redondear(duracion, 1) : null,
        duracionEstimada: false,
        noSpeechProb,
        avgLogprob,
        modelo,
    };
}

async function conOpenAI(buffer: Buffer, mime: string, o: Required<Pick<OpcionesTranscripcion, 'idioma' | 'timeoutMs'>> & OpcionesTranscripcion) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
    const modelo = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
    const res = await fetch(OPENAI_STT_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(o.timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}` },
        // gpt-4o-*-transcribe solo acepta `json` o `text`: sin duración ni
        // segmentos. La duración se estima por tamaño (ver BYTES_POR_SEGUNDO_VOZ).
        body: formulario(buffer, mime, modelo, {
            language: o.idioma,
            response_format: 'json',
            prompt: o.prompt ?? '',
        }),
    });
    if (!res.ok) throw await errorDe(res, 'openai');
    const json: any = await res.json();
    const duracion = Number(json?.duration);
    const tieneDuracion = Number.isFinite(duracion) && duracion > 0;
    return {
        texto: String(json?.text ?? '').trim(),
        duracionS: tieneDuracion ? redondear(duracion, 1) : redondear(buffer.byteLength / BYTES_POR_SEGUNDO_VOZ, 1),
        duracionEstimada: !tieneDuracion,
        noSpeechProb: null,
        avgLogprob: null,
        modelo,
    };
}

/**
 * Transcribe un audio. Groq primero; si falla (sin llave, error HTTP, timeout,
 * formato), OpenAI. Si ninguno puede, `{ ok: false, motivo }`.
 */
export async function transcribirAudio(
    buffer: Buffer,
    mime: string,
    opciones: OpcionesTranscripcion = {},
): Promise<ResultadoTranscripcion> {
    const intentos: IntentoFallido[] = [];
    if (process.env.DISABLE_TRANSCRIPCION === 'true') {
        return { ok: false, motivo: 'deshabilitada', intentos };
    }
    if (!buffer || buffer.byteLength === 0) return { ok: false, motivo: 'audio_vacio', intentos };
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
        return { ok: false, motivo: 'sin_llaves: faltan GROQ_API_KEY y OPENAI_API_KEY', intentos };
    }

    const o = { ...opciones, idioma: opciones.idioma || 'es', timeoutMs: opciones.timeoutMs ?? TIMEOUT_TRANSCRIPCION_MS };
    const cadena: [ProveedorStt, typeof conGroq][] = [['groq', conGroq], ['openai', conOpenAI]];

    for (const [proveedor, fn] of cadena) {
        const t0 = Date.now();
        try {
            const r = await fn(buffer, mime, o);
            const ms = Date.now() - t0;
            console.info('[transcripcion] ok', {
                proveedor, modelo: r.modelo, ms, duracion_s: r.duracionS, largo: r.texto.length,
            });
            return {
                ok: true,
                ...r,
                confianza: r.avgLogprob === null ? null : redondear(Math.exp(r.avgLogprob), 2),
                proveedor,
                ms,
                intentos,
            };
        } catch (err: any) {
            const error = err?.name === 'TimeoutError' ? 'timeout' : String(err?.message || err).slice(0, 240);
            intentos.push({ proveedor, error });
            console.warn('[transcripcion] proveedor falló', { proveedor, error });
        }
    }
    return { ok: false, motivo: intentos.map((i) => `${i.proveedor}: ${i.error}`).join(' | '), intentos };
}
