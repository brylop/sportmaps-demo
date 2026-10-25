/**
 * Funciones puras de «Cambios de plan». Contrato: bff/src/routes/plan-changes.routes.ts.
 */

export interface CambioPlan {
    id: string;
    mode: 'sombra' | 'auto';
    applied: boolean;
    direction: 'up' | 'down' | 'same_price';
    created_at: string;
    atleta: string;
    from_plan: string | null;
    from_amount: number | null;
    to_plan: string | null;
    to_amount: number | null;
    clases_mes: number | null;
    amount_paid: number | null;
    debt_at_change: number | null;
    period_year: number | null;
    period_month: number | null;
    razon: string | null;
}

export interface ResumenCambios {
    disponible: boolean;
    up: number;
    down: number;
    same_price: number;
    total: number;
    down_con_deuda: number;
    por_modo: { sombra: number; auto: number };
    aplicados: number;
    /** Modo configurado de la escuela (null si el BFF no pudo leerlo). */
    modo_escuela?: 'apagado' | 'sombra' | 'auto' | null;
}

export interface Propuesta {
    enrollment_id: string;
    atleta: string;
    from_plan: string | null;
    to_plan: string | null;
    from_amount: number | null;
    to_amount: number | null;
    clases_mes: number | null;
    amount_paid: number | null;
    debt_at_change: number | null;
    direction: 'up' | 'down' | 'same_price';
    razon: string | null;
    period_year: number;
    period_month: number;
}

export interface ResultadoSombra {
    disponible: boolean;
    motivo_no_disponible?: string;
    dry_run: boolean;
    year: number;
    month: number;
    inscripciones_evaluadas: number;
    descartes: Record<string, number>;
    resumen: { up: number; down: number; same_price: number; down_con_deuda: number };
    escritas: number;
    ya_registradas: number;
    errores: number;
    propuestas: Propuesta[];
}

export interface FiltrosCambios {
    mode: '' | 'sombra' | 'auto';
    desde: string;
    hasta: string;
    soloConDeuda: boolean;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Query string de GET /plan-changes y /resumen (el resumen no lleva solo_con_deuda ni limit). */
export function armarQuery(f: FiltrosCambios, opts: { resumen?: boolean; limit?: number } = {}): string {
    const p = new URLSearchParams();
    if (f.mode) p.set('mode', f.mode);
    if (FECHA.test(f.desde)) p.set('desde', f.desde);
    if (FECHA.test(f.hasta)) p.set('hasta', f.hasta);
    if (!opts.resumen) {
        if (f.soloConDeuda) p.set('solo_con_deuda', 'true');
        p.set('limit', String(opts.limit ?? 500));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

export const ETIQUETA_DIRECCION: Record<CambioPlan['direction'], string> = {
    up: 'Sube',
    down: 'Baja',
    same_price: 'Mismo precio',
};

/** Razón legible: el BFF manda texto; si viene vacía o con un código tipo snake_case, se explica. */
export function razonLegible(razon: string | null | undefined, direction: CambioPlan['direction'], clases: number | null): string {
    const r = (razon ?? '').trim();
    if (r && /\s/.test(r)) return r;
    const cl = clases == null ? 'las clases del mes' : `${clases} clase${clases === 1 ? '' : 's'} en el mes`;
    if (direction === 'down') return `Tomó ${cl}: le corresponde un plan más bajo.`;
    if (direction === 'up') return `Tomó ${cl}: le corresponde un plan más alto.`;
    return `Tomó ${cl}: otro plan con el mismo precio.`;
}

export function nombreMes(year: number | null, month: number | null): string {
    if (!year || !month) return '';
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${meses[month - 1] ?? month} ${year}`;
}

export function formatoCOP(n: number | null | undefined): string {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function celdaCsv(v: unknown): string {
    const s = v == null ? '' : String(v);
    // Evita inyección de fórmulas al abrir en Excel.
    const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const CABECERA_CSV = [
    'Deportista', 'Plan actual', 'Valor actual', 'Plan propuesto', 'Valor propuesto', 'Cambio',
    'Clases del mes', 'Pagado', 'Deuda', 'Mes evaluado', 'Razón', 'Fecha', 'Modo',
];

/** CSV (con coma, comillas dobles, UTF-8 con BOM lo agrega quien descarga) de lo que está filtrado. */
export function aCsv(items: CambioPlan[]): string {
    const filas = items.map((c) => [
        c.atleta, c.from_plan, c.from_amount, c.to_plan, c.to_amount, ETIQUETA_DIRECCION[c.direction],
        c.clases_mes, c.amount_paid, c.debt_at_change, nombreMes(c.period_year, c.period_month),
        razonLegible(c.razon, c.direction, c.clases_mes), (c.created_at ?? '').slice(0, 10),
        c.mode === 'sombra' ? 'Sombra' : c.applied ? 'Aplicado' : 'Auto (sin aplicar)',
    ]);
    return [CABECERA_CSV, ...filas].map((f) => f.map(celdaCsv).join(',')).join('\r\n');
}

export function rotuloModo(
    por: ResumenCambios['por_modo'] | undefined,
    aplicados: number | undefined,
    modoEscuela?: ResumenCambios['modo_escuela'],
): {
    modo: 'sombra' | 'auto' | 'sin_datos' | 'apagado'; titulo: string; detalle: string;
} {
    // El modo configurado manda sobre lo que se deduce de los registros.
    if (modoEscuela === 'apagado') {
        return { modo: 'apagado', titulo: 'APAGADO', detalle: 'El cálculo por asistencia no está activo en esta escuela.' };
    }
    if (modoEscuela === 'sombra') {
        return { modo: 'sombra', titulo: 'SOMBRA', detalle: 'Solo registra lo que cambiaría, no toca planes.' };
    }
    if (modoEscuela === 'auto') {
        return { modo: 'auto', titulo: 'AUTO', detalle: 'El plan del deportista se cambia solo según las clases tomadas.' };
    }
    if (!por || (por.sombra === 0 && por.auto === 0)) {
        return { modo: 'sin_datos', titulo: 'SIN REGISTROS', detalle: 'Todavía no hay cambios registrados con estos filtros.' };
    }
    if ((aplicados ?? 0) > 0 || por.auto > 0) {
        return { modo: 'auto', titulo: 'AUTO', detalle: 'Hay cambios aplicados: el plan del deportista se cambió solo.' };
    }
    return { modo: 'sombra', titulo: 'SOMBRA', detalle: 'Solo registra lo que cambiaría, no toca planes.' };
}
