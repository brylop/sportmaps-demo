/**
 * Franjas de clase de cortesía generadas desde los ENTRENAMIENTOS reales.
 *
 * POR QUÉ EXISTE
 *
 * El bot de WhatsApp agenda la clase de cortesía con las franjas de
 * `school_trial_slots` (ver whatsapp-clase-cortesia.service.ts). Esas franjas
 * hasta hoy se cargaban a mano y Dynasty no tiene ninguna futura: el bot solo
 * puede ofrecer «déjame tus datos». Decisión del usuario (2026-10-06): la
 * clase de cortesía es ir a un entrenamiento real del grupo, así que las
 * franjas salen de `teams.schedule` — todos los grupos con horario cargado, y
 * sin límite de cupos (el prospecto se suma al entrenamiento, no ocupa una
 * plaza aparte).
 *
 * QUÉ HACE
 *
 *   · Para cada equipo activo con horario, una franja por cada sesión semanal
 *     de las próximas N semanas (default 3): fecha, hora inicio/fin, sede
 *     (= `place`), label = nombre del grupo (+ subgrupo si lo tiene), team_id.
 *   · Idempotente: la clave es (team_id, slot_date, start_time). Lee lo que ya
 *     existe antes de insertar y, para las carreras entre los 3 BFF, el índice
 *     único de la migración 20261006084303 hace que el segundo reciba 23505.
 *   · Cierra (is_open=false, NUNCA borra) las franjas que ÉL generó y que ya no
 *     corresponden a ningún entrenamiento (horario cambiado, grupo cerrado o
 *     dado de baja), siempre que no tengan reservas. Una familia que ya
 *     reservó tiene que ver su clase; eso se le avisa a la escuela por reporte.
 *
 * DECISIONES (y por qué)
 *
 *   · `day` sigue la convención de JS (0 = domingo … 6 = sábado), la misma que
 *     `describirEntrenamiento` en whatsapp-info-escuela.service.ts.
 *   · Se excluyen los equipos «NO USAR» (Dynasty tiene uno activo) y los que la
 *     escuela marcó `admite_nuevos = false`: ofrecerle a un prospecto la
 *     clase de un grupo que no recibe nuevos es prometer un cupo que no hay.
 *   · FESTIVOS: no se crean franjas en festivos de Colombia. Muchas escuelas no
 *     entrenan ese día (los coliseos cierran) y el error caro es mandar a una
 *     familia a un entrenamiento que no ocurre; perder una franja de ~40 por
 *     semana no le cuesta nada a nadie. Se puede forzar con `incluirFestivos`.
 *   · Sin límite de cupos: `max_capacity` es NOT NULL con CHECK > 0, así que
 *     va un valor alto (CUPOS_SIN_LIMITE). El bot no muestra «999 cupos»: ver
 *     `esSinLimite`.
 *   · Inserta con service_role directo a la tabla: `create_school_trial_slot`
 *     exige el JWT de un admin y este proceso no tiene uno. Por eso se repite
 *     aquí la misma validación de esa RPC (label no vacío, fecha ≥ hoy) y
 *     `created_by` = owner de la escuela, que es quien «publica» la franja.
 */

import { supabase } from '../config/supabase';
import { esFestivoColombia } from '../utils/festivos-colombia';

/**
 * «Sin límite» de cupos. `max_capacity` no admite NULL ni 0, así que se usa un
 * número que ningún entrenamiento alcanza. Cualquier franja con al menos la
 * mitad de esto disponible se muestra como «cupos disponibles», sin número.
 */
export const CUPOS_SIN_LIMITE = 999;
export const SEMANAS_POR_DEFECTO = 3;

/** ¿Este número de cupos es el «sin límite» y no debe mostrarse como cifra? */
export function esSinLimite(cupos: number): boolean {
    return cupos >= CUPOS_SIN_LIMITE / 2;
}

/** Misma regla que whatsapp-info-escuela.service.ts: la escuela lo marcó así. */
const MARCADO_NO_USAR = /\bno\s+usar\b/i;

export interface EquipoParaFranjas {
    id: string;
    name: string | null;
    active?: boolean | null;
    admite_nuevos?: boolean | null;
    schedule: unknown;
}

export interface FranjaPlaneada {
    team_id: string;
    /** Nombre del equipo, para el reporte (el label puede llevar subgrupo). */
    equipo: string;
    label: string;
    slot_date: string;   // YYYY-MM-DD
    start_time: string;  // HH:MM
    end_time: string | null;
    location: string | null;
}

export interface FranjaExistente {
    id: string;
    team_id: string | null;
    slot_date: string;
    start_time: string;
    reserved_count: number;
    is_open: boolean;
    generated_from_schedule?: boolean | null;
}

export interface PlanDeFranjas {
    franjas: FranjaPlaneada[];
    festivosOmitidos: { fecha: string; label: string }[];
    excluidos: { equipo: string; motivo: string }[];
    /** Dos sesiones del mismo equipo, mismo día y misma hora (subgrupos): se deja una. */
    choques: { fecha: string; hora: string; labels: string[] }[];
}

const DIA_MS = 86_400_000;
const diaUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const isoDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fecha de hoy en Colombia: las franjas se fechan en hora local. */
export function hoyBogota(ahora = new Date()): string {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** «7:00», «07:00», «07:00:00» → «07:00». null si no es una hora. */
export function normalizarHora(h: unknown): string | null {
    const m = String(h ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return null;
    const hh = Number(m[1]); const mm = Number(m[2]);
    if (hh > 23 || mm > 59) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const claveFranja = (teamId: string, fecha: string, hora: string) =>
    `${teamId}|${fecha.slice(0, 10)}|${normalizarHora(hora) ?? hora}`;

function leerHorario(raw: unknown): any[] {
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

/**
 * Plan PURO (sin base): qué franjas deberían existir en la ventana
 * [desde, desde + 7·semanas). No mira lo que ya hay: eso es `compararConExistentes`.
 */
export function planificarFranjas(
    equipos: EquipoParaFranjas[],
    desde: string,
    semanas = SEMANAS_POR_DEFECTO,
    opciones: { incluirFestivos?: boolean } = {},
): PlanDeFranjas {
    const plan: PlanDeFranjas = { franjas: [], festivosOmitidos: [], excluidos: [], choques: [] };
    const dias = Math.max(1, Math.floor(semanas)) * 7;
    const inicio = diaUTC(desde);

    for (const t of equipos) {
        const nombre = String(t.name ?? '').trim();
        if (!nombre) continue;
        if (t.active === false) { plan.excluidos.push({ equipo: nombre, motivo: 'inactivo' }); continue; }
        if (MARCADO_NO_USAR.test(nombre)) { plan.excluidos.push({ equipo: nombre, motivo: 'marcado NO USAR' }); continue; }
        if (t.admite_nuevos === false) { plan.excluidos.push({ equipo: nombre, motivo: 'no admite nuevos' }); continue; }

        const sesiones = leerHorario(t.schedule)
            .filter((f) => f && Number.isInteger(f.day) && f.day >= 0 && f.day <= 6 && normalizarHora(f.time));
        if (!sesiones.length) { plan.excluidos.push({ equipo: nombre, motivo: 'sin horario cargado' }); continue; }

        const vistas = new Map<string, FranjaPlaneada>();
        for (let i = 0; i < dias; i++) {
            const fecha = isoDe(inicio + i * DIA_MS);
            const dow = new Date(inicio + i * DIA_MS).getUTCDay();
            for (const s of sesiones.filter((x) => x.day === dow)) {
                const grupo = String(s.group ?? '').trim();
                // El subgrupo va en el label: Dynasty divide «INTERMEDIO» en
                // Origen y Evolución con horarios y sedes distintas; sin él, la
                // familia no sabe a cuál de los dos va.
                const label = grupo ? `${nombre} · ${grupo}` : nombre;
                const hora = normalizarHora(s.time)!;
                if (!opciones.incluirFestivos && esFestivoColombia(fecha)) {
                    plan.festivosOmitidos.push({ fecha, label });
                    continue;
                }
                const clave = claveFranja(t.id, fecha, hora);
                const previa = vistas.get(clave);
                if (previa) {
                    // Dos subgrupos a la misma hora el mismo día: la clave única
                    // de la base es (team_id, fecha, hora), así que cabe una sola
                    // franja. Se deja la primera y se reporta.
                    plan.choques.push({ fecha, hora, labels: [previa.label, label] });
                    continue;
                }
                const franja: FranjaPlaneada = {
                    team_id: t.id,
                    equipo: nombre,
                    label,
                    slot_date: fecha,
                    start_time: hora,
                    end_time: normalizarHora(s.end),
                    location: String(s.place ?? '').trim() || null,
                };
                vistas.set(clave, franja);
                plan.franjas.push(franja);
            }
        }
    }

    plan.franjas.sort((a, b) => (a.slot_date + a.start_time + a.label).localeCompare(b.slot_date + b.start_time + b.label));
    return plan;
}

/**
 * Qué crear y qué cerrar, contra lo que ya está en la base.
 *
 *   crear   = planeadas cuya clave no existe (abierta o cerrada: si la escuela
 *             cerró una a mano, no se reabre ni se duplica).
 *   cerrar  = generadas por este servicio, abiertas, futuras dentro de la
 *             ventana, SIN reservas, que ya no están en el plan.
 *   conservadasConReserva = las mismas pero con reservas: no se tocan.
 */
export function compararConExistentes(
    plan: FranjaPlaneada[],
    existentes: FranjaExistente[],
    ventana: { desde: string; hasta: string },
): { crear: FranjaPlaneada[]; yaExistian: number; cerrar: FranjaExistente[]; conservadasConReserva: FranjaExistente[] } {
    const hay = new Set(existentes.filter((e) => e.team_id)
        .map((e) => claveFranja(e.team_id!, e.slot_date, e.start_time)));
    const planeadas = new Set(plan.map((p) => claveFranja(p.team_id, p.slot_date, p.start_time)));

    const crear = plan.filter((p) => !hay.has(claveFranja(p.team_id, p.slot_date, p.start_time)));
    const obsoletas = existentes.filter((e) =>
        e.generated_from_schedule === true && e.is_open && e.team_id
        && e.slot_date.slice(0, 10) >= ventana.desde && e.slot_date.slice(0, 10) < ventana.hasta
        && !planeadas.has(claveFranja(e.team_id, e.slot_date, e.start_time)));

    return {
        crear,
        yaExistian: plan.length - crear.length,
        cerrar: obsoletas.filter((e) => (e.reserved_count ?? 0) === 0),
        conservadasConReserva: obsoletas.filter((e) => (e.reserved_count ?? 0) > 0),
    };
}

/** Fila lista para insertar. Repite la validación de `create_school_trial_slot`. */
export function filaParaInsertar(f: FranjaPlaneada, schoolId: string, ownerId: string | null, hoy: string) {
    const label = f.label.trim();
    if (!label) throw new Error('Label requerido');
    if (f.slot_date < hoy) throw new Error('La fecha debe ser futura');
    return {
        school_id: schoolId,
        team_id: f.team_id,
        label,
        slot_date: f.slot_date,
        start_time: f.start_time,
        end_time: f.end_time,
        location: f.location,
        max_capacity: CUPOS_SIN_LIMITE,
        is_open: true,
        created_by: ownerId,
        generated_from_schedule: true,
    };
}

export interface ReporteFranjas {
    schoolId: string;
    escuela: string;
    aplicado: boolean;
    ventana: { desde: string; hasta: string };
    plan: PlanDeFranjas;
    creadas: number;
    yaExistian: number;
    /** Insert que chocó con el índice único (otro BFF ganó la carrera). */
    duplicadasEnCarrera: number;
    cerradas: number;
    conservadasConReserva: { id: string; label?: string; slot_date: string; start_time: string }[];
    errores: string[];
    /** Lo que se crearía/creó, para el reporte por grupo. */
    nuevas: FranjaPlaneada[];
}

const esDuplicado = (e: any) => e?.code === '23505' || /duplicate key/i.test(String(e?.message ?? ''));

/**
 * Sincroniza la ventana rodante de una escuela. Sin `aplicar` no escribe nada
 * (simulación). Nunca lanza por errores de la base: los devuelve en `errores`.
 */
export async function sincronizarFranjasDeEscuela(
    schoolId: string,
    opciones: { semanas?: number; aplicar?: boolean; incluirFestivos?: boolean; hoy?: string } = {},
): Promise<ReporteFranjas> {
    const semanas = opciones.semanas ?? SEMANAS_POR_DEFECTO;
    const hoy = opciones.hoy ?? hoyBogota();
    const hasta = isoDe(diaUTC(hoy) + semanas * 7 * DIA_MS);
    const reporte: ReporteFranjas = {
        schoolId, escuela: schoolId, aplicado: !!opciones.aplicar, ventana: { desde: hoy, hasta },
        plan: { franjas: [], festivosOmitidos: [], excluidos: [], choques: [] },
        creadas: 0, yaExistian: 0, duplicadasEnCarrera: 0, cerradas: 0, conservadasConReserva: [], errores: [], nuevas: [],
    };

    const [escuela, equipos] = await Promise.all([
        supabase.from('schools').select('name, owner_id').eq('id', schoolId).maybeSingle(),
        supabase.from('teams').select('id, name, active, admite_nuevos, schedule').eq('school_id', schoolId).limit(500),
    ]);
    if (escuela.error || !escuela.data) {
        reporte.errores.push(`escuela: ${escuela.error?.message ?? 'no existe'}`);
        return reporte;
    }
    if (equipos.error) {
        reporte.errores.push(`equipos: ${equipos.error.message}`);
        return reporte;
    }
    reporte.escuela = (escuela.data as any).name ?? schoolId;
    const ownerId: string | null = (escuela.data as any).owner_id ?? null;

    reporte.plan = planificarFranjas((equipos.data ?? []) as EquipoParaFranjas[], hoy, semanas,
        { incluirFestivos: opciones.incluirFestivos });

    // `generated_from_schedule` llega con la migración 20261006084303. Si no
    // está aplicada se lee sin ella: la simulación sirve igual, y como ninguna
    // franja figura como generada, no se cierra nada por error.
    let existentes = await supabase.from('school_trial_slots')
        .select('id, team_id, label, slot_date, start_time, reserved_count, is_open, generated_from_schedule')
        .eq('school_id', schoolId).gte('slot_date', hoy).limit(5000);
    let sinMigracion = false;
    if (existentes.error && /generated_from_schedule/.test(existentes.error.message)) {
        sinMigracion = true;
        existentes = await supabase.from('school_trial_slots')
            .select('id, team_id, label, slot_date, start_time, reserved_count, is_open')
            .eq('school_id', schoolId).gte('slot_date', hoy).limit(5000) as any;
    }
    if (existentes.error) {
        reporte.errores.push(`franjas existentes: ${existentes.error.message}`);
        return reporte;
    }

    const filas = (existentes.data ?? []) as any[];
    const cmp = compararConExistentes(reporte.plan.franjas, filas as FranjaExistente[], reporte.ventana);
    reporte.yaExistian = cmp.yaExistian;
    reporte.nuevas = cmp.crear;
    reporte.conservadasConReserva = cmp.conservadasConReserva.map((e: any) => ({
        id: e.id, label: e.label, slot_date: e.slot_date, start_time: e.start_time,
    }));

    if (!opciones.aplicar) {
        reporte.cerradas = cmp.cerrar.length; // «se cerrarían»
        return reporte;
    }
    if (sinMigracion) {
        reporte.errores.push('falta aplicar la migración 20261006084303 (generated_from_schedule + índice único): no se escribe nada');
        return reporte;
    }

    // Insert por lotes; si un lote choca con el índice único (otro BFF metió
    // alguna en el medio), ese lote se reintenta fila por fila para no perder
    // las que sí faltan.
    const LOTE = 100;
    for (let i = 0; i < cmp.crear.length; i += LOTE) {
        const lote = cmp.crear.slice(i, i + LOTE);
        let filasLote: ReturnType<typeof filaParaInsertar>[];
        try {
            filasLote = lote.map((f) => filaParaInsertar(f, schoolId, ownerId, hoy));
        } catch (e: any) {
            reporte.errores.push(`validación: ${e?.message}`);
            continue;
        }
        const { error } = await supabase.from('school_trial_slots').insert(filasLote);
        if (!error) { reporte.creadas += filasLote.length; continue; }
        if (!esDuplicado(error)) { reporte.errores.push(`insertar: ${error.message}`); continue; }
        for (const fila of filasLote) {
            const r = await supabase.from('school_trial_slots').insert(fila);
            if (!r.error) reporte.creadas++;
            else if (esDuplicado(r.error)) reporte.duplicadasEnCarrera++;
            else reporte.errores.push(`insertar ${fila.label} ${fila.slot_date} ${fila.start_time}: ${r.error.message}`);
        }
    }

    if (cmp.cerrar.length) {
        // El filtro reserved_count = 0 se repite en el UPDATE: si alguien
        // reservó entre la lectura y ahora, esa franja NO se cierra.
        const { data, error } = await supabase.from('school_trial_slots')
            .update({ is_open: false })
            .in('id', cmp.cerrar.map((e) => e.id))
            .eq('generated_from_schedule', true)
            .eq('reserved_count', 0)
            .select('id');
        if (error) reporte.errores.push(`cerrar obsoletas: ${error.message}`);
        else reporte.cerradas = (data ?? []).length;
    }

    return reporte;
}

/**
 * Job diario: mantiene la ventana rodante en las escuelas con la opción
 * activa. Lo corren los 3 BFF a la misma hora; es seguro por el índice único
 * (23505 = otro ya la creó) y porque cerrar es idempotente.
 */
export async function runFranjasCortesia(): Promise<{ escuelas: number; creadas: number; cerradas: number; errores: number }> {
    const total = { escuelas: 0, creadas: 0, cerradas: 0, errores: 0 };
    const { data, error } = await supabase.from('school_settings')
        .select('school_id').eq('courtesy_from_training', true).limit(1000);
    if (error) {
        // 42703 = la columna todavía no existe (migración sin aplicar). No es
        // una falla del job: simplemente no hay nada que hacer aún.
        if ((error as any).code === '42703' || /courtesy_from_training/.test(error.message)) {
            console.log('[franjas-cortesia] migración 20261006084303 sin aplicar: no hay escuelas con la opción.');
        } else {
            console.error('[franjas-cortesia] no se pudo leer school_settings:', error.message);
            total.errores++;
        }
        return total;
    }
    for (const fila of (data ?? []) as any[]) {
        try {
            const r = await sincronizarFranjasDeEscuela(fila.school_id, { aplicar: true });
            total.escuelas++;
            total.creadas += r.creadas;
            total.cerradas += r.cerradas;
            total.errores += r.errores.length;
            if (r.errores.length) console.warn('[franjas-cortesia]', r.escuela, r.errores);
            if (r.conservadasConReserva.length) {
                console.warn(`[franjas-cortesia] ${r.escuela}: ${r.conservadasConReserva.length} franja(s) con reserva ya no coinciden con el horario; quedan abiertas para no dejar plantada a la familia.`);
            }
        } catch (e: any) {
            total.errores++;
            console.error('[franjas-cortesia] escuela', fila.school_id, e?.message ?? e);
        }
    }
    return total;
}
