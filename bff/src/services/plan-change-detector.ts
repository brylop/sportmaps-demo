/**
 * plan-change-detector — decide si un pago confirmado revela que la familia
 * cambió de plan sin avisar. Lógica PURA (sin base): la lee y la escribe el job.
 *
 * Medido en Dynasty (sep-oct 2026): ~44 pagos de mensualidad no coincidían con el
 * valor del plan inscrito y 38 sí coincidían con el precio de OTRO plan. Eran
 * cambios de plan que nadie registró, y por eso los cobros salían mal.
 *
 * Regla (acordada con el usuario):
 *  · Cambia SOLO, sin preguntar, cuando hay evidencia sólida: el monto coincide con
 *    el precio de EXACTAMENTE UN otro plan activo y el periodo anterior también se
 *    pagó con ese mismo monto (dos periodos seguidos).
 *  · Si no, NO cambia: avisa UNA vez a la dueña (primera vez, monto ambiguo,
 *    parcial, valor pactado a mano).
 */

export type MotivoAviso =
    | 'primera_vez'        // coincide con un único plan, pero el periodo anterior no lo confirma
    | 'ambiguo'            // el monto coincide con 2+ planes (p. ej. $90.000 = Start y Basic Seniors)
    | 'parcial'            // no coincide con ningún plan
    | 'fee_manual'         // la inscripción tiene un valor pactado a mano: nunca se cambia sola
    | 'varias_inscripciones'; // el atleta tiene 2+ inscripciones con plan: no se sabe cuál

export interface PlanLite {
    id: string;
    name: string;
    price: number;
    is_active: boolean;
}

export interface InscripcionLite {
    id: string;
    offering_plan_id: string;
    monthly_fee: number | null;
    fee_is_manual: boolean;
}

export interface PagoLite {
    id: string;
    amount: number;
    period_year: number;
    period_month: number;
}

export type Decision =
    | { tipo: 'ok' }
    | {
        tipo: 'cambiar';
        planViejo: PlanLite;
        planNuevo: PlanLite;
        monto: number;
        periodos: string[];
    }
    | {
        tipo: 'avisar';
        motivo: MotivoAviso;
        monto: number;
        planActual: PlanLite | null;
        candidatos: PlanLite[];
    };

/** Lo que se espera que pague: el valor pactado de la inscripción o, si no hay, el del plan. */
export function esperadoDe(insc: InscripcionLite, plan: PlanLite): number {
    return insc.monthly_fee != null ? Number(insc.monthly_fee) : Number(plan.price);
}

/** Periodo inmediatamente anterior ({2026,1} → {2025,12}). */
export function periodoAnterior(year: number, month: number): { year: number; month: number } {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export const etiquetaPeriodo = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Clave estable de un aviso: una por atleta y periodo, haya cuantas corridas haya. */
export function clavePlanChange(athleteKey: string, year: number, month: number): string {
    return `plan-change:${athleteKey}:${etiquetaPeriodo(year, month)}`;
}

/**
 * Evalúa un pago `paid` de mensualidad.
 *
 * @param inscripciones inscripciones ACTIVAS con plan del atleta (normalmente una).
 * @param planes        planes de la escuela (activos o no: el actual puede estar inactivo).
 * @param pagosAnteriores pagos `paid` de mensualidad del mismo atleta (cualquier periodo).
 */
export function evaluarPago(
    pago: PagoLite,
    inscripciones: InscripcionLite[],
    planes: PlanLite[],
    pagosAnteriores: PagoLite[],
): Decision {
    const monto = Number(pago.amount);
    if (!(monto > 0)) return { tipo: 'ok' };
    if (inscripciones.length === 0) return { tipo: 'ok' };

    const porId = new Map(planes.map((p) => [p.id, p]));

    if (inscripciones.length > 1) {
        return { tipo: 'avisar', motivo: 'varias_inscripciones', monto, planActual: null, candidatos: [] };
    }

    // Un pago de un periodo viejo (p. ej. septiembre aprobado tarde) no dice nada del plan de HOY si el
    // atleta ya tiene pagado un periodo posterior: ese pago más nuevo es el que manda.
    const ordinal = (p: { period_year: number; period_month: number }) => p.period_year * 12 + p.period_month;
    if (pagosAnteriores.some((p) => p.id !== pago.id && ordinal(p) > ordinal(pago))) return { tipo: 'ok' };

    const insc = inscripciones[0];
    const planActual = porId.get(insc.offering_plan_id);
    if (!planActual) return { tipo: 'ok' };

    // Pagó lo esperado, o el precio de lista de su propio plan (valor pactado distinto): no hay cambio de plan.
    if (monto === esperadoDe(insc, planActual) || monto === Number(planActual.price)) return { tipo: 'ok' };

    const candidatos = planes.filter((p) => p.is_active && p.id !== planActual.id && Number(p.price) === monto);

    if (insc.fee_is_manual) {
        return { tipo: 'avisar', motivo: 'fee_manual', monto, planActual, candidatos };
    }
    if (candidatos.length === 0) {
        return { tipo: 'avisar', motivo: 'parcial', monto, planActual, candidatos };
    }
    if (candidatos.length > 1) {
        return { tipo: 'avisar', motivo: 'ambiguo', monto, planActual, candidatos };
    }

    const previo = periodoAnterior(pago.period_year, pago.period_month);
    const confirmaElAnterior = pagosAnteriores.some((p) =>
        p.id !== pago.id
        && p.period_year === previo.year && p.period_month === previo.month
        && Number(p.amount) === monto);

    if (!confirmaElAnterior) {
        return { tipo: 'avisar', motivo: 'primera_vez', monto, planActual, candidatos };
    }

    return {
        tipo: 'cambiar',
        planViejo: planActual,
        planNuevo: candidatos[0],
        monto,
        periodos: [etiquetaPeriodo(previo.year, previo.month), etiquetaPeriodo(pago.period_year, pago.period_month)],
    };
}

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const nombrePlan = (p: PlanLite | null) => (p ? p.name.trim() : 'sin plan');

export interface Aviso {
    titulo: string;
    mensaje: string;
}

/** Aviso a la dueña cuando el sistema CAMBIÓ el plan solo. */
export function avisoCambioAplicado(atleta: string, d: Extract<Decision, { tipo: 'cambiar' }>): Aviso {
    return {
        titulo: 'Plan cambiado automáticamente',
        mensaje: `${atleta} pagó ${cop(d.monto)} dos periodos seguidos (${d.periodos.join(' y ')}), que es el valor del `
            + `${nombrePlan(d.planNuevo)}. Se pasó de ${nombrePlan(d.planViejo)} a ${nombrePlan(d.planNuevo)} para que los próximos cobros salgan bien. `
            + 'Los cobros ya emitidos no se tocaron.',
    };
}

/** Aviso a la dueña cuando NO se cambió y hay que decidir. */
export function avisoPorDecidir(atleta: string, d: Extract<Decision, { tipo: 'avisar' }>, periodo: string): Aviso {
    const actual = nombrePlan(d.planActual);
    switch (d.motivo) {
        case 'primera_vez':
            return {
                titulo: 'Pagó el valor de otro plan',
                mensaje: `${atleta} pagó ${cop(d.monto)} en ${periodo}, que equivale al ${nombrePlan(d.candidatos[0] ?? null)}, y está inscrito en ${actual}. `
                    + '¿Cambió de plan? Si se repite el próximo periodo se cambia solo; también puedes cambiarlo a mano.',
            };
        case 'ambiguo':
            return {
                titulo: 'Pagó un valor que coincide con varios planes',
                mensaje: `${atleta} pagó ${cop(d.monto)} en ${periodo}: coincide con ${d.candidatos.map(nombrePlan).join(' y ')}, y está inscrito en ${actual}. `
                    + 'No se cambió nada; dinos a cuál pasa.',
            };
        case 'parcial':
            return {
                titulo: 'Pagó un valor que no es de ningún plan',
                mensaje: `${atleta} pagó ${cop(d.monto)} en ${periodo} y está inscrito en ${actual}: el valor no coincide con ningún plan (¿abono parcial o descuento?). No se cambió nada.`,
            };
        case 'fee_manual':
            return {
                titulo: 'Pagó distinto a su valor pactado',
                mensaje: `${atleta} pagó ${cop(d.monto)} en ${periodo}; tiene un valor pactado a mano en ${actual}. Por eso no se cambia solo: revísalo.`,
            };
        case 'varias_inscripciones':
        default:
            return {
                titulo: 'Pago para revisar',
                mensaje: `${atleta} pagó ${cop(d.monto)} en ${periodo} y tiene más de una inscripción con plan: no se sabe a cuál corresponde. No se cambió nada.`,
            };
    }
}
