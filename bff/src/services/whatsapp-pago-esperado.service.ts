/**
 * whatsapp-pago-esperado — «¿qué va a pagar cada quien?» (spec
 * whatsapp-conversacion-v2-dynasty §3.5, medido en Dynasty el 2026-10-24).
 *
 * El cruce de siempre compara el monto del comprobante contra los cobros YA
 * creados. Acá se arma, por deportista, el pago ESPERADO y se cruza contra él:
 *
 *   - cuota individual   (`enrollments.monthly_fee`, la fuente canónica;
 *                         precedencia monthly_fee → offering_plans.price →
 *                         teams.price_monthly, la misma de charge-batches);
 *   - precio de su plan;
 *   - suma de los hermanos;
 *   - inscripción        (`offering_plans.registration_fee`);
 *   - saldo de un cobro abonado (`status='partial'`: amount − amount_paid);
 *   - cada uno con el recargo del enlace de pago (5 %, 2026-10-13).
 *
 * REGLAS QUE NO SE NEGOCIAN
 *
 *  1. NUNCA «el monto es el precio de otro plan → cambiar de plan». Esa regla se
 *     DESCARTÓ: el plan sube por clases tomadas (otro módulo). Un monto menor a
 *     la cuota es un ABONO / saldo pendiente y el plan no se toca. Por eso los
 *     precios de planes ajenos al deportista NO son candidatos.
 *  2. Un abono nunca se aprueba solo: queda en revisión con el motivo.
 *  3. «Si está en la planilla, está pagado»: el cruce nunca marca como pagado.
 *  4. Auto-aplicar (confianza alta) lo decide el ajuste de la escuela
 *     (`school_settings.auto_approve_*`), que ya lee `evaluatePaymentReceipt`;
 *     acá solo se devuelve la acción. Por defecto queda EN REVISIÓN con la
 *     propuesta armada.
 *
 * Lo puro (`armarCandidatos`, `proponerPorMonto`, textos) se prueba sin base;
 * `calcularCandidatosDePago` es la única parte con lectura (nunca escribe,
 * nunca lanza).
 */

import { supabase } from '../config/supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Recargo del enlace de pago, en %. Ver `cargarRecargos` (el del enlace real manda). */
export const RECARGO_LINK_PCT = 5;
/** Un comprobante por debajo de este % de la cuota no se toma como abono (igual que ABONO_MINIMO). */
export const ABONO_MINIMO_PCT = 0.2;
/** Tolerancia de redondeo, en pesos. */
const TOL = 1;

export type TipoCandidato = 'cuota_individual' | 'precio_plan' | 'suma_hermanos' | 'inscripcion' | 'saldo_parcial';

export interface ParcialEsperado {
    paymentId: string;
    concepto: string | null;
    total: number;
    pagado: number;
}

export interface DeportistaEsperado {
    id: string;
    tipo: 'child' | 'unregistered';
    nombre: string | null;
    /** Lo que se espera que pague al mes (ya resuelta la precedencia), o null. */
    cuota: number | null;
    fuenteCuota: 'monthly_fee' | 'plan' | 'equipo' | null;
    nombrePlan: string | null;
    precioPlan: number | null;
    inscripcion: number | null;
    parciales: ParcialEsperado[];
}

export interface Candidato {
    tipo: TipoCandidato;
    monto: number;
    /** El mismo monto con el recargo del enlace de pago (null si no aplica). */
    conRecargo: number | null;
    deportistaIds: string[];
    deportistas: string[];
    etiqueta: string;
    paymentId?: string;
}

export type Confianza = 'alta' | 'media' | 'baja';

/**
 * Qué hacer con la propuesta:
 *  - `camino_existente`  confianza alta: sigue por donde sigue hoy un comprobante
 *                        que cuadra (el ajuste de la escuela decide si se aprueba).
 *  - `preguntar`         confianza media: una pregunta con botones a la familia.
 *  - `abono_en_revision` monto menor a la cuota: queda en revisión como abono.
 *  - `bandeja`           confianza baja: a la escuela con la propuesta armada.
 */
export type AccionPropuesta = 'camino_existente' | 'preguntar' | 'abono_en_revision' | 'bandeja';

export interface PropuestaDePago {
    confianza: Confianza;
    accion: AccionPropuesta;
    /** El candidato propuesto (null si ninguno calza). */
    candidato: Candidato | null;
    /** Alternativas cuando es ambiguo (para los botones o el motivo). */
    alternativas: Candidato[];
    /** El monto es el del enlace de pago (cuota + recargo). */
    porRecargo: boolean;
    /** Abono: lo que falta de la cuota. */
    saldo?: number;
    /** Por qué, en una línea para la escuela. */
    porQue: string;
}

const cop = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

// ─── Piezas puras ────────────────────────────────────────────────────────────

/** Precedencia de la cuota: monthly_fee → plan → equipo (D4 de charge-batches). */
export function cuotaVigente(e: {
    monthlyFee: number | null | undefined;
    feeIsManual?: boolean | null;
    precioPlan: number | null | undefined;
    precioEquipo: number | null | undefined;
}): { cuota: number | null; fuente: DeportistaEsperado['fuenteCuota'] } {
    const fee = Number(e.monthlyFee);
    if (Number.isFinite(fee) && fee > 0) return { cuota: fee, fuente: 'monthly_fee' };
    // Beca / cuota cero puesta a mano: no se espera nada, y no se cae al plan.
    if (e.feeIsManual && Number.isFinite(fee) && fee === 0) return { cuota: 0, fuente: 'monthly_fee' };
    const plan = Number(e.precioPlan);
    if (Number.isFinite(plan) && plan > 0) return { cuota: plan, fuente: 'plan' };
    const equipo = Number(e.precioEquipo);
    if (Number.isFinite(equipo) && equipo > 0) return { cuota: equipo, fuente: 'equipo' };
    return { cuota: null, fuente: null };
}

/** Monto con el recargo del enlace de pago, redondeado como el checkout. */
export function conRecargoDeLink(monto: number, pct = RECARGO_LINK_PCT): number {
    return monto + Math.round(monto * (pct / 100));
}

const primerNombre = (n: string | null | undefined) => String(n ?? '').trim().split(/\s+/)[0] || 'el deportista';

/**
 * Los candidatos de pago de una familia. Pura. Los precios de planes AJENOS al
 * deportista no entran (regla 1). Si la cuota y el precio del plan coinciden se
 * deja un solo candidato (el de la cuota individual).
 */
export function armarCandidatos(deportistas: DeportistaEsperado[], pctRecargo = RECARGO_LINK_PCT): Candidato[] {
    const out: Candidato[] = [];
    const nuevo = (c: Omit<Candidato, 'conRecargo'> & { recargable?: boolean }): Candidato => ({
        ...c, conRecargo: c.recargable === false ? null : conRecargoDeLink(c.monto, pctRecargo),
    });
    for (const d of deportistas) {
        const nombre = d.nombre ?? 'deportista sin nombre';
        if (d.cuota !== null && d.cuota > 0) {
            out.push(nuevo({
                tipo: 'cuota_individual', monto: d.cuota, deportistaIds: [d.id], deportistas: [nombre],
                etiqueta: `cuota de ${primerNombre(nombre)}${d.fuenteCuota === 'monthly_fee' ? '' : ` (${d.fuenteCuota === 'plan' ? 'precio del plan' : 'precio del equipo'})`}`,
            }));
        }
        if (d.precioPlan !== null && d.precioPlan > 0 && Math.abs(d.precioPlan - (d.cuota ?? 0)) > TOL) {
            out.push(nuevo({
                tipo: 'precio_plan', monto: d.precioPlan, deportistaIds: [d.id], deportistas: [nombre],
                etiqueta: `precio del plan${d.nombrePlan ? ` ${d.nombrePlan}` : ''} de ${primerNombre(nombre)}`,
            }));
        }
        if (d.inscripcion !== null && d.inscripcion > 0) {
            out.push(nuevo({
                tipo: 'inscripcion', monto: d.inscripcion, deportistaIds: [d.id], deportistas: [nombre],
                etiqueta: `inscripción de ${primerNombre(nombre)}`,
            }));
        }
        for (const p of d.parciales) {
            const saldo = p.total - p.pagado;
            if (saldo > 0) {
                out.push({
                    tipo: 'saldo_parcial', monto: saldo, conRecargo: null, deportistaIds: [d.id], deportistas: [nombre],
                    etiqueta: `saldo de ${p.concepto ?? 'un cobro abonado'} (${cop(p.pagado)} de ${cop(p.total)})`,
                    paymentId: p.paymentId,
                });
            }
        }
    }
    const conCuota = deportistas.filter((d) => d.cuota !== null && d.cuota > 0);
    if (conCuota.length > 1) {
        out.push(nuevo({
            tipo: 'suma_hermanos', monto: conCuota.reduce((s, d) => s + (d.cuota as number), 0),
            deportistaIds: conCuota.map((d) => d.id), deportistas: conCuota.map((d) => d.nombre ?? 'deportista'),
            etiqueta: `las cuotas de ${conCuota.map((d) => primerNombre(d.nombre)).join(' + ')}`,
        }));
    }
    return out;
}

const igual = (a: number, b: number) => Math.abs(a - b) <= TOL;

/**
 * Cruza un monto contra los candidatos. Pura.
 *
 *  - Un monto que calza con UN candidato (distinto) → propuesta.
 *  - Alta: familia con UN solo deportista + monto exacto + destino de la
 *    escuela + no repetido. Con hermanos, aunque el monto distinga a uno, es
 *    media (se confirma con botones: «mi hijo» no sale de un monto).
 *  - Monto menor a la cuota de UN deportista (≥ 20 %) → abono en revisión.
 *  - Nada calza → baja, a la bandeja.
 */
export function proponerPorMonto(e: {
    monto: number | null;
    candidatos: Candidato[];
    /** Cuántos deportistas tiene la familia (los candidatos pueden ser menos). */
    deportistasDeLaFamilia: number;
    destinoDeLaEscuela: boolean;
    noDuplicado: boolean;
}): PropuestaDePago {
    const { monto, candidatos } = e;
    if (monto === null || !(monto > 0)) {
        return { confianza: 'baja', accion: 'bandeja', candidato: null, alternativas: [], porRecargo: false, porQue: 'no se pudo leer el monto del comprobante' };
    }
    if (candidatos.length === 0) {
        return { confianza: 'baja', accion: 'bandeja', candidato: null, alternativas: [], porRecargo: false, porQue: 'no hay inscripción activa con cuota para calcular lo que se espera' };
    }

    const exactos = candidatos.filter((c) => igual(c.monto, monto));
    const porLink = candidatos.filter((c) => c.conRecargo !== null && igual(c.conRecargo, monto) && !igual(c.monto, monto));
    const calzan = exactos.length ? exactos : porLink;
    const porRecargo = exactos.length === 0 && porLink.length > 0;

    if (calzan.length === 1) {
        const c = calzan[0];
        // El precio BASE del plan es menor que la cuota vigente cuando el plan subió por
        // clases tomadas (Dynasty: 150.000 contra 180.000). Pagar el precio base es pagar
        // MENOS que el cobro: abono. Nunca «cambia de plan» ni «paga completo».
        if (c.tipo === 'precio_plan') {
            const cuota = candidatos.find((x) => x.tipo === 'cuota_individual' && x.deportistaIds[0] === c.deportistaIds[0]);
            if (cuota && monto < cuota.monto && monto >= cuota.monto * ABONO_MINIMO_PCT) {
                return {
                    confianza: 'media', accion: 'abono_en_revision', candidato: cuota, alternativas: [], porRecargo: false,
                    saldo: cuota.monto - monto,
                    porQue: `${cop(monto)} es el ${c.etiqueta}, pero la ${cuota.etiqueta} es ${cop(cuota.monto)}: abono, saldo ${cop(cuota.monto - monto)}; el plan NO se cambia`,
                };
            }
        }
        const unico = e.deportistasDeLaFamilia <= 1 || c.tipo === 'suma_hermanos';
        // Un saldo de abono y el precio de un plan nunca se aplican solos: los decide una persona.
        const alta = unico && e.destinoDeLaEscuela && e.noDuplicado && c.tipo !== 'saldo_parcial' && c.tipo !== 'precio_plan';
        return {
            confianza: alta ? 'alta' : 'media',
            accion: alta ? 'camino_existente' : c.tipo === 'saldo_parcial' ? 'bandeja' : 'preguntar',
            candidato: c, alternativas: [], porRecargo,
            porQue: `${cop(monto)} es ${porRecargo ? `${c.etiqueta} con el recargo del enlace de pago (${RECARGO_LINK_PCT} %)` : c.etiqueta}`
                + (alta ? '' : !unico ? '; la familia tiene varios deportistas: confirmar de quién es'
                    : !e.destinoDeLaEscuela ? '; el destino no es de la escuela' : '; el comprobante parece repetido'),
        };
    }
    if (calzan.length > 1) {
        // Hermanos con la misma cuota, o una cuota igual a la inscripción de otro: no se adivina.
        return {
            confianza: 'media', accion: 'preguntar', candidato: null, alternativas: calzan.slice(0, 3), porRecargo,
            porQue: `${cop(monto)} calza con ${calzan.length} cosas a la vez: ${calzan.slice(0, 3).map((c) => c.etiqueta).join(' | ')}`,
        };
    }

    // Abono: menor a la cuota de un deportista. NO se cambia el plan.
    const cuotas = candidatos.filter((c) => c.tipo === 'cuota_individual');
    const abonables = cuotas.filter((c) => monto < c.monto && monto >= c.monto * ABONO_MINIMO_PCT);
    if (abonables.length === 1) {
        const c = abonables[0];
        return {
            confianza: 'media', accion: 'abono_en_revision', candidato: c, alternativas: [], porRecargo: false,
            saldo: c.monto - monto,
            porQue: `${cop(monto)} es menor que la ${c.etiqueta} (${cop(c.monto)}): abono, saldo ${cop(c.monto - monto)}; el plan NO se cambia`,
        };
    }
    if (abonables.length > 1) {
        return {
            confianza: 'baja', accion: 'bandeja', candidato: null, alternativas: abonables.slice(0, 3), porRecargo: false,
            porQue: `${cop(monto)} es menor que varias cuotas (${abonables.slice(0, 3).map((c) => `${c.etiqueta} ${cop(c.monto)}`).join(' | ')}): decidir de quién es el abono`,
        };
    }
    const mayores = cuotas.filter((c) => monto > c.monto);
    return {
        confianza: 'baja', accion: 'bandeja', candidato: null, alternativas: [], porRecargo: false,
        porQue: `${cop(monto)} no calza con ninguna cuota esperada (${cuotas.slice(0, 3).map((c) => `${c.etiqueta} ${cop(c.monto)}`).join(' | ') || 'sin cuotas'})`
            + (mayores.length ? '; es mayor: ¿varios meses o hermanos?' : ''),
    };
}

/** La propuesta en una línea para el motivo de la bandeja (F). Pura. */
export function textoPropuesta(p: PropuestaDePago, extra: { mes?: string | null } = {}): string {
    const partes: string[] = [];
    if (p.candidato) {
        partes.push(`deportista: ${p.candidato.deportistas.join(' + ')}`);
        if (extra.mes) partes.push(`mes: ${extra.mes}`);
        partes.push(`${p.accion === 'abono_en_revision' ? 'abono a' : 'cobro:'} ${p.candidato.etiqueta} ${cop(p.candidato.monto)}`);
    } else if (p.alternativas.length) {
        partes.push(`posibles: ${p.alternativas.map((c) => `${c.deportistas.join('+')} (${c.etiqueta} ${cop(c.monto)})`).join(' | ')}`);
    }
    partes.push(`por qué: ${p.porQue}`);
    return `Propuesta → ${partes.join(' · ')}`;
}

/**
 * `error_message` con la propuesta. El código y el motivo originales van
 * PRIMERO (la bandeja y `esRecuperable` los leen por prefijo) y lo que sobra se
 * recorta del motivo, nunca de la propuesta. Máx. 500 (límite que ya usa la cola). Pura.
 */
export function motivoConPropuesta(motivoBase: string, propuesta: string | null | undefined, max = 500): string {
    if (!propuesta) return motivoBase.slice(0, max);
    const sep = ' | ';
    const reservado = propuesta.length + sep.length;
    if (reservado >= max - 40) return `${motivoBase.slice(0, 40)}${sep}${propuesta}`.slice(0, max);
    return `${motivoBase.slice(0, max - reservado)}${sep}${propuesta}`;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export interface LlavesDeDeportistas {
    childIds?: string[];
    unregisteredIds?: string[];
    /** Acudiente con cuenta: se agregan los hijos de la escuela. */
    parentId?: string | null;
}

/**
 * Los deportistas de la familia con lo que se espera que paguen. Solo lectura.
 * Nunca lanza: ante un error devuelve lo que alcanzó (o vacío).
 */
export async function deportistasEsperados(schoolId: string, k: LlavesDeDeportistas): Promise<DeportistaEsperado[]> {
    try {
        let childIds = [...(k.childIds ?? [])];
        if (k.parentId) {
            const { data: hijos } = await supabase.from('children').select('id')
                .eq('parent_id', k.parentId).eq('school_id', schoolId).eq('is_active', true);
            childIds = [...new Set([...childIds, ...((hijos ?? []) as any[]).map((h) => h.id as string)])];
        }
        const unregIds = [...(k.unregisteredIds ?? [])];
        if (!childIds.length && !unregIds.length) return [];

        const [{ data: hijos }, { data: sinReg }] = await Promise.all([
            childIds.length
                ? supabase.from('children').select('id, full_name').in('id', childIds)
                : Promise.resolve({ data: [] as any[] }),
            unregIds.length
                ? supabase.from('unregistered_athletes').select('id, full_name').in('id', unregIds)
                : Promise.resolve({ data: [] as any[] }),
        ]);
        const nombres = new Map<string, string>();
        for (const h of (hijos ?? []) as any[]) nombres.set(h.id, h.full_name);
        for (const u of (sinReg ?? []) as any[]) nombres.set(u.id, u.full_name);

        const filtros: string[] = [];
        if (childIds.length) filtros.push(`child_id.in.(${childIds.join(',')})`);
        if (unregIds.length) filtros.push(`unregistered_athlete_id.in.(${unregIds.join(',')})`);
        const { data: inscripciones } = await supabase.from('enrollments')
            .select('id, child_id, unregistered_athlete_id, monthly_fee, fee_is_manual, status, '
                + 'plan:offering_plans(name, price, registration_fee), team:teams!enrollments_team_id_fkey(price_monthly)')
            .eq('school_id', schoolId).eq('status', 'active')
            .or(filtros.join(',')).limit(100);

        const porId = new Map<string, DeportistaEsperado>();
        const asegurar = (id: string, tipo: 'child' | 'unregistered') => {
            if (!porId.has(id)) {
                porId.set(id, {
                    id, tipo, nombre: nombres.get(id) ?? null, cuota: null, fuenteCuota: null,
                    nombrePlan: null, precioPlan: null, inscripcion: null, parciales: [],
                });
            }
            return porId.get(id)!;
        };
        for (const id of childIds) asegurar(id, 'child');
        for (const id of unregIds) asegurar(id, 'unregistered');

        for (const e of (inscripciones ?? []) as any[]) {
            const id = (e.child_id ?? e.unregistered_athlete_id) as string | null;
            if (!id) continue;
            const d = asegurar(id, e.child_id ? 'child' : 'unregistered');
            const plan = Array.isArray(e.plan) ? e.plan[0] : e.plan;
            const equipo = Array.isArray(e.team) ? e.team[0] : e.team;
            const { cuota, fuente } = cuotaVigente({
                monthlyFee: e.monthly_fee, feeIsManual: e.fee_is_manual,
                precioPlan: plan?.price, precioEquipo: equipo?.price_monthly,
            });
            // Un deportista con varias inscripciones: se queda la de cuota más alta (la que más pesa).
            if (cuota !== null && (d.cuota === null || cuota > d.cuota)) {
                d.cuota = cuota; d.fuenteCuota = fuente;
                d.nombrePlan = plan?.name ?? null;
                d.precioPlan = Number(plan?.price) > 0 ? Number(plan.price) : null;
                d.inscripcion = Number(plan?.registration_fee) > 0 ? Number(plan.registration_fee) : null;
            }
        }

        // Cobros abonados: lo que falta.
        const { data: parciales } = await supabase.from('payments')
            .select('id, amount, amount_paid, concept, child_id, unregistered_athlete_id')
            .eq('school_id', schoolId).eq('status', 'partial')
            .or(filtros.join(',')).limit(50);
        for (const p of (parciales ?? []) as any[]) {
            const id = (p.child_id ?? p.unregistered_athlete_id) as string | null;
            if (!id || !porId.has(id)) continue;
            porId.get(id)!.parciales.push({
                paymentId: p.id, concepto: p.concept ?? null, total: Number(p.amount), pagado: Number(p.amount_paid ?? 0),
            });
        }
        return [...porId.values()];
    } catch {
        return [];
    }
}

export interface ResultadoCandidatos {
    deportistas: DeportistaEsperado[];
    candidatos: Candidato[];
    propuesta: PropuestaDePago;
}

/**
 * Dado(s) deportista(s) de la familia y un monto, arma los candidatos y la
 * propuesta. Solo lectura. Nunca lanza.
 */
export async function calcularCandidatosDePago(e: {
    schoolId: string;
    llaves: LlavesDeDeportistas;
    monto: number | null;
    destinoDeLaEscuela?: boolean;
    noDuplicado?: boolean;
}): Promise<ResultadoCandidatos> {
    const deportistas = await deportistasEsperados(e.schoolId, e.llaves);
    const candidatos = armarCandidatos(deportistas);
    const propuesta = proponerPorMonto({
        monto: e.monto, candidatos, deportistasDeLaFamilia: deportistas.length,
        destinoDeLaEscuela: e.destinoDeLaEscuela !== false, noDuplicado: e.noDuplicado !== false,
    });
    return { deportistas, candidatos, propuesta };
}

/**
 * ¿El ajuste de la escuela deja que un comprobante de confianza alta se apruebe
 * solo? Espejo de la condición de `evaluatePaymentReceipt` (auto_approve_enabled
 * y monto ≤ tope). Es INFORMATIVO: quien aprueba sigue siendo `evaluatePaymentReceipt`.
 * Ante la duda, false. Pura.
 */
export function autoAprobacionPermitida(
    ajuste: { auto_approve_enabled?: boolean | null; auto_approve_max_amount?: number | string | null } | null | undefined,
    monto: number | null,
): boolean {
    if (!ajuste || monto === null) return false;
    const tope = Number(ajuste.auto_approve_max_amount ?? 0);
    return ajuste.auto_approve_enabled === true && tope > 0 && monto <= tope;
}
