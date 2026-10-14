/**
 * desglose-mora — cómo se le muestra a la familia un cobro que ya trae mora.
 *
 * Regla de producto (2026-10-14): la mora NUNCA cancela el cobro. Con
 * late_fee_enabled, apply_late_fees() (SQL, cada noche) suma el recargo DENTRO
 * de payments.amount y lo registra en payments.late_fee_amount. Así el total
 * que se cobra ya está bien en todas partes; lo que faltaba era que la familia
 * VIERA por qué subió: «Mensualidad $150.000 · Recargo por mora $15.000 ·
 * Total $165.000».
 *
 * Importante: `late_fee_amount` ya está DENTRO del total. Aquí nunca se suma
 * otra vez; la mensualidad se obtiene restando.
 *
 * Puro (sin base ni red): lo usan los correos, los recordatorios de WhatsApp y
 * el estado de cuenta, y lo prueban sus tests.
 */

export interface DesgloseMora {
    /** Lo que queda de la mensualidad sin el recargo (total - recargo). */
    mensualidad: number;
    /** Recargo por mora incluido en el total. */
    recargo: number;
    /** Lo que se paga (amount - amount_paid, como lo calcula cada canal). */
    total: number;
}

/** Mismo formato que el resto de los avisos: «$165.000». */
export const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** payments.late_fee_amount como número (null, texto vacío o negativo → 0). */
export function recargoMora(v: number | string | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Desglose de un total que incluye `recargo` de mora; null si no hay mora (el
 * aviso se queda como siempre). El recargo se recorta al total: si un abono ya
 * cubrió la mensualidad, lo que queda es solo mora (mensualidad $0).
 */
export function desgloseMora(total: number, recargo: number | string | null | undefined): DesgloseMora | null {
    const t = Math.max(Number(total) || 0, 0);
    const r = Math.min(recargoMora(recargo), t);
    if (r <= 0) return null;
    return { mensualidad: t - r, recargo: r, total: t };
}

/** «Mensualidad $150.000 · Recargo por mora $15.000 · Total $165.000». */
export function textoDesgloseMora(d: DesgloseMora, fmt: (n: number) => string = fmtPesos): string {
    return `Mensualidad ${fmt(d.mensualidad)} · Recargo por mora ${fmt(d.recargo)} · Total ${fmt(d.total)}`;
}

/**
 * Valor para la variable de monto de las plantillas de WhatsApp aprobadas por
 * Meta (el cuerpo es fijo, solo cambia la variable). Sin mora: «$150.000», lo
 * de siempre. Con mora: «$165.000, que incluye $15.000 de recargo por mora»,
 * que se lee bien en todas las plantillas de cobro:
 *   · «… quedó pendiente la mensualidad de Samuel por {{3}}. Si tuviste …»
 *   · «… presenta 12 días de vencida (valor: {{5}}). Puedes pagar …»
 *   · «… Valor del cobro: {{6}}. El detalle …»
 * Sin paréntesis propios (la de pendiente_directo ya va entre paréntesis) y
 * sin saltos de línea (Meta rechaza la variable).
 */
export function montoConMora(total: number, recargo: number | string | null | undefined, fmt: (n: number) => string = fmtPesos): string {
    const d = desgloseMora(total, recargo);
    if (!d) return fmt(Math.max(Number(total) || 0, 0));
    return `${fmt(d.total)}, que incluye ${fmt(d.recargo)} de recargo por mora`;
}
