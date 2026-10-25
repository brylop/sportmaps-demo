/**
 * Helpers puros de la venta de horas adicionales por adelantado (Dreamers,
 * 2026-10-21). Sin dependencias: los usan el armado de las RPC del lote
 * (`charge-batches.service`) y la suma al banco (`hour-bank-extra.service`).
 */

/** 1 → «1», 1.5 → «1,5», 2.25 → «2,25» (es-CO, sin ceros de más). */
export function formatearHoras(horas: number): string {
    const r = Math.round(horas * 100) / 100;
    return String(r).replace('.', ',');
}

/** Concepto del cobro. También es la llave con la que se encuentra el pago creado. */
export function conceptoHorasAdicionales(horas: number): string {
    return `Horas adicionales · ${formatearHoras(horas)} h`;
}

/** Horas (múltiplos de 0,25) → minutos enteros. */
export function minutosDeHoras(horas: number): number {
    return Math.round(horas * 60);
}

/** Tarifa por hora del plan = precio ÷ horas incluidas (misma fórmula de `hour_bank_overage_calc`). */
export function tarifaPorHora(precioDelPlan: number, minutosIncluidos: number): number | null {
    if (!(precioDelPlan > 0) || !(minutosIncluidos > 0)) return null;
    return Math.round(precioDelPlan / (minutosIncluidos / 60));
}
