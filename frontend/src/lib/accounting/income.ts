/**
 * Ingresos de la escuela desde la fórmula ÚNICA de la base (Contabilidad v2 F0,
 * plan §4 F2/F3). Antes el dashboard sumaba `payments` en el cliente con su
 * propia regla (`paid → amount`), sin límite superior de fecha y sin paginar,
 * y divergía del libro y de los KPIs (GYM RM: −$499.150). Ahora pregunta a
 * `finance_income_summary`, que es la misma fuente de `cash_ledger` y de
 * `school_payment_kpis` (invariante IC6).
 *
 * Regla de UI: un error o un 42501 NUNCA se muestran como $0. Quien no tiene
 * permiso (coach, staff, reporter) no ve la tarjeta; si falló la red, se
 * muestra "—".
 */

/** Resultado tipado: la pantalla decide qué pintar sin adivinar. */
export type MonthlyRevenue =
    | { kind: 'ok'; amount: number; month: string }
    | { kind: 'forbidden' }
    | { kind: 'error'; message: string };

/** Primer y último día del mes de `todayIso` (YYYY-MM-DD, ya en hora Bogotá). */
export function monthBounds(todayIso: string): { from: string; to: string; bucket: string } {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(todayIso);
    if (!m) throw new Error(`fecha inválida: ${todayIso}`);
    const year = Number(m[1]);
    const month = Number(m[2]);
    // Día 0 del mes siguiente = último día de este mes (UTC: sin husos).
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const bucket = `${m[1]}-${m[2]}`;
    return { from: `${bucket}-01`, to: `${bucket}-${String(last).padStart(2, '0')}`, bucket };
}

/**
 * Roles de perfil que piden "Ingresos del mes". El coach NO: la base le
 * devuelve 42501 (C4) y no tiene por qué hacer la llamada.
 */
export function roleRequestsSchoolRevenue(role: string | null | undefined): boolean {
    return role === 'school' || role === 'school_admin' || role === 'admin'
        || role === 'super_admin' || role === 'accountant';
}

/** ¿El error de PostgREST/Postgres es "sin permiso"? */
export function isForbiddenError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (!err) return false;
    return err.code === '42501' || /FINANCE_FORBIDDEN/.test(err.message ?? '');
}

interface RpcClient {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: any }>;
}

/**
 * Ingreso cobrado del mes en curso (Bogotá) para la escuela, con la regla de
 * sede de la base (la sede incluye los cobros SIN sede). Suma solo el bucket
 * del mes: los cobros sin fecha (bucket 'sin_fecha') no son "de este mes".
 */
export async function fetchMonthlyRevenue(
    client: RpcClient,
    opts: { schoolId: string; branchId?: string | null; todayIso: string },
): Promise<MonthlyRevenue> {
    const { from, to, bucket } = monthBounds(opts.todayIso);
    const { data, error } = await client.rpc('finance_income_summary', {
        p_owner_type: 'school',
        p_owner_id: opts.schoolId,
        p_from: from,
        p_to: to,
        p_branch_id: opts.branchId || null,
        p_group: 'month',
    });
    if (error) {
        if (isForbiddenError(error)) return { kind: 'forbidden' };
        return { kind: 'error', message: error.message ?? String(error) };
    }
    const rows = Array.isArray(data) ? (data as Array<{ bucket: string; income_amount: number | string }>) : [];
    const amount = rows
        .filter((r) => r.bucket === bucket)
        .reduce((s, r) => s + Number(r.income_amount ?? 0), 0);
    return { kind: 'ok', amount, month: bucket };
}

// ─── Tienda escolar en los ingresos (migración 20261013170548) ──────────────
// La tienda NO escribe en payments ni en cash_ledger (contrato de contabilidad
// v2 §6): sus ventas se leen aparte (store_income_*), con el MISMO permiso que
// la fórmula única, y la pantalla las suma al lado de las mensualidades.

/** Ingreso de tienda de un rango. `hasStore: false` = la pantalla queda igual que antes. */
export type StoreIncome =
    | { kind: 'ok'; hasStore: boolean; total: number; buckets: Record<string, number> }
    | { kind: 'forbidden' }
    | { kind: 'error'; message: string };

/** La RPC no existe todavía (migración sin aplicar): se trata como "sin tienda". */
export function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (!err) return false;
    return err.code === 'PGRST202' || err.code === '42883'
        || /Could not find the function|does not exist/i.test(err.message ?? '');
}

/**
 * Ventas cobradas de la tienda de la escuela (neto de reembolsos, fecha =
 * paid_at Bogotá, sede con la regla de la base) agrupadas por `group`.
 * Primero pregunta si la escuela tiene tienda: sin tienda no hay segunda llamada.
 */
export async function fetchStoreIncome(
    client: RpcClient,
    opts: { schoolId: string; branchId?: string | null; from: string; to: string; group?: 'month' | 'day' },
): Promise<StoreIncome> {
    const has = await client.rpc('store_income_has_store', { p_school_id: opts.schoolId });
    if (has.error) {
        if (isMissingRpcError(has.error)) return { kind: 'ok', hasStore: false, total: 0, buckets: {} };
        if (isForbiddenError(has.error)) return { kind: 'forbidden' };
        return { kind: 'error', message: has.error.message ?? String(has.error) };
    }
    if (has.data !== true) return { kind: 'ok', hasStore: false, total: 0, buckets: {} };

    const { data, error } = await client.rpc('store_income_summary', {
        p_school_id: opts.schoolId,
        p_from: opts.from,
        p_to: opts.to,
        p_branch_id: opts.branchId || null,
        p_group: opts.group ?? 'month',
    });
    if (error) {
        if (isForbiddenError(error)) return { kind: 'forbidden' };
        return { kind: 'error', message: error.message ?? String(error) };
    }
    const buckets: Record<string, number> = {};
    let total = 0;
    for (const r of (Array.isArray(data) ? data : []) as Array<{ bucket: string; income_amount: number | string }>) {
        const amt = Number(r.income_amount ?? 0);
        buckets[r.bucket] = (buckets[r.bucket] ?? 0) + amt;
        total += amt;
    }
    return { kind: 'ok', hasStore: true, total, buckets };
}

/** Desglose del indicador de ingresos. `tienda: null` = no se pudo leer la tienda ("—"). */
export interface RevenueBreakdown {
    mensualidades: number;
    tienda: number | null;
}

export interface CombinedRevenue {
    state: 'ok' | 'forbidden' | 'error';
    /** Total mostrado. null = no disponible (nunca un 0 inventado). */
    amount: number | null;
    /** null = la escuela no tiene tienda: el indicador queda igual que antes. */
    breakdown: RevenueBreakdown | null;
}

/**
 * Junta mensualidades (fórmula única) y tienda para un indicador. Reglas:
 *   · sin permiso / error en mensualidades → igual que antes (oculto / "—").
 *   · sin tienda (o la RPC aún no existe) → solo mensualidades, sin desglose.
 *   · con tienda → total = mensualidades + tienda, con desglose.
 *   · la tienda falló → se muestran las mensualidades con "Tienda —": el
 *     total no se presenta como completo ni la tienda como $0.
 */
export function combineRevenue(payments: MonthlyRevenue, store: StoreIncome, bucket?: string): CombinedRevenue {
    if (payments.kind === 'forbidden') return { state: 'forbidden', amount: null, breakdown: null };
    if (payments.kind === 'error') return { state: 'error', amount: null, breakdown: null };
    if (store.kind === 'forbidden' || (store.kind === 'ok' && !store.hasStore)) {
        return { state: 'ok', amount: payments.amount, breakdown: null };
    }
    if (store.kind === 'error') {
        return { state: 'ok', amount: payments.amount, breakdown: { mensualidades: payments.amount, tienda: null } };
    }
    const tienda = bucket ? (store.buckets[bucket] ?? 0) : store.total;
    return {
        state: 'ok',
        amount: payments.amount + tienda,
        breakdown: { mensualidades: payments.amount, tienda },
    };
}

/** Línea de venta de tienda (store_income_lines). */
export interface StoreIncomeLine {
    order_id: string;
    paid_date: string;
    reference: string | null;
    status: string;
    payment_method: string | null;
    gross_amount: number | string;
    refunded_amount: number | string;
    income_amount: number | string;
}

/** Todas las ventas de tienda del rango (para exportar). Sin tienda → []. */
export async function fetchStoreIncomeLines(
    client: RpcClient,
    opts: { schoolId: string; branchId?: string | null; from: string; to: string },
): Promise<StoreIncomeLine[]> {
    const { data, error } = await client.rpc('store_income_lines', {
        p_school_id: opts.schoolId,
        p_from: opts.from,
        p_to: opts.to,
        p_branch_id: opts.branchId || null,
    });
    if (error) {
        if (isMissingRpcError(error)) return [];
        throw error;
    }
    return (Array.isArray(data) ? data : []) as StoreIncomeLine[];
}
