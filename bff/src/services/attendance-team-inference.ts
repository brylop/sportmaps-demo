/**
 * attendance-team-inference — de qué equipo es una planilla de asistencia, y
 * cruce de nombres contra un roster. Funciones PURAS (sin base, sin red).
 *
 * Por qué no sirve el remitente: en Dynasty cada coach está asignado a todos
 * los equipos (team_coaches 81 filas). El equipo se deduce de la hoja, en cascada
 * (docs/specs/whatsapp-conversacion-v2-dynasty.md §3.8, «De qué equipo es la planilla»):
 *   1. ≥70 % de los nombres reconocidos son de UN equipo (señal principal);
 *   2. el encabezado confirma o desempata;
 *   3. el horario (teams.schedule) vs la hora del mensaje desempata;
 *   4. si no, devuelve candidatos para preguntar con botones.
 * Una hoja con dos equipos mezclados se parte por rosters (`particion`).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Nombres
// ─────────────────────────────────────────────────────────────────────────────
const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'san', 'santa']);

export function normalizarNombre(s: string): string {
    return (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokensNombre(s: string): string[] {
    return normalizarNombre(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t));
}

/** Levenshtein acotado: solo interesa saber si la distancia es ≤ max. */
function dentroDeDistancia(a: string, b: string, max: number): boolean {
    if (Math.abs(a.length - b.length) > max) return false;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length] <= max;
}

/** 1 = igual, 0.85 = typo/otra ortografía, 0.6 = abreviatura/apodo (prefijo ≥3), 0 = nada. */
function similitudToken(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length >= 5 && b.length >= 5 && dentroDeDistancia(a, b, 1)) return 0.85;
    if (a.length >= 7 && b.length >= 7 && dentroDeDistancia(a, b, 2)) return 0.7;
    // «Dana» / «Danna»: una letra de diferencia en nombres cortos, misma inicial.
    if (a.length >= 4 && b.length >= 4 && a[0] === b[0] && dentroDeDistancia(a, b, 1)) return 0.75;
    const [c, l] = a.length <= b.length ? [a, b] : [b, a];
    if (c.length >= 3 && l.startsWith(c)) return 0.6;
    return 0;
}

/**
 * Puntaje 0..1 del nombre de la hoja contra un nombre del roster. Ignora el
 * orden (la hoja va «APELLIDOS NOMBRES», el roster suele ir «NOMBRES APELLIDOS»).
 * Los apellidos pesan: el primer token de la hoja pesa 1,5 y el resto 1; cada
 * token de la hoja se empareja con a lo sumo uno del roster. Se divide por el
 * peso de los tokens de la hoja (una hoja con solo «ARROYO SEBASTIAN» puede
 * calzar perfecto con «Sebastián Arroyo Lozano»).
 */
export function puntuarNombre(nombreHoja: string, nombreRoster: string): number {
    const hoja = tokensNombre(nombreHoja);
    const ros = tokensNombre(nombreRoster);
    if (!hoja.length || !ros.length) return 0;
    const usados = new Set<number>();
    let ganado = 0;
    let total = 0;
    hoja.forEach((t, i) => {
        const w = i === 0 ? 1.5 : 1;
        total += w;
        let mejor = 0; let mejorJ = -1;
        ros.forEach((r, j) => {
            if (usados.has(j)) return;
            const s = similitudToken(t, r);
            if (s > mejor) { mejor = s; mejorJ = j; }
        });
        if (mejorJ >= 0) { usados.add(mejorJ); ganado += w * mejor; }
    });
    return ganado / total;
}

export interface AtletaRoster { id: string; nombre: string; kind?: string }
export interface RosterEquipo { team_id: string; team_name: string; atletas: AtletaRoster[] }

export const UMBRAL_RECONOCIDO = 0.75;

export interface Coincidencia {
    atleta: AtletaRoster | null;
    score: number;
    /** Segundo mejor (para ver ambigüedad y para sugerir cuando no se reconoce). */
    segundo: { atleta: AtletaRoster; score: number } | null;
    /** true si hay ≥2 atletas que empatan casi (diferencia < 0.05) por encima del umbral. */
    ambiguo: boolean;
}

export function mejorCoincidencia(nombreHoja: string, atletas: AtletaRoster[]): Coincidencia {
    let mejor: { atleta: AtletaRoster; score: number } | null = null;
    let segundo: { atleta: AtletaRoster; score: number } | null = null;
    for (const a of atletas) {
        const score = puntuarNombre(nombreHoja, a.nombre);
        if (score <= 0) continue;
        if (!mejor || score > mejor.score) { segundo = mejor; mejor = { atleta: a, score }; }
        else if (!segundo || score > segundo.score) segundo = { atleta: a, score };
    }
    const ambiguo = !!(mejor && segundo && mejor.score >= UMBRAL_RECONOCIDO && mejor.score - segundo.score < 0.05);
    return { atleta: mejor?.atleta ?? null, score: mejor?.score ?? 0, segundo, ambiguo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Horarios
// ─────────────────────────────────────────────────────────────────────────────
export interface FranjaHorario { day: number; time: string; end: string; place?: string; group?: string }
export interface HorarioEquipo { team_id: string; team_name: string; schedule: FranjaHorario[] | null }

const hmAMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };

/** Día de la semana (0=domingo) y minutos desde medianoche, en hora Colombia. */
export function relojColombia(ahora: Date): { dow: number; min: number; fecha: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(ahora);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { dow, min: Number(get('hour')) * 60 + Number(get('minute')), fecha: `${get('year')}-${get('month')}-${get('day')}` };
}

export interface FranjaActiva {
    team_id: string; team_name: string; group: string | null; place: string | null;
    time: string; end: string;
}

/** Franjas de HOY que empiezan hasta `antesH` horas adelante o terminaron hace menos de `despuesH` horas. */
export function franjasActivas(horarios: HorarioEquipo[], ahora: Date, ventanaH = 2): FranjaActiva[] {
    const { dow, min } = relojColombia(ahora);
    const v = ventanaH * 60;
    const out: FranjaActiva[] = [];
    for (const h of horarios) {
        for (const f of h.schedule ?? []) {
            if (f.day !== dow || !f.time || !f.end) continue;
            if (min >= hmAMin(f.time) - v && min <= hmAMin(f.end) + v) {
                out.push({ team_id: h.team_id, team_name: h.team_name, group: f.group ?? null, place: f.place ?? null, time: f.time, end: f.end });
            }
        }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time) || a.team_name.localeCompare(b.team_name));
}

/**
 * Fecha de la sesión cuando la hoja no la trae: hoy si el equipo tiene franja
 * hoy (aunque ya haya terminado: foto del martes a las 21:00 = clase de hoy);
 * si no, la clase más reciente de los últimos 7 días; si no tiene horario, hoy.
 */
export function fechaSesionSugerida(slots: FranjaHorario[] | null, ahora: Date): { fecha: string; origen: 'hoy' | 'ultima_clase' | 'sin_horario' } {
    const { dow, fecha } = relojColombia(ahora);
    if (!slots?.length) return { fecha, origen: 'sin_horario' };
    if (slots.some((s) => s.day === dow)) return { fecha, origen: 'hoy' };
    const [y, m, d] = fecha.split('-').map(Number);
    for (let atras = 1; atras <= 7; atras++) {
        const dt = new Date(Date.UTC(y, m - 1, d - atras));
        if (slots.some((s) => s.day === dt.getUTCDay())) return { fecha: dt.toISOString().slice(0, 10), origen: 'ultima_clase' };
    }
    return { fecha, origen: 'sin_horario' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inferencia de equipo
// ─────────────────────────────────────────────────────────────────────────────
export interface CandidatoEquipo {
    team_id: string; team_name: string;
    /** reconocidos de este equipo / reconocidos en algún equipo. */
    fraccion: number; reconocidos: number;
}
export interface ParticionEquipo { team_id: string; team_name: string; nombres: string[] }
export interface InferenciaEquipo {
    team_id: string | null;
    team_name: string | null;
    candidatos: CandidatoEquipo[];
    confianza: 'alta' | 'media' | 'baja';
    motivo: string;
    /** Hoja con dos equipos mezclados: una sesión por equipo. */
    particion?: ParticionEquipo[];
    /** Sub-grupo (group del horario) cuando el horario lo desempató. */
    grupo?: string | null;
}

export const UMBRAL_EQUIPO = 0.7;
const MIN_RECONOCIDOS = 3;

/** ¿El encabezado de la hoja nombra este equipo? Todos los tokens del equipo (o su grupo) aparecen en el encabezado. */
export function encabezadoCoincide(encabezado: string | null | undefined, teamName: string, grupos: string[] = []): boolean {
    const h = new Set(tokensNombre(encabezado ?? ''));
    if (!h.size) return false;
    const tn = tokensNombre(teamName);
    if (tn.length && tn.every((t) => [...h].some((x) => similitudToken(x, t) >= 0.85))) return true;
    // «Nueva Era» impreso como «NUEVA ERA» ya entra arriba; subgrupo («White») solo si además calza una palabra del equipo.
    return grupos.some((g) => tokensNombre(g).some((t) => h.has(t)) && tn.some((t) => h.has(t)));
}

export function inferirEquipo(p: {
    nombresOCR: string[];
    encabezadoOCR?: string | null;
    ahora: Date;
    rosters: RosterEquipo[];
    horarios: HorarioEquipo[];
}): InferenciaEquipo {
    const nombres = p.nombresOCR.filter((n) => tokensNombre(n).length > 0);
    const porEquipo = new Map<string, Set<number>>();
    const nombreEquipo = new Map<string, string>();
    for (const r of p.rosters) {
        nombreEquipo.set(r.team_id, r.team_name);
        const set = new Set<number>();
        nombres.forEach((n, i) => {
            const c = mejorCoincidencia(n, r.atletas);
            if (c.atleta && c.score >= UMBRAL_RECONOCIDO) set.add(i);
        });
        porEquipo.set(r.team_id, set);
    }
    const union = new Set<number>();
    porEquipo.forEach((s) => s.forEach((i) => union.add(i)));

    const candidatos: CandidatoEquipo[] = [...porEquipo.entries()]
        .map(([team_id, s]) => ({
            team_id, team_name: nombreEquipo.get(team_id)!, reconocidos: s.size,
            fraccion: union.size ? s.size / union.size : 0,
        }))
        .filter((c) => c.reconocidos > 0)
        .sort((a, b) => b.fraccion - a.fraccion || b.reconocidos - a.reconocidos);

    const horarioDe = (id: string) => p.horarios.find((h) => h.team_id === id);
    const gruposDe = (id: string) => [...new Set((horarioDe(id)?.schedule ?? []).map((s) => s.group).filter(Boolean) as string[])];
    const headerOk = (id: string) => encabezadoCoincide(p.encabezadoOCR, nombreEquipo.get(id) ?? '', gruposDe(id));
    const activos = new Set(franjasActivas(p.horarios, p.ahora).map((f) => f.team_id));
    const elegir = (c: CandidatoEquipo, confianza: InferenciaEquipo['confianza'], motivo: string): InferenciaEquipo => {
        const franja = franjasActivas(p.horarios, p.ahora).find((f) => f.team_id === c.team_id);
        return { team_id: c.team_id, team_name: c.team_name, candidatos: candidatos.slice(0, 4), confianza, motivo, grupo: franja?.group ?? null };
    };

    const min = Math.min(MIN_RECONOCIDOS, Math.max(1, nombres.length));
    const top = candidatos[0];
    const segundo = candidatos[1];

    // (1) Nombres vs rosters
    if (top && union.size >= min && top.fraccion >= UMBRAL_EQUIPO && !(segundo && segundo.fraccion >= UMBRAL_EQUIPO && segundo.reconocidos === top.reconocidos)) {
        const hdr = headerOk(top.team_id);
        const hdrOtro = p.rosters.find((r) => r.team_id !== top.team_id && headerOk(r.team_id));
        const pct = Math.round(top.fraccion * 100);
        if (hdrOtro && !hdr) {
            return elegir(top, 'media', `${pct}% de los nombres son de ${top.team_name}, pero el encabezado dice ${hdrOtro.team_name}: confirmar.`);
        }
        return elegir(top, hdr || !p.encabezadoOCR ? 'alta' : 'media',
            `${top.reconocidos} de ${union.size} nombres reconocidos (${pct}%) son de ${top.team_name}${hdr ? ' y el encabezado coincide' : ''}.`);
    }

    // Hoja con dos equipos mezclados → partir por rosters
    if (segundo && union.size >= 2 * MIN_RECONOCIDOS) {
        const exclusivos = (id: string) => [...porEquipo.get(id)!].filter((i) => !candidatos.some((c) => c.team_id !== id && porEquipo.get(c.team_id)!.has(i)));
        const a = exclusivos(top.team_id); const b = exclusivos(segundo.team_id);
        if (a.length >= MIN_RECONOCIDOS && b.length >= MIN_RECONOCIDOS && (a.length + b.length) >= 0.85 * union.size
            && Math.min(a.length, b.length) >= 0.25 * union.size) {
            return {
                team_id: null, team_name: null, candidatos: candidatos.slice(0, 4), confianza: 'media',
                motivo: `La hoja mezcla dos equipos: ${a.length} de ${top.team_name} y ${b.length} de ${segundo.team_name}.`,
                particion: [
                    { team_id: top.team_id, team_name: top.team_name, nombres: a.map((i) => nombres[i]) },
                    { team_id: segundo.team_id, team_name: segundo.team_name, nombres: b.map((i) => nombres[i]) },
                ],
            };
        }
    }

    // (2) Encabezado como desempate entre los plausibles (o entre todos si no hay nombres)
    const plausibles = candidatos.filter((c) => c.fraccion >= 0.4);
    const pool = plausibles.length ? plausibles : p.rosters.filter(() => union.size === 0).map((r) => ({ team_id: r.team_id, team_name: r.team_name, fraccion: 0, reconocidos: 0 }));
    const porHeader = pool.filter((c) => headerOk(c.team_id));
    if (porHeader.length === 1) {
        return elegir(porHeader[0], plausibles.length ? 'media' : 'baja', `Desempate por encabezado: «${p.encabezadoOCR}» → ${porHeader[0].team_name}.`);
    }

    // (3) Horario vs hora del mensaje
    const base = porHeader.length > 1 ? porHeader : pool;
    const porHorario = base.filter((c) => activos.has(c.team_id));
    if (porHorario.length === 1) {
        return elegir(porHorario[0], 'media', `Desempate por horario: ${porHorario[0].team_name} tiene clase en esta franja.`);
    }

    // (4) Preguntar
    const lista = (base.length ? base : candidatos).slice(0, 4);
    return {
        team_id: null, team_name: null,
        candidatos: (lista.length ? lista : candidatos).slice(0, 4),
        confianza: 'baja',
        motivo: union.size === 0
            ? 'Ningún nombre de la hoja se reconoció en los rosters.'
            : `Sin equipo claro: ${candidatos.slice(0, 2).map((c) => `${c.team_name} ${Math.round(c.fraccion * 100)}%`).join(' / ')}.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cruce de la planilla con el roster del equipo
// ─────────────────────────────────────────────────────────────────────────────
export interface FilaPlanilla {
    nombre: string;
    struck?: boolean;
    /** fecha ISO → interpretación de la marca. Sin clave = celda vacía. */
    marcasPorFecha: Record<string, 'asistio' | 'sin_marca' | 'dudosa'>;
    nota?: string | null;
}

export interface FilaCruzada {
    nombreHoja: string;
    atletaId: string | null;
    atletaNombre: string | null;
    score: number;
    estado: 'exacto' | 'probable' | 'ambiguo' | 'no_encontrada' | 'ignorada';
    /** Cuando no se reconoce: el más parecido del roster, solo como sugerencia. */
    sugerencia: { id: string; nombre: string; score: number } | null;
    marcasPorFecha: FilaPlanilla['marcasPorFecha'];
    nota?: string | null;
}

export interface ResumenFecha {
    fecha: string;
    presentes: FilaCruzada[];
    sinMarca: FilaCruzada[];
    dudosas: FilaCruzada[];
}

export interface CruceResultado {
    filas: FilaCruzada[];
    porFecha: ResumenFecha[];
    noEncontradas: FilaCruzada[];
    ambiguas: FilaCruzada[];
    /** Dos filas de la hoja que apuntan al mismo atleta. */
    duplicados: Array<{ atletaId: string; atletaNombre: string; nombresHoja: string[] }>;
    ignoradas: FilaCruzada[];
}

/**
 * Cruza las filas de la hoja con el roster. «Retirada»/tachada se ignora; la
 * celda vacía es `sin_marca` (NO falta); lo que no calza se ofrece como «no
 * encontrada» con el más parecido de sugerencia — nunca se crea un atleta.
 * Un atleta emparejado dos veces se reporta en `duplicados` y se asigna a la
 * fila de mejor puntaje (la otra queda `ambiguo`).
 */
export function cruzarConRoster(filas: FilaPlanilla[], roster: AtletaRoster[], fechas: string[]): CruceResultado {
    const cruzadas: FilaCruzada[] = filas.map((f) => {
        if (f.struck) {
            return { nombreHoja: f.nombre, atletaId: null, atletaNombre: null, score: 0, estado: 'ignorada' as const, sugerencia: null, marcasPorFecha: f.marcasPorFecha, nota: f.nota };
        }
        const c = mejorCoincidencia(f.nombre, roster);
        const reconocida = !!c.atleta && c.score >= UMBRAL_RECONOCIDO;
        const estado: FilaCruzada['estado'] = !reconocida ? 'no_encontrada' : c.ambiguo ? 'ambiguo' : c.score >= 0.95 ? 'exacto' : 'probable';
        return {
            nombreHoja: f.nombre,
            atletaId: reconocida && !c.ambiguo ? c.atleta!.id : null,
            atletaNombre: reconocida && !c.ambiguo ? c.atleta!.nombre : null,
            score: c.score,
            estado,
            sugerencia: !reconocida || c.ambiguo
                ? (c.atleta ? { id: c.atleta.id, nombre: c.atleta.nombre, score: Number(c.score.toFixed(2)) } : null)
                : null,
            marcasPorFecha: f.marcasPorFecha, nota: f.nota,
        };
    });

    // duplicados: el mismo atleta en dos filas
    const porAtleta = new Map<string, FilaCruzada[]>();
    for (const f of cruzadas) if (f.atletaId) porAtleta.set(f.atletaId, [...(porAtleta.get(f.atletaId) ?? []), f]);
    const duplicados: CruceResultado['duplicados'] = [];
    for (const [id, fs] of porAtleta) {
        if (fs.length < 2) continue;
        duplicados.push({ atletaId: id, atletaNombre: fs[0].atletaNombre!, nombresHoja: fs.map((x) => x.nombreHoja) });
        const ganadora = [...fs].sort((a, b) => b.score - a.score)[0];
        for (const f of fs) if (f !== ganadora) { f.estado = 'ambiguo'; f.sugerencia = { id, nombre: f.atletaNombre!, score: Number(f.score.toFixed(2)) }; f.atletaId = null; f.atletaNombre = null; }
    }

    const porFecha: ResumenFecha[] = fechas.map((fecha) => {
        const r: ResumenFecha = { fecha, presentes: [], sinMarca: [], dudosas: [] };
        for (const f of cruzadas) {
            if (f.estado === 'ignorada') continue;
            const m = f.marcasPorFecha[fecha] ?? 'sin_marca';
            if (m === 'asistio' && f.atletaId) r.presentes.push(f);
            else if (m === 'dudosa') r.dudosas.push(f);
            else if (m === 'sin_marca' && f.atletaId) r.sinMarca.push(f);
        }
        return r;
    });

    return {
        filas: cruzadas, porFecha, duplicados,
        noEncontradas: cruzadas.filter((f) => f.estado === 'no_encontrada' && Object.values(f.marcasPorFecha).some((m) => m === 'asistio')),
        ambiguas: cruzadas.filter((f) => f.estado === 'ambiguo'),
        ignoradas: cruzadas.filter((f) => f.estado === 'ignorada'),
    };
}

/**
 * Resumen para el coach: «Intermedio, 22-oct: 14 presentes, 3 sin marca, 1 no encontrada».
 */
export function resumenPlanilla(teamName: string, r: ResumenFecha, noEncontradas: number): string {
    const [, m, d] = r.fecha.split('-').map(Number);
    const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1];
    const partes = [`${r.presentes.length} presentes`, `${r.sinMarca.length} sin marca`];
    if (r.dudosas.length) partes.push(`${r.dudosas.length} dudosas`);
    if (noEncontradas) partes.push(`${noEncontradas} no encontrada${noEncontradas > 1 ? 's' : ''}`);
    return `${teamName}, ${d}-${mes}: ${partes.join(', ')}`;
}
