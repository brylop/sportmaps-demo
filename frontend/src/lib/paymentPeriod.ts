/**
 * paymentPeriod — utilidades del periodo (mes cubierto) de un cobro.
 *
 * OJO: `payment_date` (cuando entro la plata) y `period_year`/`period_month`
 * (que mes cubre) son cosas distintas. Un pago registrado el 29 de julio puede
 * cubrir agosto.
 *
 * Poblar el periodo NO es cosmetico: los indices unicos
 * uniq_payment_active_period_per_child / _adult / _unreg son PARCIALES
 * (WHERE period_year IS NOT NULL), asi que un cobro sin periodo queda fuera del
 * dedup y se puede cobrar el mismo mes dos veces. La RPC next_unpaid_period
 * tambien filtra por periodo no nulo, asi que un pago sin periodo es invisible
 * para la sugerencia del mes siguiente.
 */

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export interface PaymentPeriod {
    year: number;
    /** 1-12 */
    month: number;
}

/** Misma salida que la funcion SQL `format_period_label`. */
export function formatPeriodLabel(year: number, month: number): string {
    const name = MONTH_NAMES[month - 1] ?? String(month);
    return `${name} ${year}`;
}

/**
 * Un cobro lleva periodo solo si es una mensualidad. Inscripciones, uniformes,
 * torneos, etc. no ocupan un mes y no deben entrar al dedup por periodo.
 * Se acepta cualquier variante que mencione el mes ("Mensualidad Agosto",
 * "Cuota mensual", "Pago mensualidad").
 */
export function isMonthlyConcept(concept: string | null | undefined): boolean {
    return /mensual/i.test(concept ?? '');
}

/** Mes actual en Bogota, como periodo. Fallback cuando no hay RPC que consultar. */
export function currentPeriodBogota(): PaymentPeriod {
    // en-CA da YYYY-MM-DD; Intl resuelve la tz aunque el equipo este en otra.
    const iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    const [y, m] = iso.split('-');
    return { year: Number(y), month: Number(m) };
}

/** Avanza un periodo n meses (n puede ser negativo), normalizando el año. */
export function shiftPeriod({ year, month }: PaymentPeriod, months: number): PaymentPeriod {
    const zeroBased = (year * 12) + (month - 1) + months;
    return {
        year: Math.floor(zeroBased / 12),
        month: (zeroBased % 12) + 1,
    };
}

/**
 * Opciones de periodo para un selector: desde `back` meses atras hasta `fwd`
 * meses adelante del periodo base. Permite registrar un mes atrasado (lo comun
 * cuando la escuela se pone al dia) o adelantado.
 */
export function periodOptions(base: PaymentPeriod, back = 6, fwd = 6): PaymentPeriod[] {
    const out: PaymentPeriod[] = [];
    for (let i = -back; i <= fwd; i++) out.push(shiftPeriod(base, i));
    return out;
}

/** Clave estable para <SelectItem value> y comparaciones. */
export function periodKey(p: PaymentPeriod): string {
    return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function parsePeriodKey(key: string): PaymentPeriod | null {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) return null;
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { year: Number(m[1]), month };
}

/** true si el error de Supabase choca con los indices unicos de periodo. */
export function isDuplicatePeriodError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (err?.code !== '23505') return false;
    return /uniq_payment_active_period_per_(child|adult|unreg)/i.test(err.message ?? '');
}
