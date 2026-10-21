/**
 * «Separar las horas»: lógica pura (sin React) para decidir qué hacer cuando una
 * operación vende horas adicionales por adelantado y se paga por transferencia.
 *
 * La regla (Dreamers, 2026-10-21): las horas van en la MISMA operación solo si el
 * comprobante cubre el total. Si el comprobante lee menos, se bloquea y se ofrece
 * dejar el comprobante para lo principal y registrar las horas en una segunda
 * operación con su propio pago. Nunca se separa solo: lo decide la persona.
 *
 * Mismo criterio de monto que el veredicto de comprobantes y que el servidor
 * (bff/src/services/comprobante-horas.ts): pesos redondeados, tolerancia 0.
 */

/** Lo mínimo que se lee de una línea nueva (NewLineDraft cumple). */
export interface LineaConHoras {
    extra_hours?: number | null;
    /** «Ya las usó» solo cobra: no suma al banco, así que no depende del comprobante ni se separa. */
    horas_modo?: 'usadas' | 'adelantado' | null;
}

/** Línea de horas POR ADELANTADO (las que suman al banco). «Ya las usó» no cuenta. */
export const esLineaDeHoras = (l: LineaConHoras): boolean => l.horas_modo !== 'usadas' && (l.extra_hours ?? 0) > 0;

export type MotivoComprobante =
    /** El comprobante coincide con el total SIN las horas: se pagó lo principal por un lado y las horas por otro. */
    | 'coincide_sin_horas'
    /** El comprobante cubre menos que el total y tampoco es el total sin horas. */
    | 'menor_al_total';

export type DecisionComprobante =
    | { tipo: 'ok' }
    | {
        tipo: 'bloquear';
        motivo: MotivoComprobante;
        comprobante: number;
        total: number;
        horas: number;
        principal: number;
        /** Se puede separar solo si queda algo para la operación principal. */
        puedeSeparar: boolean;
    };

export interface EntradaDecision {
    metodo: 'cash' | 'transfer';
    tieneComprobante: boolean;
    /** Monto que leyó el OCR del comprobante (null/undefined = no se leyó). */
    montoLeido: number | null | undefined;
    /** Todo lo que la operación registra como pagado. */
    totalAPagar: number;
    /** La parte de ese total que son horas adicionales por adelantado. */
    horasAPagar: number;
}

const pesos = (n: number) => Math.round(n);

export function decidirComprobante(e: EntradaDecision): DecisionComprobante {
    if (e.metodo !== 'transfer' || !e.tieneComprobante) return { tipo: 'ok' };
    if (!(e.horasAPagar > 0)) return { tipo: 'ok' };
    if (e.montoLeido == null || !Number.isFinite(e.montoLeido) || e.montoLeido <= 0) return { tipo: 'ok' };

    const total = pesos(e.totalAPagar);
    const leido = pesos(e.montoLeido);
    if (leido >= total) return { tipo: 'ok' };

    const horas = pesos(e.horasAPagar);
    const principal = total - horas;
    return {
        tipo: 'bloquear',
        motivo: principal > 0 && leido === principal ? 'coincide_sin_horas' : 'menor_al_total',
        comprobante: leido,
        total,
        horas,
        principal,
        puedeSeparar: principal > 0,
    };
}

/** Suma lo que se paga de las líneas de horas, dado el `payAmount` calculado de cada línea (mismo orden). */
export function horasAPagarDeLineas(lineas: LineaConHoras[], payAmounts: number[]): number {
    return lineas.reduce((s, l, i) => (esLineaDeHoras(l) ? s + (payAmounts[i] ?? 0) : s), 0);
}

/** Reparte las líneas: lo principal se queda; las líneas de horas pasan a la segunda operación. */
export function separarLineas<T extends LineaConHoras>(lineas: T[]): { principal: T[]; horas: T[] } {
    return { principal: lineas.filter((l) => !esLineaDeHoras(l)), horas: lineas.filter(esLineaDeHoras) };
}

/** Lo que queda anotado para la segunda operación (se muestra y se ofrece al terminar la primera). */
export interface HorasPorSeparar<T extends LineaConHoras = LineaConHoras> {
    lineas: T[];
    horas: number;
    monto: number;
}

export function horasPorSeparar<T extends LineaConHoras>(horas: T[], monto: number): HorasPorSeparar<T> {
    return { lineas: horas, horas: horas.reduce((s, l) => s + (l.extra_hours ?? 0), 0), monto: pesos(monto) };
}

const COP = (n: number) => `$${pesos(n).toLocaleString('es-CO')}`;

/** Texto para la pantalla (mismos números que ve el servidor). */
export function mensajeDeComprobante(d: DecisionComprobante): string | null {
    if (d.tipo === 'ok') return null;
    if (!d.puedeSeparar) {
        return `El comprobante dice ${COP(d.comprobante)} y las horas cuestan ${COP(d.total)}. Corrige el valor o el comprobante.`;
    }
    if (d.motivo === 'coincide_sin_horas') {
        return `El comprobante dice ${COP(d.comprobante)}: es lo de ${COP(d.principal)} sin las horas (${COP(d.horas)}). Sepáralas y regístralas en otra operación con su propio pago.`;
    }
    return `El comprobante dice ${COP(d.comprobante)} y la operación registra ${COP(d.total)} con las horas. Las horas solo van aquí si el comprobante cubre todo: sepáralas o corrige los montos.`;
}
