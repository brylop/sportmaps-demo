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
