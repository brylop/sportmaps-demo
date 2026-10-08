/**
 * informe-cartera.service — el INFORME DE CARTERA de una escuela para su dueña
 * y sus admins: quién debe, qué está por vencer y quién dejó de venir.
 *
 * Pedido de la dueña de Dynasty (2026-10-07): las inscripciones ya NO se
 * cancelan por falta de pago (quedan pendientes; la cancelación automática se
 * apaga con `school_settings.auto_cancel_overdue_enabled = false`). A cambio
 * quiere ENTERARSE, cada semana, de:
 *
 *   1. MOROSOS — familias con cobros vencidos (mensualidades y otros): días de
 *      mora, meses adeudados y total, ordenadas por monto.
 *   2. PENDIENTES — cobros del mes en curso que todavía no vencen y no están
 *      pagos, y comprobantes en revisión (status 'awaiting_approval').
 *   3. INACTIVOS — atletas activos que no asisten (sin asistencia en N días,
 *      solo donde el equipo SÍ toma asistencia) y atletas dados de baja que
 *      todavía tienen saldo vivo.
 *
 * ─── Qué cobros cuentan ────────────────────────────────────────────────────
 *   · Vivos: status pending / overdue / partial / awaiting_approval.
 *     `payments.status` es TEXT (nunca castear a pay_status). Los anulados
 *     ('cancelled'), rechazados y pagados no entran.
 *   · Sin los duplicados por pagador (findDuplicatePaymentIds): la misma
 *     cuota que el atleta ya pagó en otra fila no es deuda.
 *   · Política de baja (set_school_athlete_status, 2026-07-30): inactivar un
 *     atleta cancela su plan y ANULA sus cobros pendientes. Lo que sobrevivió
 *     (cobrosDeAtletaInactivo, mismo criterio que el estado de cuenta) NO es
 *     mora: va a la sección «dados de baja con saldo» para que la escuela lo
 *     anule o lo cobre a mano.
 *   · Vencido = status 'overdue', o pending/partial con due_date < hoy (COT).
 *     Saldo = amount − amount_paid si es 'partial'; si no, amount.
 *
 * ─── Envío ──────────────────────────────────────────────────────────────────
 * Semanal, lunes 7:00 COT (cron en maintenance.job, ticks 7-11 para recoger
 * un BFF dormido), a owner + admins (destinatariosDeEscuela). Idempotente
 * ENTRE LOS TRES BFF en la base: email_sends con id determinístico
 * `informe_cartera:<escuela>:<lunes>`. Si no hay nada que contar, no se manda.
 * El correo es al personal de la escuela, no a familias: no aplica el horario
 * de cobranza de la Ley 2300.
 *
 * Además, una línea corta dentro del resumen diario de WhatsApp
 * (whatsapp-resumen-diario.job) para las escuelas con el informe activo; esa
 * línea nunca dispara el resumen por sí sola.
 *
 * ─── Activación por escuela ─────────────────────────────────────────────────
 * `school_settings.cartera_report_enabled` (migración 20261007182206):
 *   NULL  → automático: activo SOLO si la escuela apagó la cancelación
 *           automática (auto_cancel_overdue_enabled = false). Decisión: quien
 *           deja vivas las inscripciones en mora necesita la cartera a la vista;
 *           a las demás (que cancelan automático) no se les manda un correo que
 *           no pidieron.
 *   TRUE  → siempre. FALSE → nunca. Lo cambia la escuela en Finanzas → Cartera.
 * Sin la columna (migración sin aplicar) se usa el modo automático.
 * Kill-switch del proceso: DISABLE_INFORME_CARTERA=true (apaga el semanal y la
 * línea del resumen diario de ese BFF).
 */

import { supabase } from '../config/supabase';
import { findDuplicatePaymentIds } from './duplicatePayerGuard.service';
import { cobrosDeAtletaInactivo } from './estado-de-cuenta.service';
import {
    destinatariosDeEscuela, enviarConReserva, escaparHtml, fechaColombia, uuidDeClave,
} from './avisos-correo.service';
import {
    COLUMNAS_CONTACTO_FICHA, COLUMNAS_CONTACTO_HIJO, contactoDeFicha, contactoDeHijoSinCuenta, type FichaContacto,
} from './contacto-acudiente';
import { appPublica } from '../utils/url-publica-familias';

export const TIPO_INFORME = 'informe_cartera';
/** Filas por sección en el correo. El CSV de la app trae todas. */
export const TOP = 20;
/** Días sin asistencia para contar a un atleta activo como «no asiste». */
export const diasSinAsistencia = () => Math.max(3, Number(process.env.INFORME_CARTERA_DIAS_SIN_ASISTENCIA) || 14);
/** Una baja con saldo se lista con detalle si es de los últimos N días; las más viejas se resumen en una línea. */
export const DIAS_BAJA_RECIENTE = 60;
/** Hasta dónde se mira atrás la asistencia para decir «última vez que vino». */
const DIAS_HISTORIA_ASISTENCIA = 120;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface PagoCartera {
    id: string;
    parent_id: string | null;
    user_id: string | null;
    child_id: string | null;
    unregistered_athlete_id: string | null;
    concept: string | null;
    amount: number | string;
    amount_paid?: number | string | null;
    status: string;
    due_date: string | null;
    payment_type?: string | null;
    payment_category?: string | null;
    period_year?: number | null;
    period_month?: number | null;
    updated_at?: string | null;
}

export interface HijoCartera {
    id: string; full_name?: string | null; is_active?: boolean | null; parent_id?: string | null; updated_at?: string | null;
    parent_name_temp?: string | null; parent_email_temp?: string | null; parent_phone_temp?: string | null;
}
export type FichaCartera = FichaContacto & { id: string; is_active?: boolean | null; updated_at?: string | null };
export interface PerfilCartera { id: string; full_name?: string | null; email?: string | null; phone?: string | null }

/** Un atleta ACTIVO con los equipos en que está (para la sección de asistencia). */
export interface AtletaActivo { clave: string; nombre: string; equipos: string[]; equipo: string | null }
/** Una fila de attendance_records reducida. clave = 'child:<id>' | 'unreg:<id>' | 'user:<id>'. */
export interface RegistroAsistencia { clave: string; team_id: string | null; fecha: string; status: string }

export interface DatosCartera {
    schoolId: string;
    escuela: string;
    pagos: PagoCartera[];
    duplicadosExcluidos: number;
    hijos: Map<string, HijoCartera>;
    noRegistrados: Map<string, FichaCartera>;
    perfiles: Map<string, PerfilCartera>;
    /** profile_id → membresías athlete en la escuela (estado y última actualización). */
    membresiasAtleta: Map<string, { status: string; updated_at?: string | null }[]>;
    /** null = no se pudo leer (la sección se omite, el resto sale igual). */
    asistencia: { atletas: AtletaActivo[]; registros: RegistroAsistencia[] } | null;
}

export interface FilaMoroso {
    familia: string;
    telefono: string | null;
    email: string | null;
    atletas: string[];
    cobros: number;
    /** Meses distintos adeudados (periodo del cobro, o mes de vencimiento). */
    meses: number;
    mesesLista: string[];
    diasMora: number;
    venceMasAntiguo: string | null;
    total: number;
    mensualidades: number;
    otros: number;
}

export interface FilaCobro {
    familia: string;
    atleta: string;
    concepto: string;
    vence: string | null;
    saldo: number;
    /** Comprobantes: cuándo quedó en revisión (updated_at del cobro). */
    desde?: string | null;
}

export interface FilaInactivo { atleta: string; equipo: string | null; ultimaAsistencia: string | null; dias: number | null }
export interface FilaBaja { atleta: string; familia: string; bajaAprox: string | null; cobros: number; saldo: number }

export interface InformeCartera {
    schoolId: string;
    escuela: string;
    hoy: string;
    enlace: string;
    morosos: {
        filas: FilaMoroso[];
        familias: number;
        atletas: number;
        cobros: number;
        total: number;
        mensualidades: number;
        otros: number;
        porMes: { mes: string; cobros: number; total: number }[];
        porAntiguedad: { tramo: string; cobros: number; total: number }[];
    };
    pendientes: {
        porVencer: FilaCobro[];
        porVencerTotal: number;
        porVencerFamilias: number;
        enRevision: FilaCobro[];
        enRevisionTotal: number;
    };
    inactivos: {
        /** ¿La escuela tomó asistencia en la ventana? Sin datos no se acusa a nadie de no venir. */
        conDatos: boolean;
        dias: number;
        sinAsistencia: FilaInactivo[];
        bajasConSaldo: FilaBaja[];
        bajasConSaldoTotal: number;
        bajasAntiguas: { atletas: number; saldo: number };
    };
    excluidos: { duplicados: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Puras
// ─────────────────────────────────────────────────────────────────────────────

export const fmtCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** '2026-09' → 'septiembre 2026'. */
export const etiquetaMes = (mes: string) =>
    /^\d{4}-\d{2}$/.test(mes) ? `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}` : 'sin fecha';

/** Días calendario de `desde` (YYYY-MM-DD) a `hasta` (YYYY-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
    return Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

const restarDias = (fecha: string, n: number) =>
    new Date(Date.parse(`${fecha}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export const saldoDe = (p: PagoCartera) =>
    Math.max(0, Number(p.amount || 0) - (p.status === 'partial' ? Number(p.amount_paid || 0) : 0));

export function esVencido(p: PagoCartera, hoy: string): boolean {
    if (p.status === 'overdue') return true;
    if (p.status !== 'pending' && p.status !== 'partial') return false;
    return !!p.due_date && p.due_date.slice(0, 10) < hoy;
}

/** Mes al que corresponde el cobro: su periodo; si no tiene, el mes en que vence. */
export function mesDelCobro(p: PagoCartera): string {
    if (p.period_year && p.period_month) return `${p.period_year}-${String(p.period_month).padStart(2, '0')}`;
    return p.due_date ? p.due_date.slice(0, 7) : 'sin fecha';
}

/** Mensualidad u otro concepto. payment_type no es fiable solo; payment_category manda si existe. */
export function esMensualidad(p: PagoCartera): boolean {
    if (p.payment_category) return p.payment_category === 'mensualidad';
    if (/inscrip|matr[ií]cula|uniforme|torneo|kit/i.test(p.concept ?? '')) return false;
    return p.payment_type === 'subscription';
}

export function tramoDeMora(dias: number): string {
    if (dias <= 30) return '1-30 días';
    if (dias <= 60) return '31-60 días';
    if (dias <= 90) return '61-90 días';
    return 'más de 90 días';
}
const TRAMOS = ['1-30 días', '31-60 días', '61-90 días', 'más de 90 días'];

/** ¿El informe semanal está activo para esta escuela? (ver encabezado) */
export function informeActivo(ajuste: { cartera_report_enabled?: boolean | null; auto_cancel_overdue_enabled?: boolean | null } | null | undefined): boolean {
    if (!ajuste) return false;
    if (ajuste.cartera_report_enabled === true) return true;
    if (ajuste.cartera_report_enabled === false) return false;
    return ajuste.auto_cancel_overdue_enabled === false;
}

const claveAtleta = (p: { child_id?: string | null; unregistered_athlete_id?: string | null; user_id?: string | null }) =>
    p.child_id ? `child:${p.child_id}` : p.unregistered_athlete_id ? `unreg:${p.unregistered_athlete_id}` : p.user_id ? `user:${p.user_id}` : null;

interface Pagador { clave: string; nombre: string; telefono: string | null; email: string | null }

/**
 * Familia que paga el cobro. Cuenta del pagador (parent_id, o el adulto que se
 * paga solo) → acudiente con cuenta del hijo → contacto temporal que cargó la
 * escuela → ficha sin cuenta (si es menor, el ACUDIENTE, nunca el niño).
 * Dos hermanos con el mismo acudiente son UNA familia.
 */
export function pagadorDe(p: PagoCartera, d: Pick<DatosCartera, 'hijos' | 'noRegistrados' | 'perfiles'>, hoy: string): Pagador {
    const hijo = p.child_id ? d.hijos.get(p.child_id) : undefined;
    const idPerfil = p.parent_id || hijo?.parent_id || (!p.child_id && !p.unregistered_athlete_id ? p.user_id : null) || null;
    const perfil = idPerfil ? d.perfiles.get(idPerfil) : undefined;
    if (idPerfil) {
        return { clave: `perfil:${idPerfil}`, nombre: perfil?.full_name?.trim() || 'Familia sin nombre', telefono: perfil?.phone || null, email: perfil?.email || null };
    }
    if (hijo) {
        const c = contactoDeHijoSinCuenta(hijo);
        const clave = c.email ? `correo:${c.email}` : c.phone ? `tel:${c.phone.replace(/\D/g, '')}` : `child:${hijo.id}`;
        return { clave, nombre: c.nombre || 'Familia sin nombre', telefono: c.phone, email: c.email };
    }
    const ficha = p.unregistered_athlete_id ? d.noRegistrados.get(p.unregistered_athlete_id) : undefined;
    if (ficha) {
        const c = contactoDeFicha(ficha, hoy);
        const clave = c.email ? `correo:${c.email}` : c.phone ? `tel:${c.phone.replace(/\D/g, '')}` : `unreg:${ficha.id}`;
        return { clave, nombre: c.nombre || ficha.full_name || 'Familia sin nombre', telefono: c.phone, email: c.email };
    }
    return { clave: `pago:${p.id}`, nombre: 'Sin pagador', telefono: null, email: null };
}

export function nombreAtleta(p: PagoCartera, d: Pick<DatosCartera, 'hijos' | 'noRegistrados' | 'perfiles'>): string {
    if (p.child_id) return d.hijos.get(p.child_id)?.full_name?.trim() || 'Atleta sin nombre';
    if (p.unregistered_athlete_id) return d.noRegistrados.get(p.unregistered_athlete_id)?.full_name?.trim() || 'Atleta sin nombre';
    if (p.user_id) return d.perfiles.get(p.user_id)?.full_name?.trim() || 'Atleta sin nombre';
    return 'Sin atleta';
}

/** Atletas activos que no asisten. Solo se mira a quien está en un equipo que SÍ tomó asistencia en la ventana. */
export function atletasSinAsistencia(
    atletas: AtletaActivo[], registros: RegistroAsistencia[], hoy: string, dias: number,
): { conDatos: boolean; filas: FilaInactivo[] } {
    const desde = restarDias(hoy, dias);
    const equiposConAsistencia = new Set<string>();
    const ultimaPresencia = new Map<string, string>();
    let conDatos = false;
    for (const r of registros) {
        const presente = r.status === 'present' || r.status === 'late';
        if (r.fecha >= desde) {
            conDatos = true;
            if (r.team_id) equiposConAsistencia.add(r.team_id);
        }
        if (presente && (ultimaPresencia.get(r.clave) ?? '') < r.fecha) ultimaPresencia.set(r.clave, r.fecha);
    }
    const filas: FilaInactivo[] = [];
    for (const a of atletas) {
        if (!a.equipos.some((t) => equiposConAsistencia.has(t))) continue;
        const ultima = ultimaPresencia.get(a.clave) ?? null;
        if (ultima && ultima >= desde) continue;
        filas.push({ atleta: a.nombre, equipo: a.equipo, ultimaAsistencia: ultima, dias: ultima ? diasEntre(ultima, hoy) : null });
    }
    // Quien nunca vino (o hace más tiempo) primero.
    filas.sort((x, y) => (y.dias ?? 1e6) - (x.dias ?? 1e6) || x.atleta.localeCompare(y.atleta));
    return { conDatos, filas };
}

/** Arma el informe con los datos ya leídos. Pura: es lo que prueban los tests. */
export function construirInforme(d: DatosCartera, hoy: string, enlace: string, dias = diasSinAsistencia()): InformeCartera {
    const inactivosIds = cobrosDeAtletaInactivo(d.pagos as any, {
        hijos: d.hijos,
        noRegistrados: d.noRegistrados,
        membresiasAtleta: new Map([...d.membresiasAtleta].map(([k, v]) => [k, v.map((m) => m.status)])),
    });

    // ── Morosos ──
    const familias = new Map<string, FilaMoroso & { _atletas: Set<string>; _meses: Set<string> }>();
    const porMes = new Map<string, { cobros: number; total: number }>();
    const porTramo = new Map<string, { cobros: number; total: number }>();
    const atletasMorosos = new Set<string>();
    const porVencer: FilaCobro[] = [];
    const familiasPorVencer = new Set<string>();
    const enRevision: FilaCobro[] = [];
    const mesActual = hoy.slice(0, 7);
    const bajas = new Map<string, FilaBaja & { _fecha: string | null }>();

    for (const p of d.pagos) {
        const saldo = saldoDe(p);
        if (saldo <= 0) continue;
        const pagador = pagadorDe(p, d, hoy);
        const atleta = nombreAtleta(p, d);

        if (inactivosIds.has(p.id)) {
            const k = claveAtleta(p) ?? `pago:${p.id}`;
            const fecha = p.child_id ? d.hijos.get(p.child_id)?.updated_at
                : p.unregistered_athlete_id ? d.noRegistrados.get(p.unregistered_athlete_id)?.updated_at
                    : (d.membresiasAtleta.get(p.user_id ?? '') ?? []).filter((m) => m.status === 'inactive')
                        .map((m) => m.updated_at ?? '').sort().pop();
            const b = bajas.get(k) ?? { atleta, familia: pagador.nombre, bajaAprox: null, cobros: 0, saldo: 0, _fecha: fecha ? fecha.slice(0, 10) : null };
            b.cobros++; b.saldo += saldo;
            bajas.set(k, b);
            continue;
        }

        if (p.status === 'awaiting_approval') {
            enRevision.push({ familia: pagador.nombre, atleta, concepto: p.concept || 'Cobro', vence: p.due_date?.slice(0, 10) ?? null, saldo, desde: p.updated_at ?? null });
            continue;
        }

        if (esVencido(p, hoy)) {
            const f = familias.get(pagador.clave) ?? {
                familia: pagador.nombre, telefono: pagador.telefono, email: pagador.email, atletas: [], cobros: 0, meses: 0,
                mesesLista: [], diasMora: 0, venceMasAntiguo: null, total: 0, mensualidades: 0, otros: 0,
                _atletas: new Set<string>(), _meses: new Set<string>(),
            };
            const mes = mesDelCobro(p);
            const diasMora = p.due_date ? Math.max(0, diasEntre(p.due_date, hoy)) : 0;
            f.cobros++;
            f.total += saldo;
            if (esMensualidad(p)) f.mensualidades += saldo; else f.otros += saldo;
            f._atletas.add(atleta);
            f._meses.add(mes);
            f.diasMora = Math.max(f.diasMora, diasMora);
            if (p.due_date && (!f.venceMasAntiguo || p.due_date.slice(0, 10) < f.venceMasAntiguo)) f.venceMasAntiguo = p.due_date.slice(0, 10);
            familias.set(pagador.clave, f);
            const k = claveAtleta(p);
            if (k) atletasMorosos.add(k);

            const m = porMes.get(mes) ?? { cobros: 0, total: 0 };
            m.cobros++; m.total += saldo; porMes.set(mes, m);
            const t = tramoDeMora(Math.max(1, diasMora));
            const tr = porTramo.get(t) ?? { cobros: 0, total: 0 };
            tr.cobros++; tr.total += saldo; porTramo.set(t, tr);
            continue;
        }

        // Pendiente (no vencido) del mes en curso.
        const venceEsteMes = p.due_date ? p.due_date.slice(0, 7) === mesActual : mesDelCobro(p) === mesActual;
        if (venceEsteMes) {
            porVencer.push({ familia: pagador.nombre, atleta, concepto: p.concept || 'Cobro', vence: p.due_date?.slice(0, 10) ?? null, saldo });
            familiasPorVencer.add(pagador.clave);
        }
    }

    const filas: FilaMoroso[] = [...familias.values()].map(({ _atletas, _meses, ...f }) => ({
        ...f,
        atletas: [..._atletas].sort(),
        mesesLista: [..._meses].sort(),
        meses: _meses.size,
    })).sort((a, b) => b.total - a.total || b.diasMora - a.diasMora);

    porVencer.sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || b.saldo - a.saldo);
    enRevision.sort((a, b) => (a.desde ?? '').localeCompare(b.desde ?? ''));

    const limiteBaja = restarDias(hoy, DIAS_BAJA_RECIENTE);
    const todasBajas = [...bajas.values()];
    const recientes = todasBajas.filter((b) => !b._fecha || b._fecha >= limiteBaja)
        .map(({ _fecha, ...b }) => ({ ...b, bajaAprox: _fecha }))
        .sort((a, b) => b.saldo - a.saldo);
    const antiguas = todasBajas.filter((b) => b._fecha && b._fecha < limiteBaja);

    const asis = d.asistencia
        ? atletasSinAsistencia(d.asistencia.atletas, d.asistencia.registros, hoy, dias)
        : { conDatos: false, filas: [] };

    const suma = (xs: { total?: number; saldo?: number }[]) => xs.reduce((s, x) => s + (x.total ?? x.saldo ?? 0), 0);
    return {
        schoolId: d.schoolId,
        escuela: d.escuela,
        hoy,
        enlace,
        morosos: {
            filas,
            familias: filas.length,
            atletas: atletasMorosos.size,
            cobros: filas.reduce((s, f) => s + f.cobros, 0),
            total: suma(filas),
            mensualidades: filas.reduce((s, f) => s + f.mensualidades, 0),
            otros: filas.reduce((s, f) => s + f.otros, 0),
            porMes: [...porMes].map(([mes, v]) => ({ mes, ...v })).sort((a, b) => a.mes.localeCompare(b.mes)),
            porAntiguedad: TRAMOS.filter((t) => porTramo.has(t)).map((t) => ({ tramo: t, ...porTramo.get(t)! })),
        },
        pendientes: {
            porVencer,
            porVencerTotal: suma(porVencer),
            porVencerFamilias: familiasPorVencer.size,
            enRevision,
            enRevisionTotal: suma(enRevision),
        },
        inactivos: {
            conDatos: asis.conDatos,
            dias,
            sinAsistencia: asis.filas,
            bajasConSaldo: recientes,
            bajasConSaldoTotal: suma(recientes),
            bajasAntiguas: { atletas: antiguas.length, saldo: antiguas.reduce((s, b) => s + b.saldo, 0) },
        },
        excluidos: { duplicados: d.duplicadosExcluidos },
    };
}

export function informeVacio(i: InformeCartera): boolean {
    return !i.morosos.familias && !i.pendientes.porVencer.length && !i.pendientes.enRevision.length
        && !i.inactivos.sinAsistencia.length && !i.inactivos.bajasConSaldo.length && !i.inactivos.bajasAntiguas.atletas;
}

/** Línea para el resumen diario de WhatsApp. null si no hay nada que decir. */
export function lineaResumenDiario(i: InformeCartera): string | null {
    const partes: string[] = [];
    if (i.morosos.familias) partes.push(`${i.morosos.familias} familia(s) en mora por ${fmtCop(i.morosos.total)}`);
    if (i.pendientes.enRevision.length) partes.push(`${i.pendientes.enRevision.length} comprobante(s) de pago en revisión`);
    return partes.length ? `cartera: ${partes.join(', ')}` : null;
}

// ── CSV (Excel en español: ';' y BOM) ──

const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Fórmulas no: una celda que empieza por = + - @ se ejecuta en Excel.
    const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
const fila = (xs: unknown[]) => xs.map(celda).join(';');

export function informeACsv(i: InformeCartera): string {
    const l: string[] = [];
    l.push(fila([`Informe de cartera — ${i.escuela}`, `Generado ${i.hoy}`]));
    l.push('');
    l.push(fila(['MOROSOS', `${i.morosos.familias} familias`, `${i.morosos.atletas} atletas`, `Total vencido ${Math.round(i.morosos.total)}`]));
    l.push(fila(['Familia', 'Teléfono', 'Correo', 'Atletas', 'Cobros vencidos', 'Meses adeudados', 'Meses', 'Días de mora', 'Vence desde', 'Mensualidades', 'Otros', 'Total']));
    for (const f of i.morosos.filas) {
        l.push(fila([f.familia, f.telefono, f.email, f.atletas.join(', '), f.cobros, f.meses, f.mesesLista.map(etiquetaMes).join(', '),
            f.diasMora, f.venceMasAntiguo, Math.round(f.mensualidades), Math.round(f.otros), Math.round(f.total)]));
    }
    l.push('');
    l.push(fila(['VENCIDO POR MES', 'Cobros', 'Total']));
    for (const m of i.morosos.porMes) l.push(fila([etiquetaMes(m.mes), m.cobros, Math.round(m.total)]));
    l.push('');
    l.push(fila(['POR VENCER ESTE MES', 'Atleta', 'Concepto', 'Vence', 'Saldo']));
    for (const c of i.pendientes.porVencer) l.push(fila([c.familia, c.atleta, c.concepto, c.vence, Math.round(c.saldo)]));
    l.push('');
    l.push(fila(['COMPROBANTES EN REVISIÓN', 'Atleta', 'Concepto', 'Vence', 'Valor', 'En revisión desde']));
    for (const c of i.pendientes.enRevision) l.push(fila([c.familia, c.atleta, c.concepto, c.vence, Math.round(c.saldo), c.desde?.slice(0, 10)]));
    l.push('');
    l.push(fila([`SIN ASISTENCIA (${i.inactivos.dias} días)`, 'Equipo', 'Última asistencia', 'Días']));
    if (!i.inactivos.conDatos) l.push(fila(['Sin registros de asistencia en la ventana']));
    for (const a of i.inactivos.sinAsistencia) l.push(fila([a.atleta, a.equipo, a.ultimaAsistencia ?? 'sin registro', a.dias ?? '']));
    l.push('');
    l.push(fila(['DADOS DE BAJA CON SALDO', 'Familia', 'Baja (aprox.)', 'Cobros', 'Saldo']));
    for (const b of i.inactivos.bajasConSaldo) l.push(fila([b.atleta, b.familia, b.bajaAprox, b.cobros, Math.round(b.saldo)]));
    if (i.inactivos.bajasAntiguas.atletas) {
        l.push(fila([`Bajas de hace más de ${DIAS_BAJA_RECIENTE} días`, '', '', i.inactivos.bajasAntiguas.atletas, Math.round(i.inactivos.bajasAntiguas.saldo)]));
    }
    return `﻿${l.join('\r\n')}\r\n`;
}

// ── Correo ──

const th = (t: string, der = false) => `<th align="${der ? 'right' : 'left'}" style="padding:6px 8px;background:#f5f5f5;font-size:13px;">${t}</th>`;
const td = (t: string, der = false) => `<td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;${der ? 'text-align:right;white-space:nowrap;' : ''}">${t}</td>`;
const tabla = (cab: string, filas: string[]) =>
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;border-collapse:collapse;"><tr>${cab}</tr>${filas.join('')}</table>`;
const h3 = (t: string) => `<h3 style="font-size:16px;color:#248223;margin:22px 0 4px;">${t}</h3>`;
const parrafo = (t: string) => `<p style="color:#4a4a4a;line-height:1.5;margin:4px 0 8px;font-size:14px;">${t}</p>`;
const mas = (total: number) => (total > TOP ? parrafo(`… y ${total - TOP} más. La lista completa está en «Descargar informe».`) : '');
const e = escaparHtml;

export function asuntoInforme(i: InformeCartera): string {
    const partes = [
        i.morosos.familias ? `${i.morosos.familias} familia(s) en mora (${fmtCop(i.morosos.total)})` : 'sin mora',
        i.pendientes.enRevision.length ? `${i.pendientes.enRevision.length} comprobante(s) en revisión` : '',
    ].filter(Boolean);
    return `Informe de cartera de ${i.escuela}: ${partes.join(', ')}`;
}

export function htmlInforme(i: InformeCartera): string {
    const m = i.morosos;
    const out: string[] = [];
    out.push(`<h2 style="color:#248223;margin-top:0;">Informe de cartera semanal</h2>`);
    out.push(parrafo(`Buenos días. Este es el estado de la cartera de <strong>${e(i.escuela)}</strong> al ${e(i.hoy)}. Las inscripciones con mora siguen activas: este informe es para que decidas a quién llamar.`));

    out.push(h3('1. Morosos'));
    if (!m.familias) out.push(parrafo('No hay cobros vencidos.'));
    else {
        out.push(parrafo(`<strong>${m.familias}</strong> familia(s) · ${m.atletas} atleta(s) · ${m.cobros} cobro(s) vencido(s) · <strong>${fmtCop(m.total)}</strong> (mensualidades ${fmtCop(m.mensualidades)}, otros ${fmtCop(m.otros)}).`));
        out.push(tabla(th('Mes') + th('Cobros', true) + th('Vencido', true),
            m.porMes.map((x) => `<tr>${td(e(etiquetaMes(x.mes)))}${td(String(x.cobros), true)}${td(fmtCop(x.total), true)}</tr>`)));
        out.push(tabla(th('Familia') + th('Meses', true) + th('Días de mora', true) + th('Total', true),
            m.filas.slice(0, TOP).map((f) => `<tr>${td(`${e(f.familia)}<br><span style="color:#666;font-size:12px;">${e(f.atletas.join(', '))}</span>`)}${td(String(f.meses), true)}${td(String(f.diasMora), true)}${td(fmtCop(f.total), true)}</tr>`)));
        out.push(mas(m.familias));
    }

    out.push(h3('2. Pendientes'));
    const pe = i.pendientes;
    out.push(parrafo(pe.porVencer.length
        ? `Por vencer este mes sin pagar: <strong>${pe.porVencer.length}</strong> cobro(s) de ${pe.porVencerFamilias} familia(s), ${fmtCop(pe.porVencerTotal)}.`
        : 'No hay cobros de este mes por vencer sin pagar.'));
    if (pe.enRevision.length) {
        out.push(parrafo(`Comprobantes en revisión: <strong>${pe.enRevision.length}</strong> (${fmtCop(pe.enRevisionTotal)}). Apruébalos o recházalos para que la cartera quede al día.`));
        out.push(tabla(th('Familia / atleta') + th('Concepto') + th('Valor', true),
            pe.enRevision.slice(0, TOP).map((c) => `<tr>${td(`${e(c.familia)}<br><span style="color:#666;font-size:12px;">${e(c.atleta)}</span>`)}${td(e(c.concepto))}${td(fmtCop(c.saldo), true)}</tr>`)));
        out.push(mas(pe.enRevision.length));
    } else out.push(parrafo('No hay comprobantes en revisión.'));

    out.push(h3('3. Inactivos'));
    const ina = i.inactivos;
    if (!ina.conDatos) out.push(parrafo(`No hay registros de asistencia de los últimos ${ina.dias} días, así que no se puede saber quién dejó de venir.`));
    else if (!ina.sinAsistencia.length) out.push(parrafo(`Todos los atletas de los equipos que toman asistencia vinieron al menos una vez en los últimos ${ina.dias} días.`));
    else {
        out.push(parrafo(`<strong>${ina.sinAsistencia.length}</strong> atleta(s) activo(s) sin asistencia en los últimos ${ina.dias} días (solo equipos que toman asistencia en SportMaps).`));
        out.push(tabla(th('Atleta') + th('Equipo') + th('Última vez', true),
            ina.sinAsistencia.slice(0, TOP).map((a) => `<tr>${td(e(a.atleta))}${td(e(a.equipo ?? '—'))}${td(a.ultimaAsistencia ? `${e(a.ultimaAsistencia)} (${a.dias} d)` : 'sin registro', true)}</tr>`)));
        out.push(mas(ina.sinAsistencia.length));
    }
    if (ina.bajasConSaldo.length) {
        out.push(parrafo(`Dados de baja (últimos ${DIAS_BAJA_RECIENTE} días) que todavía tienen saldo: <strong>${ina.bajasConSaldo.length}</strong> (${fmtCop(ina.bajasConSaldoTotal)}). Al dar de baja se anulan los cobros pendientes; si siguen ahí, anúlalos o cóbralos a mano.`));
        out.push(tabla(th('Atleta') + th('Familia') + th('Saldo', true),
            ina.bajasConSaldo.slice(0, TOP).map((b) => `<tr>${td(e(b.atleta))}${td(e(b.familia))}${td(fmtCop(b.saldo), true)}</tr>`)));
        out.push(mas(ina.bajasConSaldo.length));
    }
    if (ina.bajasAntiguas.atletas) {
        out.push(parrafo(`Además, ${ina.bajasAntiguas.atletas} atleta(s) dados de baja hace más de ${DIAS_BAJA_RECIENTE} días conservan ${fmtCop(ina.bajasAntiguas.saldo)} en cobros sin anular.`));
    }

    out.push(`<p style="margin-top:20px;"><a href="${e(i.enlace)}" style="display:inline-block;padding:12px 24px;background:#FB9F1E;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ver la cartera en SportMaps</a></p>`);
    out.push(`<p style="color:#888;font-size:12px;margin-top:16px;">Llega los lunes. En Finanzas → Cartera puedes descargar el informe completo (Excel) o desactivar este correo.</p>`);
    return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border-top:3px solid #248223;">${out.join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

async function todas<T>(q: (desde: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    const out: T[] = [];
    for (let desde = 0; ; desde += 1000) {
        const { data, error } = await q(desde);
        if (error) throw new Error(error.message);
        out.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return out;
    }
}

/** Trozos de 100 ids: ~4 KB de query string, lejos del límite de headers (ver reports.ts, IN_CHUNK). */
const trozos = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / 100) }, (_, i) => a.slice(i * 100, i * 100 + 100));

async function leerPorIds<T>(tabla: string, cols: string, ids: string[]): Promise<T[]> {
    const res = await Promise.all(trozos(ids).map((t) => supabase.from(tabla).select(cols).in('id', t)));
    for (const r of res) if (r.error) throw new Error(`${tabla}: ${r.error.message}`);
    return res.flatMap((r) => (r.data ?? []) as unknown as T[]);
}

/** Atletas activos y su asistencia. Nunca lanza: sin datos, la sección se omite. */
async function leerAsistencia(schoolId: string, hoy: string): Promise<DatosCartera['asistencia']> {
    try {
        const vista = await todas<any>((desde) => supabase.from('school_athletes')
            .select('id, full_name, athlete_type, team_id, enrolled_team_id, team_name, is_active')
            .eq('school_id', schoolId).eq('is_active', true)
            .order('id').range(desde, desde + 999));
        const porClave = new Map<string, AtletaActivo>();
        for (const v of vista) {
            const clave = v.athlete_type === 'child' ? `child:${v.id}` : v.athlete_type === 'unregistered' ? `unreg:${v.id}` : `user:${v.id}`;
            const a: AtletaActivo = porClave.get(clave) ?? { clave, nombre: (v.full_name || 'Atleta sin nombre').trim(), equipos: [], equipo: v.team_name ?? null };
            for (const t of [v.team_id, v.enrolled_team_id]) if (t && !a.equipos.includes(t)) a.equipos.push(t);
            if (!a.equipo && v.team_name) a.equipo = v.team_name;
            porClave.set(clave, a);
        }
        const desde = restarDias(hoy, DIAS_HISTORIA_ASISTENCIA);
        const filas = await todas<any>((d) => supabase.from('attendance_records')
            .select('child_id, unregistered_athlete_id, user_id, team_id, attendance_date, status')
            .eq('school_id', schoolId).gte('attendance_date', desde)
            .order('attendance_date').range(d, d + 999));
        const registros: RegistroAsistencia[] = [];
        for (const r of filas) {
            const clave = claveAtleta(r);
            if (clave) registros.push({ clave, team_id: r.team_id ?? null, fecha: String(r.attendance_date).slice(0, 10), status: r.status });
        }
        return { atletas: [...porClave.values()], registros };
    } catch (err: any) {
        console.warn('[informe-cartera] sin sección de asistencia', { schoolId, error: err?.message || String(err) });
        return null;
    }
}

/** Lee todo lo que necesita el informe de una escuela. */
export async function leerDatosCartera(schoolId: string, hoy: string): Promise<DatosCartera> {
    const [{ data: escuela }, pagosCrudos] = await Promise.all([
        supabase.from('schools').select('name').eq('id', schoolId).maybeSingle(),
        todas<PagoCartera>((desde) => supabase.from('payments')
            .select('id, parent_id, user_id, child_id, unregistered_athlete_id, concept, amount, amount_paid, status, due_date, payment_type, payment_category, period_year, period_month, updated_at')
            .eq('school_id', schoolId).in('status', ['pending', 'overdue', 'partial', 'awaiting_approval'])
            .order('id').range(desde, desde + 999)),
    ]);
    const duplicados = new Set(await findDuplicatePaymentIds(schoolId, pagosCrudos as any));
    const pagos = pagosCrudos.filter((p) => !duplicados.has(p.id));

    const ids = (f: (p: PagoCartera) => string | null | undefined) => [...new Set(pagos.map(f).filter(Boolean))] as string[];
    const [hijos, noReg] = await Promise.all([
        leerPorIds<HijoCartera>('children', `id, is_active, parent_id, updated_at, ${COLUMNAS_CONTACTO_HIJO}`, ids((p) => p.child_id)),
        leerPorIds<FichaCartera>('unregistered_athletes', `id, is_active, updated_at, ${COLUMNAS_CONTACTO_FICHA}`, ids((p) => p.unregistered_athlete_id)),
    ]);
    const idsPerfiles = [...new Set([...ids((p) => p.parent_id), ...ids((p) => p.user_id), ...hijos.map((h) => h.parent_id).filter(Boolean) as string[]])];
    const adultos = ids((p) => (!p.child_id && !p.unregistered_athlete_id ? p.user_id : null));
    const [perfiles, membresias, asistencia] = await Promise.all([
        leerPorIds<PerfilCartera>('profiles', 'id, full_name, email, phone', idsPerfiles),
        Promise.all(trozos(adultos).map(async (t) => {
            const { data, error } = await supabase.from('school_members')
                .select('profile_id, status, updated_at').eq('school_id', schoolId).eq('role', 'athlete').in('profile_id', t);
            if (error) throw new Error(error.message);
            return (data ?? []) as { profile_id: string; status: string; updated_at?: string | null }[];
        })).then((r) => r.flat()),
        leerAsistencia(schoolId, hoy),
    ]);
    const membresiasAtleta = new Map<string, { status: string; updated_at?: string | null }[]>();
    for (const m of membresias) membresiasAtleta.set(m.profile_id, [...(membresiasAtleta.get(m.profile_id) ?? []), { status: m.status, updated_at: m.updated_at }]);

    return {
        schoolId,
        escuela: ((escuela as any)?.name || 'tu escuela').replace(/&amp;/g, '&'),
        pagos,
        duplicadosExcluidos: duplicados.size,
        hijos: new Map(hijos.map((x) => [x.id, x])),
        noRegistrados: new Map(noReg.map((x) => [x.id, x])),
        perfiles: new Map(perfiles.map((x) => [x.id, x])),
        membresiasAtleta,
        asistencia,
    };
}

/** Pantalla donde la escuela ve la cartera (Finanzas → pestaña Cartera, la que abre por defecto). */
export const enlaceCartera = () => `${appPublica()}/finances`;

export async function armarInformeCartera(schoolId: string, ahora: Date = new Date()): Promise<InformeCartera> {
    const hoy = fechaColombia(ahora);
    const datos = await leerDatosCartera(schoolId, hoy);
    return construirInforme(datos, hoy, enlaceCartera());
}

// ─────────────────────────────────────────────────────────────────────────────
// Ajuste por escuela
// ─────────────────────────────────────────────────────────────────────────────

export interface AjusteInforme { activo: boolean; explicito: boolean | null; cancelacionAutomatica: boolean; columnaDisponible: boolean }

export async function leerAjusteInforme(schoolId: string): Promise<AjusteInforme> {
    const r = await supabase.from('school_settings')
        .select('auto_cancel_overdue_enabled, cartera_report_enabled').eq('school_id', schoolId).maybeSingle();
    if (!r.error) {
        const fila = (r.data ?? null) as any;
        return {
            activo: informeActivo(fila),
            explicito: fila?.cartera_report_enabled ?? null,
            cancelacionAutomatica: fila?.auto_cancel_overdue_enabled !== false,
            columnaDisponible: true,
        };
    }
    // Columna sin aplicar → modo automático.
    const { data } = await supabase.from('school_settings')
        .select('auto_cancel_overdue_enabled').eq('school_id', schoolId).maybeSingle();
    const auto = (data as any)?.auto_cancel_overdue_enabled;
    return { activo: auto === false, explicito: null, cancelacionAutomatica: auto !== false, columnaDisponible: false };
}

export async function guardarAjusteInforme(schoolId: string, valor: boolean | null): Promise<void> {
    const { data, error } = await supabase.from('school_settings')
        .update({ cartera_report_enabled: valor }).eq('school_id', schoolId).select('school_id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('La escuela no tiene configuración (school_settings).');
}

/** Escuelas con el informe semanal activo (explícito o automático). */
export async function escuelasConInforme(): Promise<string[]> {
    const r = await supabase.from('school_settings')
        .select('school_id, auto_cancel_overdue_enabled, cartera_report_enabled')
        .or('cartera_report_enabled.is.true,auto_cancel_overdue_enabled.is.false');
    if (!r.error) return ((r.data ?? []) as any[]).filter(informeActivo).map((x) => x.school_id);
    const { data, error } = await supabase.from('school_settings')
        .select('school_id').eq('auto_cancel_overdue_enabled', false);
    if (error) {
        console.error('[informe-cartera] no se pudieron leer las escuelas', error.message);
        return [];
    }
    return ((data ?? []) as any[]).map((x) => x.school_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Envío semanal
// ─────────────────────────────────────────────────────────────────────────────

/** Lunes (YYYY-MM-DD, COT) de la semana de `ahora`. Es el «periodo» de la idempotencia. */
export function lunesDeLaSemana(ahora: Date): string {
    const hoy = fechaColombia(ahora);
    const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
    return restarDias(hoy, (dia + 6) % 7);
}

export const claveInforme = (schoolId: string, lunes: string) => `${TIPO_INFORME}:${schoolId}:${lunes}`;

export type ResultadoEscuela = 'simulado' | 'enviado' | 'duplicado' | 'fallo' | 'vacio' | 'sin_destinatarios' | 'ya_enviado' | `error: ${string}`;

/**
 * Envía (o con `aplicar: false` solo arma) el informe de una escuela.
 * Nunca lanza.
 */
export async function enviarInformeCartera(schoolId: string, o: { ahora?: Date; aplicar: boolean }): Promise<{ resultado: ResultadoEscuela; informe: InformeCartera | null }> {
    const ahora = o.ahora ?? new Date();
    const lunes = lunesDeLaSemana(ahora);
    try {
        if (o.aplicar) {
            const { data } = await supabase.from('email_sends').select('id').eq('id', uuidDeClave(claveInforme(schoolId, lunes))).maybeSingle();
            if (data) return { resultado: 'ya_enviado', informe: null };
        }
        const informe = await armarInformeCartera(schoolId, ahora);
        if (informeVacio(informe)) return { resultado: 'vacio', informe };
        if (!o.aplicar) return { resultado: 'simulado', informe };

        const { correos } = await destinatariosDeEscuela(schoolId);
        if (!correos.length) return { resultado: 'sin_destinatarios', informe };
        const r = await enviarConReserva({
            clave: claveInforme(schoolId, lunes),
            tipo: TIPO_INFORME,
            plantilla: null, // HTML propio (tablas); no depende de desplegar send-email
            schoolId,
            refId: null,
            destinos: correos,
            data: {},
            respaldo: {
                subject: asuntoInforme(informe),
                titulo: 'Informe de cartera semanal',
                lineas: [],
                html: htmlInforme(informe),
            },
        });
        return { resultado: r, informe };
    } catch (err: any) {
        console.error('[informe-cartera] falló la escuela', { schoolId, error: err?.message || String(err) });
        return { resultado: `error: ${err?.message || String(err)}`, informe: null };
    }
}

/** ¿Toca el envío semanal? Lunes desde las 7:00 COT. */
export function esHoraDelInforme(ahora: Date): boolean {
    const c = new Date(ahora.getTime() - 5 * 3600_000);
    return c.getUTCDay() === 1 && c.getUTCHours() >= 7;
}

export async function runInformeCarteraSemanal(ahora: Date = new Date()): Promise<Record<string, ResultadoEscuela>> {
    const out: Record<string, ResultadoEscuela> = {};
    if (process.env.DISABLE_INFORME_CARTERA === 'true') return out;
    if (!esHoraDelInforme(ahora)) return out;
    for (const schoolId of await escuelasConInforme()) {
        const { resultado } = await enviarInformeCartera(schoolId, { ahora, aplicar: true });
        out[schoolId] = resultado;
    }
    return out;
}

/**
 * Línea de cartera para el resumen diario de WhatsApp de una escuela. Solo si
 * el informe está activo para ella y el kill-switch no está puesto. Nunca
 * lanza: ante cualquier error, sin línea.
 */
export async function lineaCarteraParaResumen(schoolId: string, ahora: Date = new Date()): Promise<string | null> {
    if (process.env.DISABLE_INFORME_CARTERA === 'true') return null;
    try {
        if (!(await leerAjusteInforme(schoolId)).activo) return null;
        return lineaResumenDiario(await armarInformeCartera(schoolId, ahora));
    } catch (err: any) {
        console.warn('[informe-cartera] sin línea para el resumen diario', { schoolId, error: err?.message || String(err) });
        return null;
    }
}
