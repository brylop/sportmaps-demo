/**
 * plan-por-asistencia — plan por CLASES TOMADAS en el mes (spec
 * docs/specs/whatsapp-conversacion-v2-dynasty.md §3.7 y §3.8).
 *
 * Decisiones del usuario 2026-10-24 (a confirmar con Milena):
 *  · Sube cuando las clases del mes > max_sessions del plan actual + umbral →
 *    el plan MÁS BARATO con max_sessions >= clases (y más caro que el actual).
 *  · Baja solo tras `plan_baja_meses` meses SEGUIDOS en que las clases cupieron en un
 *    plan inferior (menos clases y menos precio).
 *  · Planes con el mismo precio o las mismas clases no se cambian entre sí.
 *  · Plan actual o candidato sin max_sessions (SELECCIÓN): no se calcula.
 *  · Cuota manual (becas, fee_is_manual) y atletas inactivos: se saltan.
 *  · Mes SIN asistencia registrada para el equipo: no se propone nada (la ausencia de
 *    datos no es «0 clases»; desde el 6-oct no hay asistencia en Dynasty).
 *
 * Modos por escuela: apagado (nada) / sombra (registra lo que cambiaría, sin tocar el
 * plan) / auto (RPC `aplicar_cambio_plan`).
 *
 * Convención: `period_year/period_month` de la fila = el mes cuyas clases se contaron
 * (p. ej. «septiembre» cuando el job corre el 1-oct y el cobro afectado es el de octubre).
 *
 * Lectura en lote: nada de una consulta por fila (CLAUDE.md, Disk IO). Si falta una
 * tabla/columna de las migraciones nuevas, el servicio devuelve `disponible:false`.
 */

import { supabase } from '../config/supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ModoPlanAsistencia = 'apagado' | 'sombra' | 'auto';
export type Direccion = 'up' | 'down' | 'same_price';

export interface PlanTier {
    id: string;
    name: string;
    price: number;
    max_sessions: number | null;
    is_active: boolean;
}

export interface AjustesPlanAsistencia {
    modo: ModoPlanAsistencia;
    sube_umbral: number;
    baja_meses: number;
}

export const AJUSTES_POR_DEFECTO: AjustesPlanAsistencia = { modo: 'apagado', sube_umbral: 0, baja_meses: 2 };

export type MotivoNada =
    | 'plan_sin_tope' | 'sin_asistencia_del_mes' | 'dentro_del_plan' | 'sin_plan_superior'
    | 'sin_plan_inferior' | 'baja_sin_meses_suficientes' | 'baja_aun_no_sostenida' | 'cuota_manual' | 'plan_no_encontrado'
    | 'baja_sin_clases_en_la_ventana';

export type Propuesta =
    | { tipo: 'cambiar'; direction: Direccion; plan: PlanTier; razon_corta: string }
    | { tipo: 'nada'; motivo: MotivoNada };

export interface EntradaPropuesta {
    planActual: PlanTier | null;
    planes: PlanTier[];
    /** Clases tomadas por mes, el más reciente primero. `null` = el mes no tiene asistencia registrada. */
    clasesPorMes: Array<number | null>;
    umbral?: number;
    bajaMeses?: number;
    feeIsManual?: boolean;
}

// ─── Lógica pura ─────────────────────────────────────────────────────────────

const conTope = (p: PlanTier): p is PlanTier & { max_sessions: number } => p.max_sessions != null;

export function propuestaDePlan(e: EntradaPropuesta): Propuesta {
    const umbral = Math.max(0, e.umbral ?? 0);
    const bajaMeses = Math.max(1, Math.floor(e.bajaMeses ?? 2));
    if (e.feeIsManual) return { tipo: 'nada', motivo: 'cuota_manual' };
    const actual = e.planActual;
    if (!actual) return { tipo: 'nada', motivo: 'plan_no_encontrado' };
    if (!conTope(actual)) return { tipo: 'nada', motivo: 'plan_sin_tope' };

    const clases = e.clasesPorMes[0];
    if (clases == null) return { tipo: 'nada', motivo: 'sin_asistencia_del_mes' };

    const candidatos = e.planes.filter((p) => p.is_active && p.id !== actual.id && conTope(p));

    // SUBE
    if (clases > actual.max_sessions + umbral) {
        const sube = candidatos
            .filter((p) => p.max_sessions! >= clases && p.max_sessions! > actual.max_sessions && p.price > actual.price)
            .sort((a, b) => a.price - b.price || a.max_sessions! - b.max_sessions!);
        if (sube.length === 0) return { tipo: 'nada', motivo: 'sin_plan_superior' };
        return { tipo: 'cambiar', direction: 'up', plan: sube[0], razon_corta: 'subio' };
    }

    // BAJA: el plan inferior (menos clases y más barato) con más tope.
    const inferiores = candidatos.filter((p) => p.max_sessions! < actual.max_sessions && p.price < actual.price);
    if (inferiores.length === 0) return { tipo: 'nada', motivo: 'sin_plan_inferior' };
    const topeInferior = Math.max(...inferiores.map((p) => p.max_sessions!));
    if (clases > topeInferior) return { tipo: 'nada', motivo: 'dentro_del_plan' };

    const ventana = e.clasesPorMes.slice(0, bajaMeses);
    if (ventana.length < bajaMeses || ventana.some((c) => c == null)) {
        return { tipo: 'nada', motivo: 'baja_sin_meses_suficientes' };
    }
    // 0 clases en un mes de la ventana no es «toma pocas»: es ausente por completo (retirado,
    // pausa o planilla incompleta). Bajarlo de plan por eso sería inferir de la falta de datos.
    if (ventana.some((c) => c === 0)) return { tipo: 'nada', motivo: 'baja_sin_clases_en_la_ventana' };
    const maxVentana = Math.max(...(ventana as number[]));
    if (maxVentana > topeInferior) return { tipo: 'nada', motivo: 'baja_aun_no_sostenida' };
    const baja = inferiores
        .filter((p) => p.max_sessions! >= maxVentana)
        .sort((a, b) => a.price - b.price || a.max_sessions! - b.max_sessions!);
    if (baja.length === 0) return { tipo: 'nada', motivo: 'sin_plan_inferior' };
    return { tipo: 'cambiar', direction: 'down', plan: baja[0], razon_corta: 'bajo' };
}

export const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const nombreMes = (month: number) => MESES_ES[(month - 1 + 12) % 12] ?? String(month);

export const nombrePlan = (p: Pick<PlanTier, 'name'>) =>
    p.name.replace(/\s+/g, ' ').trim()
        .replace(/^plan\s+/i, '').replace(/\s*-?\s*\d+\s*clases.*$/i, '').trim() || p.name.trim();

export const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO').replace(/,/g, '.')}`;

/** «tomó 12 clases en septiembre; su plan PRO incluye 8» */
export function razonLegible(
    clases: number, month: number, planActual: PlanTier, planNuevo: PlanTier, direction: Direccion, bajaMeses = 2,
): string {
    const mes = nombreMes(month);
    const c = `${clases} ${clases === 1 ? 'clase' : 'clases'}`;
    if (direction === 'down') {
        return `tomó ${c} en ${mes}, dentro del plan ${nombrePlan(planNuevo)} (${planNuevo.max_sessions}) `
            + `por ${bajaMeses} meses seguidos; su plan ${nombrePlan(planActual)} incluye ${planActual.max_sessions}`;
    }
    return `tomó ${c} en ${mes}; su plan ${nombrePlan(planActual)} incluye ${planActual.max_sessions}`;
}

/** Mes anterior a `now` en hora de Bogotá (UTC-5, sin DST). */
export function mesAnteriorBogota(now: Date = new Date()): { year: number; month: number } {
    const b = new Date(now.getTime() - 5 * 3_600_000);
    let y = b.getUTCFullYear();
    let m = b.getUTCMonth(); // 0-based = mes anterior en 1-based
    if (m === 0) { y -= 1; m = 12; }
    return { year: y, month: m };
}

export function rangoMes(year: number, month: number): { desde: string; hasta: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const sig = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    return { desde: `${year}-${pad(month)}-01`, hasta: `${sig.y}-${pad(sig.m)}-01` }; // hasta exclusivo
}

/** Mes `n` meses antes de (year, month). */
export function restarMeses(year: number, month: number, n: number): { year: number; month: number } {
    const idx = year * 12 + (month - 1) - n;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export interface RegistroAsistencia {
    child_id: string | null;
    user_id: string | null;
    unregistered_athlete_id: string | null;
    team_id: string | null;
    attendance_date: string;
    status: string;
}

export type ColAtleta = 'child_id' | 'user_id' | 'unregistered_athlete_id';
export const COLS_ATLETA: ColAtleta[] = ['child_id', 'user_id', 'unregistered_athlete_id'];
export const claveAtleta = (col: ColAtleta, id: string) => `${col}:${id}`;

export function atletaDe(f: Partial<Record<ColAtleta, string | null>>): { col: ColAtleta; id: string; clave: string } | null {
    for (const col of COLS_ATLETA) if (f[col]) return { col, id: f[col] as string, clave: claveAtleta(col, f[col] as string) };
    return null;
}

const ASISTIO = new Set(['present', 'late']);

export interface ResumenAsistenciaMes {
    /** Días distintos con present/late por atleta (máx. 1 por día). */
    clasesPorAtleta: Map<string, number>;
    /** Atletas con CUALQUIER registro en el mes. */
    atletasConRegistro: Set<string>;
    /** Equipos con algún registro (cualquier estado) en el mes. */
    equiposConRegistro: Set<string>;
}

export function resumirAsistenciaMes(registros: RegistroAsistencia[]): ResumenAsistenciaMes {
    const dias = new Map<string, Set<string>>();
    const atletasConRegistro = new Set<string>();
    const equiposConRegistro = new Set<string>();
    for (const r of registros) {
        const a = atletaDe(r);
        if (r.team_id) equiposConRegistro.add(r.team_id);
        if (!a) continue;
        atletasConRegistro.add(a.clave);
        if (!ASISTIO.has(r.status)) continue;
        const s = dias.get(a.clave) ?? new Set<string>();
        s.add(String(r.attendance_date).slice(0, 10));
        dias.set(a.clave, s);
    }
    const clasesPorAtleta = new Map<string, number>();
    for (const [k, s] of dias) clasesPorAtleta.set(k, s.size);
    return { clasesPorAtleta, atletasConRegistro, equiposConRegistro };
}

/**
 * Clases del mes de un atleta, o `null` si el mes no tiene asistencia registrada para
 * él: hay datos si su equipo tiene registros ese mes, o (sin equipo) si él mismo tiene.
 */
export function clasesDelMes(resumen: ResumenAsistenciaMes, clave: string, teamId: string | null): number | null {
    const hayDatos = teamId ? resumen.equiposConRegistro.has(teamId) : resumen.atletasConRegistro.has(clave);
    if (!hayDatos) return null;
    return resumen.clasesPorAtleta.get(clave) ?? 0;
}

// ─── Acceso a la base ────────────────────────────────────────────────────────

const PAGINA = 1000;
const TROZO = 150;

function trozos<T>(xs: T[], n = TROZO): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
    return out;
}

/** Lee todas las páginas (1000 filas) de una consulta; lanza si alguna falla. */
async function leerTodo<T>(build: (desde: number, hasta: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
    const out: T[] = [];
    for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await build(desde, desde + PAGINA - 1);
        if (error) throw error;
        const filas = (data ?? []) as T[];
        out.push(...filas);
        if (filas.length < PAGINA) break;
    }
    return out;
}

/** ¿El error es «falta la tabla/columna» (migración sin aplicar)? */
export function esFaltaDeEsquema(err: any): boolean {
    const code = String(err?.code ?? '');
    const msg = String(err?.message ?? '').toLowerCase();
    return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205' || code === 'PGRST200'
        || msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

export interface ResultadoAjustes {
    disponible: boolean;
    motivo?: string;
    porEscuela: Map<string, AjustesPlanAsistencia>;
}

/**
 * ÚNICO punto que sabe dónde viven los ajustes por escuela (hoy `school_settings`).
 * Si la migración fija otro nombre, se cambia solo aquí. Devuelve solo las escuelas con
 * modo distinto de 'apagado'.
 */
export async function leerAjustesPlanAsistencia(schoolIds?: string[]): Promise<ResultadoAjustes> {
    let q = supabase.from('school_settings')
        .select('school_id, plan_por_asistencia_modo, plan_sube_umbral, plan_baja_meses')
        .in('plan_por_asistencia_modo', ['sombra', 'auto']);
    if (schoolIds && schoolIds.length) q = q.in('school_id', schoolIds);
    const { data, error } = await q;
    if (error) {
        return { disponible: false, motivo: esFaltaDeEsquema(error) ? 'ajustes_sin_migrar' : `ajustes_error: ${error.message}`, porEscuela: new Map() };
    }
    const porEscuela = new Map<string, AjustesPlanAsistencia>();
    for (const r of (data ?? []) as any[]) {
        porEscuela.set(r.school_id, {
            modo: r.plan_por_asistencia_modo as ModoPlanAsistencia,
            sube_umbral: Number.isFinite(Number(r.plan_sube_umbral)) ? Number(r.plan_sube_umbral) : AJUSTES_POR_DEFECTO.sube_umbral,
            baja_meses: Number.isFinite(Number(r.plan_baja_meses)) && Number(r.plan_baja_meses) >= 1
                ? Number(r.plan_baja_meses) : AJUSTES_POR_DEFECTO.baja_meses,
        });
    }
    return { disponible: true, porEscuela };
}

export interface PropuestaFila {
    school_id: string;
    enrollment_id: string;
    child_id: string | null;
    user_id: string | null;
    unregistered_athlete_id: string | null;
    atleta: string;
    from_plan_id: string;
    to_plan_id: string;
    from_plan: string;
    to_plan: string;
    from_amount: number;
    to_amount: number;
    clases_mes: number;
    amount_paid: number;
    period_year: number;
    period_month: number;
    debt_at_change: number;
    direction: Direccion;
    razon: string;
    modo_escuela: ModoPlanAsistencia;
}

export interface ResultadoCalculo {
    disponible: boolean;
    motivo_no_disponible?: string;
    dry_run: boolean;
    year: number;
    month: number;
    escuelas: string[];
    inscripciones_evaluadas: number;
    descartes: Partial<Record<MotivoNada | 'inactivo', number>>;
    propuestas: PropuestaFila[];
    resumen: { up: number; down: number; same_price: number; down_con_deuda: number };
    escritas: number;
    ya_registradas: number;
    errores: number;
}

export interface OpcionesCalculo {
    year?: number;
    month?: number;
    schoolIds?: string[];
    /** No escribe nada (ni sombra ni auto). Con `schoolIds` explícitos y sin ajustes en la base, usa `modoSimulado`. */
    dryRun?: boolean;
    /** Solo para dry-run: modo con el que se simula cuando la escuela no tiene ajustes vivos. */
    modoSimulado?: Exclude<ModoPlanAsistencia, 'apagado'>;
    /** Escribe a lo sumo filas de sombra, aunque la escuela esté en 'auto' (ruta correr-sombra). */
    soloSombra?: boolean;
    now?: Date;
}

const vacio = (o: { dry: boolean; y: number; m: number; escuelas?: string[]; motivo?: string }): ResultadoCalculo => ({
    disponible: !o.motivo, motivo_no_disponible: o.motivo, dry_run: o.dry, year: o.y, month: o.m,
    escuelas: o.escuelas ?? [], inscripciones_evaluadas: 0, descartes: {}, propuestas: [],
    resumen: { up: 0, down: 0, same_price: 0, down_con_deuda: 0 }, escritas: 0, ya_registradas: 0, errores: 0,
});

/**
 * Calcula (y, si no es dry-run, registra) los cambios de plan por asistencia del mes
 * `year/month` (por defecto, el mes anterior). Nunca lanza por esquema faltante.
 */
export async function calcularPlanPorAsistencia(opts: OpcionesCalculo = {}): Promise<ResultadoCalculo> {
    const dry = !!opts.dryRun;
    const prev = mesAnteriorBogota(opts.now);
    const year = opts.year ?? prev.year;
    const month = opts.month ?? prev.month;

    try {
        // 1) Escuelas y ajustes.
        const aj = await leerAjustesPlanAsistencia(opts.schoolIds);
        const ajustes = new Map(aj.porEscuela);
        if (!aj.disponible) {
            if (!(dry && opts.schoolIds?.length)) return vacio({ dry, y: year, m: month, motivo: aj.motivo ?? 'ajustes_no_disponibles' });
        }
        if (dry && opts.schoolIds?.length) {
            // Simulación: una escuela sin ajustes vivos se simula con los valores por defecto.
            for (const s of opts.schoolIds) {
                if (!ajustes.has(s)) ajustes.set(s, { ...AJUSTES_POR_DEFECTO, modo: opts.modoSimulado ?? 'sombra' });
            }
        }
        if (opts.soloSombra) for (const [k, v] of ajustes) ajustes.set(k, { ...v, modo: 'sombra' });
        const escuelas = [...ajustes.keys()];
        if (escuelas.length === 0) return vacio({ dry, y: year, m: month });

        // 2) Planes, inscripciones activas con plan y cuota no manual.
        const [planesRes, inscripciones] = await Promise.all([
            supabase.from('offering_plans').select('id, school_id, name, price, max_sessions, is_active').in('school_id', escuelas),
            leerTodo<any>((d, h) => supabase.from('enrollments')
                .select('id, school_id, child_id, user_id, unregistered_athlete_id, offering_plan_id, monthly_fee, fee_is_manual, team_id')
                .in('school_id', escuelas).eq('status', 'active').not('offering_plan_id', 'is', null)
                .order('id').range(d, h)),
        ]);
        if (planesRes.error) throw planesRes.error;
        const planesPorEscuela = new Map<string, PlanTier[]>();
        for (const p of (planesRes.data ?? []) as any[]) {
            const l = planesPorEscuela.get(p.school_id) ?? [];
            l.push({ id: p.id, name: p.name ?? '', price: Number(p.price), max_sessions: p.max_sessions != null ? Number(p.max_sessions) : null, is_active: !!p.is_active });
            planesPorEscuela.set(p.school_id, l);
        }

        // 3) Asistencia de la ventana (mes evaluado + meses previos que pida la baja), en pocas páginas.
        const maxBaja = Math.max(...escuelas.map((s) => ajustes.get(s)!.baja_meses));
        const meses = Array.from({ length: maxBaja }, (_, i) => restarMeses(year, month, i)); // más reciente primero
        const ini = rangoMes(meses[meses.length - 1].year, meses[meses.length - 1].month).desde;
        const fin = rangoMes(year, month).hasta;
        const registros = await leerTodo<RegistroAsistencia & { attendance_date: string }>((d, h) => supabase
            .from('attendance_records')
            .select('child_id, user_id, unregistered_athlete_id, team_id, attendance_date, status')
            .in('school_id', escuelas).gte('attendance_date', ini).lt('attendance_date', fin)
            .order('attendance_date').order('id').range(d, h));
        const resumenes = meses.map((m) => {
            const r = rangoMes(m.year, m.month);
            return resumirAsistenciaMes(registros.filter((x) => x.attendance_date >= r.desde && x.attendance_date < r.hasta));
        });

        // 4) Pura: proponer por inscripción.
        const descartes: ResultadoCalculo['descartes'] = {};
        const suma = (k: keyof ResultadoCalculo['descartes']) => { descartes[k] = (descartes[k] ?? 0) + 1; };
        type Cand = { insc: any; atleta: NonNullable<ReturnType<typeof atletaDe>>; planActual: PlanTier; plan: PlanTier; direction: Direccion; clases: number; aj: AjustesPlanAsistencia };
        const candidatos: Cand[] = [];
        for (const insc of inscripciones) {
            const atleta = atletaDe(insc);
            if (!atleta) continue;
            const planes = planesPorEscuela.get(insc.school_id) ?? [];
            const planActual = planes.find((p) => p.id === insc.offering_plan_id) ?? null;
            const a = ajustes.get(insc.school_id)!;
            const clasesPorMes = resumenes.map((r) => clasesDelMes(r, atleta.clave, insc.team_id ?? null));
            const prop = propuestaDePlan({
                planActual, planes, clasesPorMes, umbral: a.sube_umbral, bajaMeses: a.baja_meses, feeIsManual: !!insc.fee_is_manual,
            });
            if (prop.tipo === 'nada') { suma(prop.motivo); continue; }
            candidatos.push({ insc, atleta, planActual: planActual!, plan: prop.plan, direction: prop.direction, clases: clasesPorMes[0]!, aj: a });
        }

        // 5) Solo para quienes tienen propuesta: nombres/estado, pagos y deuda (en lote).
        const nombres = new Map<string, string>();
        const inactivos = new Set<string>();
        const tablaDe: Record<ColAtleta, string> = { child_id: 'children', user_id: 'profiles', unregistered_athlete_id: 'unregistered_athletes' };
        for (const col of COLS_ATLETA) {
            const ids = [...new Set(candidatos.filter((c) => c.atleta.col === col).map((c) => c.atleta.id))];
            for (const t of trozos(ids)) {
                const campos = col === 'child_id' ? 'id, full_name, is_active' : 'id, full_name';
                const { data, error } = await supabase.from(tablaDe[col]).select(campos).in('id', t);
                if (error) throw error;
                for (const f of (data ?? []) as any[]) {
                    nombres.set(claveAtleta(col, f.id), f.full_name ?? 'Atleta');
                    if (col === 'child_id' && f.is_active === false) inactivos.add(claveAtleta(col, f.id));
                }
            }
        }
        const vivos = candidatos.filter((c) => {
            if (inactivos.has(c.atleta.clave)) { suma('inactivo'); return false; }
            return true;
        });

        const pagado = new Map<string, number>();
        const deuda = new Map<string, number>();
        const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
        for (const col of COLS_ATLETA) {
            const ids = [...new Set(vivos.filter((c) => c.atleta.col === col).map((c) => c.atleta.id))];
            for (const t of trozos(ids)) {
                const { data, error } = await supabase.from('payments')
                    .select('child_id, user_id, unregistered_athlete_id, school_id, status, amount, amount_paid, late_fee_amount, due_date, period_year, period_month, payment_category')
                    .in(col, t).in('school_id', escuelas).in('status', ['paid', 'overdue', 'pending'])
                    .or('payment_category.is.null,payment_category.in.(mensualidad,plan)');
                if (error) throw error;
                for (const p of (data ?? []) as any[]) {
                    const k = claveAtleta(col, p[col]);
                    if (p.status === 'paid') {
                        if (p.period_year === year && p.period_month === month) pagado.set(k, (pagado.get(k) ?? 0) + Number(p.amount_paid ?? p.amount ?? 0));
                    } else if (String(p.due_date).slice(0, 10) < hoy) {
                        const debe = Math.max(0, Number(p.amount ?? 0) + Number(p.late_fee_amount ?? 0) - Number(p.amount_paid ?? 0));
                        deuda.set(k, (deuda.get(k) ?? 0) + debe);
                    }
                }
            }
        }

        const propuestas: PropuestaFila[] = vivos.map((c) => ({
            school_id: c.insc.school_id, enrollment_id: c.insc.id,
            child_id: c.insc.child_id ?? null, user_id: c.insc.user_id ?? null, unregistered_athlete_id: c.insc.unregistered_athlete_id ?? null,
            atleta: nombres.get(c.atleta.clave) ?? 'Atleta',
            from_plan_id: c.planActual.id, to_plan_id: c.plan.id,
            from_plan: nombrePlan(c.planActual), to_plan: nombrePlan(c.plan),
            from_amount: c.insc.monthly_fee != null ? Number(c.insc.monthly_fee) : c.planActual.price,
            to_amount: c.plan.price,
            clases_mes: c.clases, amount_paid: pagado.get(c.atleta.clave) ?? 0,
            period_year: year, period_month: month,
            debt_at_change: Math.round(deuda.get(c.atleta.clave) ?? 0),
            direction: c.direction,
            razon: razonLegible(c.clases, month, c.planActual, c.plan, c.direction, c.aj.baja_meses),
            modo_escuela: c.aj.modo,
        }));

        const resumen = {
            up: propuestas.filter((p) => p.direction === 'up').length,
            down: propuestas.filter((p) => p.direction === 'down').length,
            same_price: propuestas.filter((p) => p.direction === 'same_price').length,
            down_con_deuda: propuestas.filter((p) => p.direction === 'down' && p.debt_at_change > 0).length,
        };
        const res: ResultadoCalculo = {
            disponible: true, dry_run: dry, year, month, escuelas, inscripciones_evaluadas: inscripciones.length,
            descartes, propuestas, resumen, escritas: 0, ya_registradas: 0, errores: 0,
        };
        if (dry || propuestas.length === 0) return res;

        // 6) Escritura (idempotente): sombra por insert de las faltantes; auto por RPC.
        const escritura = await registrarPropuestas(propuestas);
        return { ...res, ...escritura };
    } catch (err: any) {
        if (esFaltaDeEsquema(err)) return vacio({ dry, y: year, m: month, motivo: `esquema_no_disponible: ${err?.message ?? err}` });
        throw err;
    }
}

const filaDeLog = (p: PropuestaFila, mode: 'sombra' | 'auto') => ({
    school_id: p.school_id, enrollment_id: p.enrollment_id, child_id: p.child_id,
    unregistered_athlete_id: p.unregistered_athlete_id,
    from_plan_id: p.from_plan_id, to_plan_id: p.to_plan_id, from_amount: p.from_amount, to_amount: p.to_amount,
    clases_mes: p.clases_mes, amount_paid: p.amount_paid, period_year: p.period_year, period_month: p.period_month,
    debt_at_change: p.debt_at_change, direction: p.direction, source: 'attendance', mode, applied: false,
    changed_by: 'auto', razon: p.razon,
});

async function registrarPropuestas(props: PropuestaFila[]): Promise<{ escritas: number; ya_registradas: number; errores: number }> {
    let escritas = 0; let ya = 0; let errores = 0;
    const sombra = props.filter((p) => p.modo_escuela === 'sombra');
    const auto = props.filter((p) => p.modo_escuela === 'auto');

    // Qué ya existe (por enrollment + mes + modo): lectura en lote.
    const existentes = new Set<string>();
    const ids = [...new Set(props.map((p) => p.enrollment_id))];
    const { year, month } = { year: props[0].period_year, month: props[0].period_month };
    for (const t of trozos(ids)) {
        const { data, error } = await supabase.from('enrollment_plan_changes')
            .select('enrollment_id, mode').in('enrollment_id', t).eq('period_year', year).eq('period_month', month);
        if (error) throw error;
        for (const r of (data ?? []) as any[]) existentes.add(`${r.enrollment_id}|${r.mode}`);
    }

    const nuevasSombra = sombra.filter((p) => !existentes.has(`${p.enrollment_id}|sombra`));
    ya += sombra.length - nuevasSombra.length;
    for (const t of trozos(nuevasSombra, 200)) {
        const { error } = await supabase.from('enrollment_plan_changes').insert(t.map((p) => filaDeLog(p, 'sombra')));
        if (!error) { escritas += t.length; continue; }
        if (esFaltaDeEsquema(error)) throw error;
        // Carrera con otra instancia (23505): reintento fila a fila solo de este trozo.
        for (const p of t) {
            const { error: e2 } = await supabase.from('enrollment_plan_changes').insert(filaDeLog(p, 'sombra'));
            if (!e2) escritas++;
            else if (e2.code === '23505') ya++;
            else errores++;
        }
    }

    for (const p of auto) {
        if (existentes.has(`${p.enrollment_id}|auto`)) { ya++; continue; }
        const { data, error } = await supabase.rpc('aplicar_cambio_plan', {
            p_enrollment_id: p.enrollment_id, p_to_plan_id: p.to_plan_id, p_source: 'attendance', p_clases: p.clases_mes,
            p_year: p.period_year, p_month: p.period_month, p_debt: p.debt_at_change, p_amount_paid: p.amount_paid,
            p_queue_id: null, p_changed_by: 'auto', p_razon: p.razon,
        });
        if (error) { if (esFaltaDeEsquema(error)) throw error; errores++; continue; }
        if ((data as any)?.ok) escritas++; else ya++;
    }
    return { escritas, ya_registradas: ya, errores };
}
