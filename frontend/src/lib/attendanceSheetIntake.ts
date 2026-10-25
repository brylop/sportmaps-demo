/**
 * Funciones puras de «Planillas por revisar» (asistencia en papel por foto).
 * Contrato: bff/src/routes/attendance-sheet-intake.routes.ts (comentario de cabecera).
 *
 * Regla de oro: lo único que se guarda es lo que el staff dejó MARCADO. «Sin marca» no es falta
 * y NUNCA se marca solo; una fila «no encontrada» solo cuenta si el staff le asigna un deportista.
 */

export type MarcaCelda = 'asistio' | 'sin_marca' | 'dudosa';
export type EstadoFila = 'exacto' | 'probable' | 'ambiguo' | 'no_encontrada' | 'ignorada';

export interface FilaCruzada {
    nombreHoja: string;
    atletaId: string | null;
    atletaNombre: string | null;
    score: number;
    estado: EstadoFila;
    sugerencia: { id: string; nombre: string; score: number } | null;
    marcasPorFecha: Record<string, MarcaCelda>;
    nota?: string | null;
}

export interface ResumenFechaCruce {
    fecha: string;
    presentes: FilaCruzada[];
    sinMarca: FilaCruzada[];
    dudosas: FilaCruzada[];
}

export interface EquipoCruce {
    team_id: string;
    team_name: string;
    fechas?: string[];
    cruce: {
        filas: FilaCruzada[];
        porFecha: ResumenFechaCruce[];
        noEncontradas?: FilaCruzada[];
        ambiguas?: FilaCruzada[];
        duplicados?: Array<{ atletaId: string; atletaNombre: string; nombresHoja: string[] }>;
        ignoradas?: FilaCruzada[];
    };
}

export interface RosterEquipo {
    teamId: string;
    teamName: string;
    atletas: Array<{ id: string; nombre: string }>;
}

export interface ResumenEquipoItem {
    teamId: string;
    teamName: string;
    fechas: Array<{ fecha: string; presentes: number; sinMarca: number; dudosas: number }>;
    noEncontradas: number;
    ambiguas: number;
    duplicados: number;
}

export interface PlanillaItem {
    id: string;
    source: 'whatsapp' | 'app';
    status: string;
    modo: 'foto' | 'lista' | null;
    teamId: string | null;
    teamName: string | null;
    sessionDate: string | null;
    createdAt: string;
    notas: string | null;
    submittedBy: { id: string | null; name: string | null };
    photoUrl: string | null;
    equipos: ResumenEquipoItem[];
    candidatos: Array<{ teamId: string; teamName: string; fraccion: number }>;
    confianza: 'alta' | 'media' | 'baja' | null;
    motivo: string | null;
}

export interface PlanillaDetalle extends PlanillaItem {
    extracted: unknown;
    matches:
        | { modo: 'foto'; hoy?: string; equipos: EquipoCruce[] }
        | { modo: 'lista'; team_id: string; team_name: string; fecha: string; roster: Array<{ n: number; id: string; kind: string; nombre: string }> }
        | null;
    teamCandidates: unknown;
    rosters: RosterEquipo[];
}

export interface Correcciones {
    teamId?: string;
    porFecha?: Array<{ teamId?: string; fecha: string; presentes: string[] }>;
}

/** Estado editable de un equipo: overrides del staff y asignaciones de filas no reconocidas. */
export interface EdicionEquipo {
    /** `${fecha}|${atletaId}` → true/false (lo que el staff tocó; ausente = valor original). */
    toques: Record<string, boolean>;
    /** nombreHoja → atletaId elegido para una fila que el cruce no pudo resolver. */
    asignaciones: Record<string, string>;
}

export const edicionVacia = (): EdicionEquipo => ({ toques: {}, asignaciones: {} });
export const claveCelda = (fecha: string, atletaId: string) => `${fecha}|${atletaId}`;

/** Fechas de la grilla de un equipo, ordenadas y sin repetir. */
export function fechasDeEquipo(e: EquipoCruce): string[] {
    const s = new Set<string>(e.fechas ?? []);
    for (const d of e.cruce.porFecha ?? []) s.add(d.fecha);
    for (const f of e.cruce.filas ?? []) for (const k of Object.keys(f.marcasPorFecha ?? {})) s.add(k);
    return [...s].sort();
}

/** Filas de la hoja que el cruce no resolvió y que traen alguna marca (asistió o dudosa). */
export function filasSinResolver(e: EquipoCruce): FilaCruzada[] {
    return (e.cruce.filas ?? []).filter(
        (f) => !f.atletaId && f.estado !== 'ignorada'
            && Object.values(f.marcasPorFecha ?? {}).some((m) => m === 'asistio' || m === 'dudosa'),
    );
}

/** Marca original de un deportista en una fecha según el OCR (null = no aparece en la hoja). */
export function marcaOriginal(e: EquipoCruce, atletaId: string, fecha: string): MarcaCelda | null {
    const f = (e.cruce.filas ?? []).find((x) => x.atletaId === atletaId && x.estado !== 'ignorada');
    return f?.marcasPorFecha?.[fecha] ?? null;
}

/** ¿Está marcado como presente ESE día, con los toques y asignaciones del staff aplicados? */
export function estaPresente(e: EquipoCruce, ed: EdicionEquipo, atletaId: string, fecha: string): boolean {
    const toque = ed.toques[claveCelda(fecha, atletaId)];
    if (toque !== undefined) return toque;
    if (marcaOriginal(e, atletaId, fecha) === 'asistio') return true;
    // Fila no reconocida asignada a este deportista: hereda sus marcas «asistió».
    for (const f of filasSinResolver(e)) {
        if (ed.asignaciones[f.nombreHoja] === atletaId && f.marcasPorFecha?.[fecha] === 'asistio') return true;
    }
    return false;
}

/** Ids presentes por fecha, en el orden del roster. Es lo que se manda a /confirmar. */
export function presentesFinales(e: EquipoCruce, roster: RosterEquipo | undefined, ed: EdicionEquipo): Record<string, string[]> {
    const ids = new Set<string>();
    for (const f of e.cruce.filas ?? []) if (f.atletaId) ids.add(f.atletaId);
    for (const a of roster?.atletas ?? []) ids.add(a.id);
    for (const id of Object.values(ed.asignaciones)) if (id) ids.add(id);
    const orden = new Map((roster?.atletas ?? []).map((a, i) => [a.id, i]));
    const out: Record<string, string[]> = {};
    for (const fecha of fechasDeEquipo(e)) {
        out[fecha] = [...ids]
            .filter((id) => estaPresente(e, ed, id, fecha))
            .sort((a, b) => (orden.get(a) ?? 1e6) - (orden.get(b) ?? 1e6));
    }
    return out;
}

/** Arma el body de POST /:id/confirmar. Solo manda fechas con al menos un presente (el BFF ignora las vacías). */
export function armarCorrecciones(
    equipos: EquipoCruce[],
    rosters: RosterEquipo[],
    ediciones: Record<string, EdicionEquipo>,
    teamId?: string,
): Correcciones {
    const porFecha: NonNullable<Correcciones['porFecha']> = [];
    for (const e of equipos) {
        const roster = rosters.find((r) => r.teamId === e.team_id);
        const finales = presentesFinales(e, roster, ediciones[e.team_id] ?? edicionVacia());
        for (const [fecha, presentes] of Object.entries(finales)) {
            if (presentes.length) porFecha.push({ teamId: e.team_id, fecha, presentes });
        }
    }
    const c: Correcciones = { porFecha };
    if (teamId) c.teamId = teamId;
    return c;
}

/** Conteos para mostrar bajo la grilla. */
export function contarGrilla(e: EquipoCruce, roster: RosterEquipo | undefined, ed: EdicionEquipo) {
    const finales = presentesFinales(e, roster, ed);
    return Object.entries(finales).map(([fecha, ids]) => ({ fecha, presentes: ids.length }));
}

/** ¿Se puede guardar? Hace falta equipo definido, al menos un presente y nada pendiente de elegir. */
export function puedeGuardar(e: EquipoCruce[], rosters: RosterEquipo[], ediciones: Record<string, EdicionEquipo>): boolean {
    if (!e.length) return false;
    return armarCorrecciones(e, rosters, ediciones).porFecha!.length > 0;
}

/** «2026-10-22» → «22 oct» sin pasar por Date (evita el corrimiento de zona horaria). */
export function fechaCorta(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${Number(m[3])} ${meses[Number(m[2]) - 1] ?? m[2]}`;
}

/** ¿Hay que preguntar el equipo? Sin equipo, o con confianza que no es alta. */
export function necesitaElegirEquipo(item: Pick<PlanillaItem, 'teamId' | 'confianza' | 'equipos' | 'modo'>): boolean {
    if (item.modo === 'lista') return false;
    if (!item.equipos.length) return true;
    return item.confianza !== null && item.confianza !== 'alta';
}
