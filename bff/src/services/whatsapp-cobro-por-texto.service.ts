/**
 * A qué cobro va un comprobante según lo que la familia ESCRIBIÓ con él (el pie
 * de la foto y los textos cercanos) y si el monto cuadra.
 *
 * Casos de Dynasty del 2026-10-09 (la escuela no recibe abonos:
 * `school_settings.allow_installments = false`):
 *
 *   - Pie «… envío saldo sept 15 - oct 15 $80.000»: el único pendiente era la
 *     mensualidad de octubre por $150.000, y se le estampó el comprobante como
 *     un pago nuevo (amarillo, MONTO_DIFIERE). La escuela tuvo que adivinar.
 *   - $150.000 sin pie contra tres mensualidades de $180.000: no cuadra con
 *     ninguna. Ahí se pregunta (y no se aplica al que no es).
 *
 * Reglas:
 *   1. «Saldo», «resto», «abono»: se busca el cobro PARCIAL cuyo saldo es ese
 *      monto. El estampado del worker no toca cobros parciales, así que el
 *      abono lo aplica la escuela, con el resumen.
 *   2. El monto no cuadra con ningún cobro (ni suma de cobros, ni saldo de un
 *      parcial) y la escuela no recibe abonos: NO se aplica en silencio. Con un
 *      solo candidato, a la escuela con el resumen; con varios, se pregunta.
 *   3. El texto nombra el mes («octubre», «10/2026»): ese cobro, si cuadra.
 *      Varios cobros del mismo monto del MISMO deportista y el texto no dice
 *      cuál: el vencido MÁS ANTIGUO (la regla de la escuela, 2026-09-15). De
 *      deportistas distintos se sigue preguntando.
 *
 * Pura: quien la llama trae los cobros, los parciales y el ajuste.
 */

import { describirPago, type PagoPendiente } from './whatsapp-receipt-matching.service';
import { mesDePago, mesesDelTexto, montoEscrito } from './whatsapp-eleccion-de-pago.service';

/** Un cobro abonado: lo que falta es `amount - amount_paid`. */
export interface CobroParcial {
    id: string;
    amount: number;
    amount_paid: number | null;
    concept: string | null;
}

export type DecisionPorTexto =
    | { tipo: 'aplicar'; pago: PagoPendiente; motivo: 'mes_del_texto' | 'mas_antiguo' }
    | { tipo: 'preguntar'; opciones: PagoPendiente[] }
    /** No se estampa: lo aplica (o lo revisa) la escuela. */
    | { tipo: 'a_la_escuela'; resumen: string; mensaje: string; codigo: 'saldo_de_parcial' | 'monto_no_cuadra'; pagoId: string | null }
    /** Sin opinión: sigue la lógica de siempre (monto, pista, pregunta). */
    | null;

const plano = (s: string | null | undefined) =>
    String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim();

const cop = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)}`;

const SALDO_RE = /\b(saldo|resto|restante|lo que falta|lo que faltaba|abono|abonar|abone|complemento|completar|diferencia)\b/;
const HABLA_DE_PAGO_RE = /\b(pagos?|pague|pagar|comprobantes?|soportes?|transferencias?|transferi|consignacion|consigne|mensualidad|saldo|resto|abono|cuota|envio|mando|adjunto)\b/;

export interface LecturaDelComprobante {
    /** Lo que se cita en el resumen (el pie, o el primer texto que habla de pago). */
    texto: string | null;
    meses: number[];
    saldo: boolean;
    montoEscrito: number | null;
}

/**
 * Lee el pie y los textos cercanos. El pie manda; los textos del chat solo
 * cuentan si hablan de pago (si no, «el sábado de octubre hay torneo» elegiría
 * octubre).
 */
export function leerTextosDelComprobante(
    pie: string | null | undefined,
    cercanos: (string | null | undefined)[],
    pendientes: PagoPendiente[] = [],
): LecturaDelComprobante {
    const deChat = cercanos
        .map((t) => String(t ?? '').trim())
        .filter((t) => t && t !== String(pie ?? '').trim() && HABLA_DE_PAGO_RE.test(plano(t)));
    const fuentes = [String(pie ?? '').trim(), ...deChat].filter(Boolean);
    let meses: number[] = [];
    for (const f of fuentes) {
        meses = mesesDelTexto(f, pendientes);
        if (meses.length) break;
    }
    return {
        texto: fuentes[0] ? fuentes[0].replace(/\s+/g, ' ').slice(0, 160) : null,
        meses,
        saldo: fuentes.some((f) => SALDO_RE.test(plano(f))),
        montoEscrito: fuentes.map((f) => montoEscrito(f)).find((m) => m !== null) ?? null,
    };
}

/** ¿Alguna suma de cobros da el monto? (combinación de hasta 8, como `resolverPago`). */
function algunaSumaDa(pendientes: PagoPendiente[], monto: number): boolean {
    if (pendientes.length > 8) return false;
    const buscar = (i: number, resto: number, n: number): boolean => {
        if (resto === 0 && n > 1) return true;
        if (resto < 0 || i >= pendientes.length) return false;
        return buscar(i + 1, resto - pendientes[i].amount, n + 1) || buscar(i + 1, resto, n);
    };
    return buscar(0, monto, 0);
}

export function decidirCobroPorTexto(e: {
    pendientes: PagoPendiente[];
    parciales: CobroParcial[];
    /** Lo que leyó el OCR; null = no se pudo leer (no se decide por monto). */
    monto: number | null;
    lectura: LecturaDelComprobante;
    permiteAbonos: boolean;
}): DecisionPorTexto {
    const { pendientes, parciales, monto, lectura } = e;
    const saldoDe = (p: CobroParcial) => Math.max(Number(p.amount) - Number(p.amount_paid ?? 0), 0);
    const cita = lectura.texto ? ` («${lectura.texto}»)` : '';

    // 1. «Envío el saldo»: el parcial cuyo saldo es ese monto.
    if (monto !== null && lectura.saldo) {
        const parcial = parciales.filter((p) => saldoDe(p) === monto);
        if (parcial.length === 1) {
            const p = parcial[0];
            return {
                tipo: 'a_la_escuela',
                codigo: 'saldo_de_parcial',
                pagoId: p.id,
                resumen: `La familia mandó ${cop(monto)} como saldo de ${p.concept ?? 'un cobro'}${cita} ` +
                    `(abonado ${cop(Number(p.amount_paid ?? 0))} de ${cop(Number(p.amount))}). ` +
                    'Es un abono a un cobro parcial: aplíquenlo desde Pagos.',
                mensaje: `Recibí tu comprobante de *${cop(monto)}* para el saldo de *${p.concept ?? 'tu cobro'}* 📄 ` +
                    'Se lo paso a la escuela para que lo aplique y te confirme.',
            };
        }
    }

    const cuadra = (p: PagoPendiente) => monto !== null && Number(p.amount) === monto;
    const porMes = lectura.meses.length
        ? pendientes.filter((p) => { const m = mesDePago(p); return m !== null && lectura.meses.includes(m); })
        : [];

    // 2. No cuadra con nada y la escuela no recibe abonos: no en silencio.
    const algoCuadra = monto === null
        || pendientes.some(cuadra)
        || algunaSumaDa(pendientes, monto)
        || parciales.some((p) => saldoDe(p) === monto);
    if (!algoCuadra && !e.permiteAbonos && pendientes.length) {
        const pool = porMes.length ? porMes : pendientes;
        if (pool.length > 1) return { tipo: 'preguntar', opciones: pool.slice(0, 5) };
        const p = pool[0];
        return {
            tipo: 'a_la_escuela',
            codigo: 'monto_no_cuadra',
            pagoId: p.id,
            resumen: `La familia mandó un comprobante de ${cop(monto as number)}${cita} y no cuadra con ` +
                `ningún cobro pendiente (${describirPago(p)}). La escuela no recibe abonos: ` +
                'revisen a qué corresponde antes de aplicarlo.',
            mensaje: `Recibí tu comprobante de *${cop(monto as number)}* 📄 No coincide con el valor de ` +
                `*${describirPago(p)}*, así que se lo paso a la escuela para que lo revise y te confirme.`,
        };
    }

    // 3a. El texto dice el mes y ese cobro cuadra (o la escuela recibe abonos).
    if (porMes.length === 1 && (cuadra(porMes[0]) || e.permiteAbonos)) {
        return { tipo: 'aplicar', pago: porMes[0], motivo: 'mes_del_texto' };
    }

    // 3b. Varios del mismo monto: mes del texto, o el más antiguo si son del
    //     mismo deportista. `pendientes` viene del más viejo al más nuevo.
    const exactos = pendientes.filter(cuadra);
    if (exactos.length > 1) {
        const delMes = exactos.filter((p) => porMes.includes(p));
        if (delMes.length === 1) return { tipo: 'aplicar', pago: delMes[0], motivo: 'mes_del_texto' };
        const deportistas = new Set(exactos.map((p) => p.child_id ?? p.atleta ?? ''));
        if (deportistas.size === 1 && !deportistas.has('')) {
            const ordenados = [...exactos].sort((a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')));
            return { tipo: 'aplicar', pago: ordenados[0], motivo: 'mas_antiguo' };
        }
    }
    return null;
}
