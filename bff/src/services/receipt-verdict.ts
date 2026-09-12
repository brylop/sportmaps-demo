/**
 * receipt-verdict — Pipeline de decisión determinístico para comprobantes.
 *
 * El LLM (ocr.service) SOLO extrae. Aquí las REGLAS deciden. Esta función es
 * pura y sin I/O: recibe el OcrResult + los hechos de BD ya resueltos por el
 * caller (cuentas registradas, referencia ya usada, hash duplicado) y devuelve
 * un veredicto `verde | amarillo | rojo` con la lista de razones.
 *
 * Diseño (spec §2, docs/specs/receipt-extraction-v2-glosas.md):
 *   - ROJO   → imposible/fraude. Rechazo directo, NO genera glosa.
 *   - AMARILLO → discutible. En fases siguientes abre glosa.
 *   - Se evalúan TODOS los checks (no short-circuit) para que el admin vea todo.
 *   - El veredicto final = el peor nivel presente (rojo > amarillo > verde).
 *
 * Los `code` de cada razón se alinean con GlosaReason (spec §5.2) para que las
 * fases 3+ construyan la glosa sin re-mapear.
 */

import type { OcrResult } from './ocr.service';

export type Verdict = 'verde' | 'amarillo' | 'rojo';

/** Códigos estables. Los AMARILLO mapean 1:1 a GlosaReason en fases posteriores. */
export type VerdictCode =
    | 'NOT_A_RECEIPT'
    | 'IS_TRANSACTION_LIST'
    | 'CAMPOS_ILEGIBLES'
    | 'DESTINO_NO_COINCIDE'
    | 'MONTO_DIFIERE'
    | 'FECHA_FUERA_VENTANA'
    | 'FECHA_FUTURA'
    | 'REFERENCIA_DUPLICADA'
    | 'IMAGEN_DUPLICADA'
    | 'FORMATO_REFERENCIA';

export interface VerdictReason {
    /** Nº de check en la tabla §2 (1..9). */
    check: number;
    code: VerdictCode;
    level: 'rojo' | 'amarillo';
    /** Mensaje orientado al admin/panel. El texto al acudiente se traduce en la capa de notificación. */
    message: string;
    detail?: Record<string, unknown>;
}

export interface VerdictContext {
    /** Valor esperado del cobro. Si se omite, no se evalúa el check de monto (§2.5). */
    expectedAmount?: number | null;
    /**
     * Identificadores de destino registrados de la escuela, YA normalizados con
     * normalizeDestination(). Si es undefined/vacío no se evalúa el check 4
     * (no hay con qué cruzar — típico en modo sombra sin cuentas cargadas).
     */
    registeredAccounts?: string[];
    /** Ventana de días hacia atrás permitida para la fecha (§2.6). Default 5. */
    dateWindowDays?: number;
    /** Hoy en Bogotá, ISO yyyy-mm-dd. Lo inyecta el caller (mantiene la fn pura). */
    today: string;
    /** check 7 (BD): reference_norm ya usada en la escuela. */
    referenceAlreadyUsed?: boolean;
    /** check 8 (BD): image_sha256 ya visto. */
    imageHashDuplicate?: boolean;
}

export interface VerdictResult {
    verdict: Verdict;
    reasons: VerdictReason[];
    /** Referencia normalizada (para índice único / dedup en fase 2). null si no hay referencia. */
    referenceNorm: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formas de referencia, calibradas contra comprobantes reales el 2026-09-11.
//
// El bloque anterior indexaba por banco y decía «PUNTO DE PARTIDA — calibrar con
// comprobantes reales antes de confiar». Esta es esa calibración, medida sobre
// las 317 referencias que había en la base, y cambia dos cosas de fondo.
//
// 1) NO se indexa por banco declarado, porque el banco NO es confiable. Medido:
//    comprobantes rotulados "Bancolombia" traen referencias con forma Nequi
//    (M01914211) y forma Bre-B (TRMgzmmFhKEC). Tiene sentido — Nequi es de
//    Bancolombia, y "BreB" ni siquiera es una entidad: es el riel de pagos
//    inmediatos. Elegir el patrón por el rótulo hacía fallar comprobantes sanos.
//
// 2) Una forma DESCONOCIDA ya no es sospechosa. El diseño viejo era lista blanca:
//    lo que no reconocía, lo mandaba a revisión humana. Resultado medido: 116 de
//    158 motivos de glosa eran FORMATO_REFERENCIA — el 73% — sobre comprobantes
//    buenos. Una referencia que no conocemos no es evidencia de nada; el banco
//    puede estrenar formato mañana. Ahora solo se marca lo IMPLAUSIBLE (§ abajo).
//
// Frecuencias observadas: nequi 93 · bre-b 59 · numérico 53 · riel-35 51 · uuid 32.
// ─────────────────────────────────────────────────────────────────────────────
export const REFERENCE_SHAPES: { nombre: string; re: RegExp }[] = [
    // "M00944183" (86 casos), "M1338970". Letra + 7-9 dígitos: app Nequi/Bancolombia.
    { nombre: 'app_nequi', re: /^[A-Z]\d{7,9}$/i },
    // "TRcjXnMoooEC" (59). Transfiya/Bre-B: TR + 8 alfanuméricos + EC.
    { nombre: 'breb_trec', re: /^TR[A-Z0-9]{8}EC$/i },
    // 21-35 dígitos. Id del riel nacional; aparece bajo BBVA, DaviPlata, BreB,
    // Bancolombia y "Otro" indistintamente, que es la prueba de que es del riel.
    { nombre: 'riel_largo', re: /^\d{21,35}$/ },
    // UUID completo (32). Davivienda lo usa como id de transacción.
    { nombre: 'uuid', re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
    // "1d0078924bf1" — 12 hex.
    { nombre: 'hex12', re: /^[0-9a-f]{12}$/i },
    // "93LDJV4LNT" — 10 alfanuméricos en mayúscula.
    { nombre: 'codigo10', re: /^[A-Z0-9]{10}$/i },
    // "APIU6249326017491581".
    { nombre: 'apiu', re: /^APIU\d{16}$/i },
    // "11494938", "178550921349762" — el numérico corriente.
    { nombre: 'numerico', re: /^\d{6,20}$/ },
    // "20260803901383474SRV001785778599258".
    { nombre: 'mixto_srv', re: /^\d{17}[A-Z]{3}\d{15}$/i },
];

/** Largo mínimo para que una referencia sea creíble como tal. */
const REFERENCIA_LARGO_MINIMO = 6;

/**
 * Clasifica una referencia. Devuelve el nombre de la forma si la reconoce, o un
 * problema concreto si la referencia es implausible.
 *
 * Solo dos cosas se consideran problema, y ninguna es «no la reconozco»:
 *
 *  - `truncada`: empieza como UUID pero no tiene los 36 caracteres exactos. Eso
 *    NO es otro formato, es una mala lectura del OCR — medido: 8 casos de 33 y 34
 *    caracteres. Vale la pena decirlo, porque se arregla releyendo, no revisando
 *    a mano.
 *  - `muy_corta`: menos de 6 caracteres ("0543"). Ningún banco emite eso; es un
 *    pedazo de otro número.
 */
export function clasificarReferencia(
    reference: string,
): { ok: true; forma: string } | { ok: false; problema: 'truncada' | 'muy_corta' | 'desconocida' } {
    const ref = reference.trim();

    const match = REFERENCE_SHAPES.find((s) => s.re.test(ref));
    if (match) return { ok: true, forma: match.nombre };

    // Se parece a un UUID pero no lo es → lectura cortada, no formato nuevo.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ref)) return { ok: false, problema: 'truncada' };
    if (ref.replace(/[\s-]/g, '').length < REFERENCIA_LARGO_MINIMO) return { ok: false, problema: 'muy_corta' };

    return { ok: false, problema: 'desconocida' };
}

/**
 * Normaliza una referencia para dedup/índice único: mayúsculas, sin espacios ni
 * guiones. Devuelve null si queda vacía.
 */
export function normalizeReference(reference: string | null | undefined): string | null {
    if (!reference) return null;
    const norm = reference.toUpperCase().replace(/[\s-]/g, '');
    return norm.length > 0 ? norm : null;
}

/**
 * Normaliza un identificador de destino (celular, cuenta, llave) para comparar
 * contra las cuentas registradas de la escuela: sin espacios, guiones ni puntos,
 * en mayúsculas. El caller debe normalizar las cuentas registradas con esta misma
 * función antes de pasarlas en el contexto.
 */
export function normalizeDestination(destination: string | null | undefined): string | null {
    if (!destination) return null;
    const norm = destination.toUpperCase().replace(/[\s.-]/g, '');
    return norm.length > 0 ? norm : null;
}

/** Diferencia en días calendario (a - b), tz-safe, sin depender del reloj. */
function diffDays(aIso: string, bIso: string): number | null {
    const a = parseIsoDate(aIso);
    const b = parseIsoDate(bIso);
    if (a === null || b === null) return null;
    return Math.round((a - b) / 86_400_000);
}

/** Parsea 'YYYY-MM-DD' a epoch ms UTC (medianoche). null si no es una fecha válida. */
function parseIsoDate(iso: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return Date.UTC(y, mo - 1, d);
}

const CRITICAL_FIELDS = ['amount', 'date', 'reference'] as const;

/**
 * Evalúa el veredicto de un comprobante. Pura: mismos inputs → mismo output.
 * Los checks se corren TODOS y se acumulan las razones; el veredicto final es el
 * peor nivel presente.
 */
export function evaluateVerdict(ocr: OcrResult, ctx: VerdictContext): VerdictResult {
    const reasons: VerdictReason[] = [];
    const referenceNorm = normalizeReference(ocr.reference);
    const dateWindowDays = ctx.dateWindowDays ?? 5;

    // 1) No es un comprobante de pago individual.
    if (ocr.isReceipt === false) {
        reasons.push({
            check: 1,
            code: 'NOT_A_RECEIPT',
            level: 'rojo',
            message: 'La imagen no es un comprobante de pago.',
        });
    }

    // 2) Es una lista de movimientos, no un comprobante individual.
    if (ocr.isTransactionList === true) {
        reasons.push({
            check: 2,
            code: 'IS_TRANSACTION_LIST',
            level: 'rojo',
            message: 'Sube el comprobante individual, no la lista de movimientos.',
        });
    }

    // 3) Campos críticos ilegibles/faltantes. Honramos missing_fields del modelo
    //    y, por robustez, también tratamos un valor crítico null como faltante.
    const reported = new Set(ocr.missingFields.map((f) => f.toLowerCase().trim()));
    const nullCritical = new Set<string>();
    if (ocr.amount === null) nullCritical.add('amount');
    if (ocr.date === null) nullCritical.add('date');
    if (ocr.reference === null) nullCritical.add('reference');
    const missingCritical = CRITICAL_FIELDS.filter((f) => reported.has(f) || nullCritical.has(f));
    if (missingCritical.length > 0) {
        reasons.push({
            check: 3,
            code: 'CAMPOS_ILEGIBLES',
            level: 'amarillo',
            message: 'El comprobante tiene campos ilegibles o incompletos; sube una captura completa y nítida.',
            detail: { missing: missingCritical },
        });
    }

    // 4) Destino no coincide con ninguna cuenta registrada de la escuela.
    //    Solo evaluable con destino leído Y cuentas registradas cargadas.
    const destNorm = normalizeDestination(ocr.destination);
    const accounts = ctx.registeredAccounts ?? [];
    if (destNorm && accounts.length > 0 && !accounts.includes(destNorm)) {
        reasons.push({
            check: 4,
            code: 'DESTINO_NO_COINCIDE',
            level: 'rojo',
            message: 'El dinero se envió a una cuenta que no está registrada por la escuela.',
            // comparedAgainst se persiste para calibrar el modo sombra: p.ej. si la escuela
            // cobra por DaviPlata pero esa cuenta no está entre las comparadas (columna drift),
            // este rojo es un falso positivo descontable al analizar los datos.
            detail: { destination: destNorm, comparedAgainst: accounts },
        });
    }

    // 5) Monto distinto al esperado (tolerancia 0).
    if (
        typeof ctx.expectedAmount === 'number' &&
        ctx.expectedAmount > 0 &&
        typeof ocr.amount === 'number' &&
        Math.round(ocr.amount) !== Math.round(ctx.expectedAmount)
    ) {
        reasons.push({
            check: 5,
            code: 'MONTO_DIFIERE',
            level: 'amarillo',
            message: 'El monto del comprobante no coincide con el valor esperado del cobro.',
            detail: { expected: Math.round(ctx.expectedAmount), extracted: Math.round(ocr.amount) },
        });
    }

    // 6) Fecha: futura → ROJO; fuera de la ventana hacia atrás → AMARILLO.
    if (ocr.date) {
        const delta = diffDays(ctx.today, ocr.date); // today - date; >0 = pasado, <0 = futuro
        if (delta !== null) {
            if (delta < 0) {
                reasons.push({
                    check: 6,
                    code: 'FECHA_FUTURA',
                    level: 'rojo',
                    message: 'El comprobante tiene una fecha futura.',
                    detail: { date: ocr.date, today: ctx.today },
                });
            } else if (delta > dateWindowDays) {
                reasons.push({
                    check: 6,
                    code: 'FECHA_FUERA_VENTANA',
                    level: 'amarillo',
                    message: `El comprobante es de hace ${delta} días, fuera de la ventana permitida (${dateWindowDays}).`,
                    detail: { date: ocr.date, today: ctx.today, windowDays: dateWindowDays },
                });
            }
        }
    }

    // 7) Referencia ya utilizada en la escuela.
    if (ctx.referenceAlreadyUsed === true) {
        reasons.push({
            check: 7,
            code: 'REFERENCIA_DUPLICADA',
            level: 'rojo',
            message: 'Este comprobante ya fue utilizado.',
            detail: referenceNorm ? { referenceNorm } : undefined,
        });
    }

    // 8) Hash de imagen duplicado.
    if (ctx.imageHashDuplicate === true) {
        reasons.push({
            check: 8,
            code: 'IMAGEN_DUPLICADA',
            level: 'rojo',
            message: 'Esta imagen de comprobante ya fue subida antes.',
        });
    }

    // 9) La referencia es implausible como referencia.
    //
    //    Antes: lista blanca por banco — lo que no reconocía iba a revisión humana.
    //    Eso producía el 73% de las glosas sobre comprobantes buenos (ver el bloque
    //    de REFERENCE_SHAPES). Ahora solo se marca lo que NO puede ser una
    //    referencia: una lectura cortada o un número demasiado corto. Un formato
    //    que no conocemos no es evidencia de nada.
    if (ocr.reference) {
        const clasificacion = clasificarReferencia(ocr.reference);
        if (!clasificacion.ok && clasificacion.problema !== 'desconocida') {
            reasons.push({
                check: 9,
                code: 'FORMATO_REFERENCIA',
                level: 'amarillo',
                message: clasificacion.problema === 'truncada'
                    ? 'La referencia quedó cortada al leerla; conviene volver a leer el comprobante.'
                    : 'El número de referencia es demasiado corto para ser una referencia.',
                detail: { bank: ocr.bank ?? null, reference: ocr.reference, problema: clasificacion.problema },
            });
        }
    }

    const verdict: Verdict = reasons.some((r) => r.level === 'rojo')
        ? 'rojo'
        : reasons.some((r) => r.level === 'amarillo')
          ? 'amarillo'
          : 'verde';

    return { verdict, reasons, referenceNorm };
}
