/**
 * Escalera de avisos de saldo del banco de horas — lógica PURA (sin base ni red).
 * Plan: docs/specs/dreamers-horas-agotadas-bloqueo-y-excedentes-automaticos.md §2.1.
 *
 * Reglas:
 *  · El saldo para avisar es el «disponible para ENTRAR»: included − consumed
 *    (las reservas pendientes NO cuentan; ver plan §6-7).
 *  · Un escalón S (% de horas restantes) sale la PRIMERA vez que se observa el saldo en o
 *    por debajo de S, y una sola vez por inscripción y período.
 *  · Si de un golpe se cruzan varios escalones (p. ej. de 80 % a 15 %) se avisa SOLO el más
 *    severo y los demás se marcan como enviados en silencio (dos mensajes seguidos cansan).
 *  · Si el saldo vuelve a subir por encima del umbral (recarga de horas), la marca de ese
 *    escalón se borra y una segunda bajada vuelve a avisar.
 */

export type EscalonMarca = Record<string, string>; // {"20": "2026-10-12T15:04:05Z"}

export const ESCALONES_POR_DEFECTO = [50, 20, 0] as const;

/** Escalones válidos de la configuración: enteros 0..100, sin repetir, de mayor a menor. */
export function normalizarEscalones(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = new Set<number>();
    for (const v of raw) {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0 && n <= 100) out.add(n);
    }
    return [...out].sort((a, b) => b - a);
}

/** Porcentaje de horas que le quedan (0..100). null si el período no tiene horas incluidas. */
export function porcentajeRestante(includedMinutes: number, consumedMinutes: number): number | null {
    const inc = Number(includedMinutes);
    if (!(inc > 0)) return null;
    const restante = inc - Math.max(0, Number(consumedMinutes) || 0);
    return Math.max(0, Math.min(100, (restante / inc) * 100));
}

export interface DecisionDeAvisos {
    /** Escalón a avisar ahora (el más severo cruzado y no enviado), o null. */
    aEnviar: number | null;
    /** Escalones cruzados que se marcan como enviados sin avisar (el resto de los cruzados). */
    marcarEnSilencio: number[];
    /** Marcas a borrar porque el saldo volvió a subir por encima del umbral. */
    borrarMarcas: number[];
}

/**
 * Qué hacer con la escalera dado el % restante y las marcas ya enviadas.
 * `pct` null (sin horas) → no hace nada.
 */
export function decidirAvisos(steps: number[], pct: number | null, marcas: EscalonMarca): DecisionDeAvisos {
    const vacio: DecisionDeAvisos = { aEnviar: null, marcarEnSilencio: [], borrarMarcas: [] };
    if (pct === null || steps.length === 0) return vacio;

    const marcado = (s: number) => Object.prototype.hasOwnProperty.call(marcas, String(s));
    // Recarga: un escalón marcado cuyo umbral el saldo ya superó se puede volver a avisar.
    const borrarMarcas = steps.filter((s) => marcado(s) && pct > s);

    const cruzadosSinAvisar = steps.filter((s) => pct <= s && !marcado(s)).sort((a, b) => a - b); // el menor = más severo
    if (cruzadosSinAvisar.length === 0) return { aEnviar: null, marcarEnSilencio: [], borrarMarcas };
    const [masSevero, ...resto] = cruzadosSinAvisar;
    return { aEnviar: masSevero, marcarEnSilencio: resto, borrarMarcas };
}

/** Marcas resultantes tras aplicar la decisión (no muta la entrada). */
export function aplicarDecision(marcas: EscalonMarca, d: DecisionDeAvisos, ahoraIso: string): EscalonMarca {
    const out: EscalonMarca = { ...marcas };
    for (const s of d.borrarMarcas) delete out[String(s)];
    for (const s of d.marcarEnSilencio) out[String(s)] = ahoraIso;
    if (d.aEnviar !== null) out[String(d.aEnviar)] = ahoraIso;
    return out;
}

/** «2 h», «1 h 30 min», «45 min», «0 h». Mismo formato que formatHourBankMinutes del banco de horas. */
export function formatoHoras(minutos: number): string {
    const abs = Math.max(0, Math.round(minutos));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (h === 0 && m === 0) return '0 h';
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
}

/** Clases de `bloque` minutos que todavía caben en el saldo (siempre entero, nunca negativo). */
export function clasesRestantes(minutosRestantes: number, bloqueMinutos: number): number {
    if (!(bloqueMinutos > 0)) return 0;
    return Math.max(0, Math.floor(Math.max(0, minutosRestantes) / bloqueMinutos));
}

export interface ContextoMensaje {
    escalon: number;
    atleta: string;
    restanteMinutos: number;
    incluidoMinutos: number;
    bloqueMinutos: number;
    /** «1 de noviembre», ya formateada (se renueva el día 1). */
    seRenueva: string;
    momento: 'entrada' | 'cierre';
    /** true cuando el bloqueo físico está encendido (hoy nunca; reservado para cuando exista). */
    conBloqueo?: boolean;
}

export interface MensajeDeSaldo {
    titulo: string;
    cuerpo: string;
    severidad: 'info' | 'aviso' | 'critico';
}

/** Texto del aviso. Siempre dice cuánto le queda y cuándo se renueva. */
export function armarMensaje(c: ContextoMensaje): MensajeDeSaldo {
    const quedan = formatoHoras(c.restanteMinutos);
    const clases = clasesRestantes(c.restanteMinutos, c.bloqueMinutos);
    const renueva = `Las horas se renuevan el ${c.seRenueva}; las que no se usen no pasan al mes siguiente.`;

    if (c.escalon <= 0 || c.restanteMinutos <= 0) {
        return {
            titulo: `${c.atleta} ya usó todas sus horas`,
            cuerpo: `Con la visita de hoy, ${c.atleta} usó las ${formatoHoras(c.incluidoMinutos)} de su plan de este mes. `
                + `Para seguir entrenando antes del ${c.seRenueva} puede pedir más horas a la escuela. ${renueva}`
                + (c.conBloqueo ? ' Desde su próxima visita el lector no abrirá hasta que haya saldo.' : ''),
            severidad: 'critico',
        };
    }
    if (c.escalon >= 50) {
        return {
            titulo: `${c.atleta} ya usó la mitad de sus horas`,
            cuerpo: `Le quedan ${quedan} de las ${formatoHoras(c.incluidoMinutos)} de este mes. ${renueva}`,
            severidad: 'info',
        };
    }
    const entrada = c.momento === 'entrada' ? `${c.atleta} acaba de entrar y ` : '';
    const alcanzan = clases >= 1
        ? ` Alcanzan para ${clases} ${clases === 1 ? 'clase más' : 'clases más'} de ${formatoHoras(c.bloqueMinutos)}.`
        : ' Ya no alcanza para una clase completa.';
    return {
        titulo: `A ${c.atleta} le quedan ${quedan} este mes`,
        cuerpo: `${entrada}${entrada ? 'le' : 'Le'} quedan ${quedan} de las ${formatoHoras(c.incluidoMinutos)} de este mes.${alcanzan} ${renueva}`,
        severidad: 'aviso',
    };
}

/** Día 1 del mes siguiente a `periodEnd` (YYYY-MM-DD) o al mes de `hoy`, en español: «1 de noviembre». */
export function fechaDeRenovacion(periodEnd: string | null | undefined, hoy: string): string {
    const base = (periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ? periodEnd : hoy);
    const [y, m] = base.split('-').map(Number);
    const sig = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `1 de ${meses[sig.getUTCMonth()]}`;
}

/** ¿Es hora de mandar correos? 8:00–19:59 hora Colombia (las horas fuera de ventana se difieren). */
export function dentroDeHorarioDeCorreo(ahora: Date): boolean {
    const hBogota = (ahora.getUTCHours() + 24 - 5) % 24;
    return hBogota >= 8 && hBogota < 20;
}
