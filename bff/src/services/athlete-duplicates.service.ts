/**
 * UNA sola regla de «¿esta persona ya está registrada en la escuela?»
 * (spec cobros-multiples §16.3, D17; memoria «Identidades de atleta duplicadas»).
 *
 * La regla vive en la base: `_find_athlete_duplicates(p_school_id, p_full_name,
 * p_doc_number, p_phone)` (F1, solo service_role), que usa las mismas funciones
 * que el trigger vivo `bloquear_atleta_duplicado` (normalize_doc_number,
 * doc_casi_igual, normalize_athlete_name, nombre_es_prefijo) y cruza las TRES
 * identidades: `children`, `unregistered_athletes` y adultos con inscripción.
 * Aquí se llama y se interpreta. La usan:
 *   · el buscador del modal «Cobros y pagos» (GET /charge-batches/athlete-search),
 *   · el alta (`students-create-one.route.ts`, antes `findExistingAthlete`).
 *
 * Qué es duplicado:
 *   · documento (exacto o casi igual)  → duplicado;
 *   · nombre (exacto o prefijo)        → duplicado;
 *   · teléfono SOLO                    → NO es duplicado (hermanos comparten
 *     acudiente: caso Ariza Sánchez, Dynasty). Se devuelve como «mismo
 *     acudiente que …», informativo.
 *
 * Mientras F1 no esté aplicada la RPC no existe (PGRST202 / 42883). Entonces se
 * usa la regla local de abajo, que reproduce EXACTAMENTE lo que hacía
 * `findExistingAthlete` (documento exacto, nombre normalizado exacto, children +
 * unregistered_athletes) más el teléfono informativo, para que el alta no
 * cambie de comportamiento antes de tiempo.
 */
import { supabase } from '../config/supabase';

export type CampoCoincidencia = 'documento' | 'nombre' | 'telefono';
export type TablaAtleta = 'children' | 'unregistered_athletes' | 'profiles';

export interface CoincidenciaAtleta {
    table: TablaAtleta;
    athlete_type: 'child' | 'unregistered' | 'adult';
    id: string;
    full_name: string;
    /** Documento enmascarado (solo los últimos 3 dígitos). */
    doc_masked: string | null;
    /** Acudiente (nombre) si se conoce. */
    guardian: string | null;
    matched_by: CampoCoincidencia[];
    /** documento o nombre; el teléfono solo nunca lo es. */
    es_duplicado: boolean;
    /** Texto para el personal: «mismo documento», «mismo nombre», «mismo acudiente que …». */
    motivo: string;
}

export interface CriteriosBusqueda {
    fullName?: string | null;
    docNumber?: string | null;
    phone?: string | null;
}

/** minúsculas, sin acentos, espacios colapsados (igual que el alta). */
export function normalizarNombre(nombre: string): string {
    return nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Solo dígitos, últimos 10 (quita +57 y espacios). */
export function normalizarTelefono(tel: string | null | undefined): string | null {
    const d = String(tel ?? '').replace(/\D/g, '');
    if (d.length < 7) return null;
    return d.slice(-10);
}

export function enmascararDocumento(doc: string | null | undefined): string | null {
    const d = String(doc ?? '').trim();
    if (!d) return null;
    if (d.length <= 3) return '•••';
    return `${'•'.repeat(Math.min(d.length - 3, 7))}${d.slice(-3)}`;
}

/** Interpreta `matched_by` de la RPC (texto, lista separada por comas o arreglo). */
export function camposDeCoincidencia(raw: unknown): CampoCoincidencia[] {
    const partes = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(/[,;|\s]+/);
    const out = new Set<CampoCoincidencia>();
    for (const p of partes) {
        const x = p.toLowerCase();
        if (!x) continue;
        if (x.includes('doc')) out.add('documento');
        else if (x.includes('nombre') || x.includes('name')) out.add('nombre');
        else if (x.includes('tel') || x.includes('phone') || x.includes('acudiente')) out.add('telefono');
    }
    return [...out];
}

/** La regla: documento o nombre = duplicado; teléfono solo = informativo. */
export function esDuplicado(campos: readonly CampoCoincidencia[]): boolean {
    return campos.includes('documento') || campos.includes('nombre');
}

function motivoDe(campos: readonly CampoCoincidencia[], nombre: string): string {
    if (campos.includes('documento')) return 'mismo documento';
    if (campos.includes('nombre')) return 'mismo nombre';
    return `mismo acudiente que ${nombre}`;
}

const TIPO_POR_TABLA: Record<TablaAtleta, CoincidenciaAtleta['athlete_type']> = {
    children: 'child',
    unregistered_athletes: 'unregistered',
    profiles: 'adult',
};

function aTabla(raw: unknown): TablaAtleta {
    const t = String(raw ?? '');
    if (t === 'children' || t === 'unregistered_athletes' || t === 'profiles') return t;
    if (t === 'child') return 'children';
    if (t === 'unregistered') return 'unregistered_athletes';
    return 'profiles';
}

/** ¿El error es «la función no existe todavía»? (F1 sin aplicar). */
export function esFuncionInexistente(err: { code?: string; message?: string } | null | undefined): boolean {
    if (!err) return false;
    return err.code === 'PGRST202' || err.code === '42883'
        || /could not find the function|function .* does not exist/i.test(err.message ?? '');
}

/** Ordena: duplicados primero (documento antes que nombre), luego informativos. */
function ordenar(lista: CoincidenciaAtleta[]): CoincidenciaAtleta[] {
    const peso = (c: CoincidenciaAtleta) =>
        (c.matched_by.includes('documento') ? 0 : c.matched_by.includes('nombre') ? 1 : 2);
    return [...lista].sort((a, b) => peso(a) - peso(b) || a.full_name.localeCompare(b.full_name, 'es'));
}

/**
 * Busca coincidencias en la escuela. Nunca devuelve personas de otra escuela
 * (la RPC filtra por p_school_id; la regla local también).
 *
 * `modo: 'buscador'` (solo en la regla local) agrega coincidencias por nombre
 * PARCIAL para el buscador del modal; la RPC ya resuelve el prefijo.
 */
export async function buscarCoincidencias(
    schoolId: string,
    criterios: CriteriosBusqueda,
    opts: { modo?: 'alta' | 'buscador'; limite?: number } = {},
): Promise<CoincidenciaAtleta[]> {
    const fullName = criterios.fullName?.trim() || null;
    const docNumber = criterios.docNumber?.trim() || null;
    const phone = criterios.phone?.trim() || null;
    if (!fullName && !docNumber && !phone) return [];
    const limite = opts.limite ?? 20;

    const { data, error } = await supabase.rpc('_find_athlete_duplicates', {
        p_school_id: schoolId,
        p_full_name: fullName,
        p_doc_number: docNumber,
        p_phone: phone,
    });

    if (!error) {
        const filas = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
        const out = filas.map((f): CoincidenciaAtleta => {
            const table = aTabla(f.table_name ?? f.table);
            const campos = camposDeCoincidencia(f.matched_by);
            const nombre = String(f.full_name ?? '');
            return {
                table,
                athlete_type: TIPO_POR_TABLA[table],
                id: String(f.id),
                full_name: nombre,
                doc_masked: (f.doc_masked as string | null) ?? null,
                guardian: (f.guardian as string | null) ?? null,
                matched_by: campos,
                es_duplicado: esDuplicado(campos),
                motivo: motivoDe(campos, nombre),
            };
        });
        return ordenar(out).slice(0, limite);
    }

    if (!esFuncionInexistente(error)) {
        throw new Error(`_find_athlete_duplicates: ${error.message}`);
    }
    return ordenar(await reglaLocal(schoolId, { fullName, docNumber, phone }, opts.modo ?? 'alta')).slice(0, limite);
}

/**
 * Regla local (solo mientras la RPC no exista). Mismo resultado que el viejo
 * `findExistingAthlete` para documento y nombre, más teléfono informativo.
 */
async function reglaLocal(
    schoolId: string,
    c: { fullName: string | null; docNumber: string | null; phone: string | null },
    modo: 'alta' | 'buscador',
): Promise<CoincidenciaAtleta[]> {
    const [kids, unreg] = await Promise.all([
        supabase.from('children')
            .select('id, full_name, doc_number, parent_id, parent_name_temp, parent_phone_temp')
            .eq('school_id', schoolId),
        supabase.from('unregistered_athletes')
            .select('id, full_name, doc_number, phone, guardian_phone, guardian_full_name')
            .eq('school_id', schoolId),
    ]);
    if (kids.error) throw new Error(`children: ${kids.error.message}`);
    if (unreg.error) throw new Error(`unregistered_athletes: ${unreg.error.message}`);

    const hijos = (kids.data ?? []) as Record<string, any>[];
    const fichas = (unreg.data ?? []) as Record<string, any>[];

    // Teléfono del acudiente vinculado (perfil), solo si se busca por teléfono.
    const telBuscado = normalizarTelefono(c.phone);
    const telPadre = new Map<string, string | null>();
    if (telBuscado) {
        const padres = [...new Set(hijos.map((h) => h.parent_id).filter(Boolean))] as string[];
        if (padres.length > 0) {
            const { data: perfiles } = await supabase.from('profiles').select('id, phone, full_name').in('id', padres);
            for (const p of (perfiles ?? []) as Record<string, any>[]) telPadre.set(p.id, normalizarTelefono(p.phone));
        }
    }

    const doc = c.docNumber;
    const nombre = c.fullName ? normalizarNombre(c.fullName) : null;

    const evaluar = (
        table: TablaAtleta, r: Record<string, any>, telefonos: (string | null)[], guardian: string | null,
    ): CoincidenciaAtleta | null => {
        const campos: CampoCoincidencia[] = [];
        if (doc && String(r.doc_number ?? '').trim() === doc) campos.push('documento');
        const n = normalizarNombre(String(r.full_name ?? ''));
        let parcial = false;
        if (nombre && n === nombre) campos.push('nombre');
        else if (modo === 'buscador' && nombre && nombre.length >= 2 && n.includes(nombre)) parcial = true;
        if (telBuscado && telefonos.some((t) => t && t === telBuscado)) campos.push('telefono');
        if (campos.length === 0 && !parcial) return null;
        const full = String(r.full_name ?? '');
        return {
            table,
            athlete_type: TIPO_POR_TABLA[table],
            id: String(r.id),
            full_name: full,
            doc_masked: enmascararDocumento(r.doc_number),
            guardian,
            matched_by: campos,
            es_duplicado: esDuplicado(campos),
            motivo: campos.length > 0 ? motivoDe(campos, full) : 'nombre parecido',
        };
    };

    const out: CoincidenciaAtleta[] = [];
    for (const h of hijos) {
        const m = evaluar('children', h,
            [normalizarTelefono(h.parent_phone_temp), h.parent_id ? telPadre.get(h.parent_id) ?? null : null],
            h.parent_name_temp ?? null);
        if (m) out.push(m);
    }
    for (const f of fichas) {
        const m = evaluar('unregistered_athletes', f,
            [normalizarTelefono(f.phone), normalizarTelefono(f.guardian_phone)],
            f.guardian_full_name ?? null);
        if (m) out.push(m);
    }
    return out;
}

/** Forma que espera `duplicateResponse` del alta (compatibilidad con el cliente actual). */
export interface DuplicadoParaAlta {
    table: 'children' | 'unregistered_athletes';
    id: string;
    full_name: string;
    doc_number: string | null;
    date_of_birth: string | null;
    matched_by: 'doc_number' | 'nombre';
}

/**
 * Reemplazo de `findExistingAthlete` del alta (`students-create-one.route.ts`):
 * el primer DUPLICADO (documento antes que nombre) o null. El teléfono solo no
 * bloquea el alta. Las coincidencias con adultos con cuenta (`profiles`) no se
 * devuelven aquí porque la respuesta 409 del alta solo conoce children /
 * unregistered_athletes (el alta de adulto con cuenta tiene su propio chequeo).
 */
export async function buscarDuplicadoParaAlta(
    schoolId: string,
    opts: { docNumber?: string | null; fullName?: string | null; phone?: string | null },
): Promise<DuplicadoParaAlta | null> {
    const lista = await buscarCoincidencias(schoolId, opts, { modo: 'alta' });
    const dup = lista.find((c) => c.es_duplicado && c.table !== 'profiles');
    if (!dup || dup.table === 'profiles') return null;
    return {
        table: dup.table,
        id: dup.id,
        full_name: dup.full_name,
        // El mensaje del 409 muestra el documento: va enmascarado.
        doc_number: dup.doc_masked,
        date_of_birth: null,
        matched_by: dup.matched_by.includes('documento') ? 'doc_number' : 'nombre',
    };
}
