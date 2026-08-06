import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { todayInZone, addDaysToDateString } from '../utils/businessDate';

const router = Router();

/** Tamaño de página de PostgREST (`max-rows`). No se puede pedir más en una sola vuelta. */
const PG_PAGE = 1000;

/**
 * Trae TODAS las filas de una consulta, paginando con `.range()`.
 *
 * PostgREST corta en 1000 filas aunque no se pida `limit`, y lo hace en
 * silencio: un reporte de ingresos sobre una escuela con más de 1000 cobros
 * devolvía un total incompleto sin ninguna señal. Un reporte que miente por
 * debajo es peor que uno que falla.
 */
async function fetchAllRows<T>(build: () => any): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PG_PAGE) {
        const { data, error } = await build().range(from, from + PG_PAGE - 1);
        if (error) throw error;
        const page = (data || []) as T[];
        out.push(...page);
        if (page.length < PG_PAGE) return out;
    }
}

/**
 * Suma de dinero realmente recibido. `paid` cuenta por el total del cobro y
 * `partial` solo por lo abonado — sumar `amount` de un abono infla el ingreso.
 */
const receivedAmount = (p: { status?: string | null; amount?: unknown; amount_paid?: unknown }): number =>
    Number(p.status === 'partial' ? (p.amount_paid ?? 0) : p.amount) || 0;

// Middleware helper to determine which branch_id to filter by.
const getBranchFilter = (req: AuthenticatedRequest): string | null => {
    if (req.role === 'school_admin') return req.branchId;
    const queryBranchId = req.query.branch_id as string;
    if (queryBranchId && queryBranchId !== 'undefined' && queryBranchId !== 'null') {
        return queryBranchId;
    }
    return null;
};

// ── GET /api/v1/reports/school/summary ───────────────────────────────────────
router.get(
    '/school/summary',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'auditor', 'reporter', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { schoolId } = req;
            const branchFilterId = getBranchFilter(req);

            // 1. Obtener equipos (Teams) para capacidad total y lista de IDs
            let teamsQuery = supabase
                .from('teams')
                .select('id, name, max_students')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (branchFilterId) teamsQuery = teamsQuery.eq('branch_id', branchFilterId);

            const { data: allTeams, error: teamsError } = await teamsQuery;
            if (teamsError) throw teamsError;

            const teams = allTeams || [];
            let realTotalCapacity = 0;
            const teamCapacityMap = new Map<string, number>();
            const teamIdToName = new Map<string, string>();

            allTeams?.forEach(t => {
                const cap = t.max_students || 0; // Changed from max_capacity to max_students to match select
                if (cap > 0) {
                    // Agrupar por nombre (ej. "Pre-infantil") ignorando la sede
                    teamCapacityMap.set(t.name, (teamCapacityMap.get(t.name) || 0) + cap);
                    realTotalCapacity += cap; // Added this line to correctly calculate total capacity
                }
                teamIdToName.set(t.id, t.name);
            });

            // 2. Obtener inscripciones (Enrollments) — SIN join a teams para evitar PGRST201.
            //    La relación ambigua ocurre porque enrollments tiene múltiples FK a teams.
            //    Solución: filtrar por los team_ids ya obtenidos en el paso anterior.
            const teamIds = teams.map((t: any) => t.id);

            const allEnrollmentsSet = new Set<string>(); // para deportistas únicos 

            const teamOccupiedMap = new Map<string, number>();
            let totalStudents = 0;
            const growthMap = new Map<string, { nuevos: number; retiros: number; sortKey: number }>();
            const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const now = new Date();
            const currentMonthIndex = now.getMonth();
            const currentYear = now.getFullYear();
            let netGrowthThisMonth = 0;

            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const mKey = MONTHS[d.getMonth()];
                growthMap.set(mKey, { nuevos: 0, retiros: 0, sortKey: d.getTime() });
            }

            if (teamIds.length > 0) {
                // Usamos `team_id` directamente — columna plana, sin join, sin ambigüedad
                const { data: enrollmentsData, error: enrollError } = await supabase
                    .from('enrollments')
                    .select('status, created_at, team_id')
                    .in('team_id', teamIds);

                if (enrollError) throw enrollError;

                (enrollmentsData || []).forEach((e: any) => {
                    const teamName = teamIdToName.get(e.team_id) || 'Varios';
                    const d = new Date(e.created_at);
                    const mKey = MONTHS[d.getMonth()];

                    if (e.status === 'active') {
                        if (teamName) {
                            teamOccupiedMap.set(teamName, (teamOccupiedMap.get(teamName) || 0) + 1);
                        }
                        totalStudents++;
                        if (d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear) {
                            netGrowthThisMonth++;
                        }
                        if (growthMap.has(mKey)) growthMap.get(mKey)!.nuevos++;
                    } else if (e.status === 'inactive' || e.status === 'dropped') {
                        if (growthMap.has(mKey)) growthMap.get(mKey)!.retiros++;
                    }
                });
            }

            // 4) Combinar Mapas: Capacidad vs Ocupación
            const occupancyData = Array.from(teamCapacityMap.entries()).map(([name, capacity]) => ({
                name,
                occupied: teamOccupiedMap.get(name) || 0,
                vacant: Math.max(0, capacity - (teamOccupiedMap.get(name) || 0)),
                total_capacity: capacity
            })).slice(0, 10);

            const growthDataList = Array.from(growthMap.entries())
                .sort((a, b) => a[1].sortKey - b[1].sortKey)
                .map(([month, data]) => ({ month, nuevos: data.nuevos, retiros: data.retiros }));

            // 3. Obtener Pagos confirmados (histórico completo, paginado)
            //    `partial` entra por lo abonado: un abono también es plata que entró.
            //    Si esta consulta falla, el endpoint falla: devolver el reporte con
            //    `totalRevenue: 0` se lee como "no hubo ingresos". El frontend ya
            //    tiene su propio fallback contra Supabase para este caso.
            const payments: any[] = await fetchAllRows<any>(() => {
                let q = supabase
                    .from('payments')
                    .select('amount, amount_paid, status, concept')
                    .eq('school_id', schoolId)
                    .in('status', ['paid', 'partial'])
                    // `id` fija el orden: sin él, dos páginas del mismo `.range()`
                    // pueden repetir o saltarse filas.
                    .order('id', { ascending: true });
                // Un cobro con `branch_id` NULL es un cobro SIN sede asignada, no uno
                // de otra sede: con `.eq()` se caían 44 de los 89 pagos de agosto de
                // Dynasty y el reporte de ingresos salía a la mitad.
                if (branchFilterId) q = q.or(`branch_id.is.null,branch_id.eq.${branchFilterId}`);
                return q;
            });

            let revenueSum = 0;
            const revenueByConcept = new Map<string, number>();

            (payments || []).forEach((p: any) => {
                const amt = receivedAmount(p);
                revenueSum += amt;
                const conceptShort = p.concept?.split('-')[0]?.trim() || 'General';
                revenueByConcept.set(conceptShort, (revenueByConcept.get(conceptShort) || 0) + amt);
            });

            const revenueData = Array.from(revenueByConcept.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            return res.json({
                summary: {
                    occupancyRate: realTotalCapacity > 0
                        ? ((totalStudents / realTotalCapacity) * 100).toFixed(1)
                        : '0',
                    totalStudents,
                    totalCapacity: realTotalCapacity,
                    totalRevenue: revenueSum,
                    netGrowth: netGrowthThisMonth,
                },
                charts: { occupancyData, growthData: growthDataList, revenueData },
            });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte general de escuela');
            return res.status(500).json({ error: 'Error interno obteniendo reportes.' });
        }
    }
);

// ── GET /api/v1/reports/reporter/dashboard ────────────────────────────────────
router.get(
    '/reporter/dashboard',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'auditor', 'reporter', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { schoolId } = req;
            const branchFilterId = getBranchFilter(req);
            const days = parseInt(req.query.days as string) || 30;

            // Ventana en hora Colombia. `toISOString()` sobre el reloj de Render
            // (UTC) corría el inicio de la ventana un día después de las 7 p.m.
            const since = addDaysToDateString(todayInZone(), -days);

            // ── 1. Deportistas y su cuota ────────────────────────────────────────
            // El KPI "Ingreso Potencial Mes" se arma sumando la cuota de esta lista, así
            // que la cuota TIENE que resolverse por la misma cadena que genera los
            // cobros. Antes salía de `children.monthly_fee || teams.price_monthly`, que
            // se salta los DOS primeros eslabones de esa cadena. Medido el 2026-08-06:
            // el KPI mostraba $10.390.000 contra $66.250.000 reales — 435 atletas y una
            // brecha de $55.860.000, o sea el 16% de lo que debía mostrar.
            //
            // Cadena canónica, la de open_month (mig 20260803114540):
            //   COALESCE(NULLIF(e.monthly_fee,0), NULLIF(op.price,0),
            //            NULLIF(t.price_monthly,0), NULLIF(c.monthly_fee,0), 0)
            //
            // El NULLIF no es decorativo: un 0 no es un precio, es un "sin definir" que
            // cae al siguiente eslabón. Por eso acá se busca el primer valor DISTINTO DE
            // CERO y no el primero no nulo.
            //
            // Y el eje pasa a ser la INSCRIPCIÓN ACTIVA, no `children`: los atletas
            // adultos (`user_id`) y los no registrados (`unregistered_athlete_id`)
            // también pagan, y para este KPI sencillamente no existían.
            const { data: enrollmentsRaw, error: enrollmentsErr } = await supabase
                .from('enrollments')
                .select('id, child_id, user_id, unregistered_athlete_id, team_id, offering_plan_id, monthly_fee, created_at')
                .eq('school_id', schoolId)
                .eq('status', 'active');
            if (enrollmentsErr) throw enrollmentsErr;

            // Un atleta puede tener varias inscripciones activas, pero open_month le
            // genera UN solo cobro, eligiendo con este desempate: el plan gobierna,
            // luego el equipo, y a igualdad la más antigua (la que carga el historial).
            // Se replica igual, o el potencial contaría dos veces a la misma persona.
            const enrollmentRank = (e: any): [number, number, string] => [
                e.offering_plan_id ? 0 : 1,
                e.team_id ? 0 : 1,
                String(e.created_at ?? ''),
            ];
            const enrollmentByAthlete = new Map<string, any>();
            for (const e of (enrollmentsRaw || [])) {
                const athleteId = e.child_id || e.user_id || e.unregistered_athlete_id;
                if (!athleteId) continue;
                const prev = enrollmentByAthlete.get(athleteId);
                if (!prev) { enrollmentByAthlete.set(athleteId, e); continue; }
                const [ap, at, ac] = enrollmentRank(e);
                const [bp, bt, bc] = enrollmentRank(prev);
                if (ap < bp || (ap === bp && (at < bt || (at === bt && ac < bc)))) {
                    enrollmentByAthlete.set(athleteId, e);
                }
            }
            const chosenEnrollments = [...enrollmentByAthlete.values()];

            const uniqIds = (xs: any[]): string[] => [...new Set(xs.filter(Boolean))] as string[];
            const athChildIds = uniqIds(chosenEnrollments.map((e: any) => e.child_id));
            const athUserIds  = uniqIds(chosenEnrollments.map((e: any) => e.user_id));
            const athUaIds    = uniqIds(chosenEnrollments.map((e: any) => e.unregistered_athlete_id));
            const athTeamIds  = uniqIds(chosenEnrollments.map((e: any) => e.team_id));
            const athPlanIds  = uniqIds(chosenEnrollments.map((e: any) => e.offering_plan_id));

            const emptyRows = Promise.resolve({ data: [] as any[] });
            const [childRes, athProfileRes, uaRes, teamRes, planRes] = await Promise.all([
                athChildIds.length ? supabase.from('children').select('id, full_name, branch_id, monthly_fee, created_at').in('id', athChildIds) : emptyRows,
                athUserIds.length  ? supabase.from('profiles').select('id, full_name').in('id', athUserIds) : emptyRows,
                athUaIds.length    ? supabase.from('unregistered_athletes').select('id, full_name, created_at').in('id', athUaIds) : emptyRows,
                // La cuota del equipo es `price_monthly`; `monthly_fee` NO existe en
                // teams (sí en children/enrollments) y pedirla hacía fallar el select
                // completo → 500 en todo el dashboard.
                athTeamIds.length  ? supabase.from('teams').select('id, name, price_monthly, branch_id').in('id', athTeamIds) : emptyRows,
                athPlanIds.length  ? supabase.from('offering_plans').select('id, price').in('id', athPlanIds) : emptyRows,
            ]);

            const childMap       = new Map((childRes.data || []).map((c: any) => [c.id, c]));
            const athProfileMap  = new Map((athProfileRes.data || []).map((p: any) => [p.id, p]));
            const uaMap          = new Map((uaRes.data || []).map((u: any) => [u.id, u]));
            const teamMap        = new Map((teamRes.data || []).map((t: any) => [t.id, t]));
            const planMap        = new Map((planRes.data || []).map((p: any) => [p.id, p]));

            const teamNameMap = new Map<string, string>();
            (teamRes.data || []).forEach((t: any) => teamNameMap.set(t.id, t.name));

            // La sede sale de `COALESCE(children.branch_id, teams.branch_id)`, igual que
            // en open_month. Un adulto sin equipo no tiene sede: cae en 'Principal'.
            const branchOf = (e: any): string | null =>
                (childMap.get(e.child_id) as any)?.branch_id
                || (teamMap.get(e.team_id) as any)?.branch_id
                || null;

            const branchIds = uniqIds(chosenEnrollments.map(branchOf));
            const branchNameMap = new Map<string, string>();
            if (branchIds.length > 0) {
                const { data: branchRows } = await supabase
                    .from('school_branches')
                    .select('id, name')
                    .in('id', branchIds);
                (branchRows || []).forEach((b: any) => branchNameMap.set(b.id, b.name));
            }

            // Primer valor distinto de cero: el equivalente en JS del NULLIF(x, 0) de la
            // cadena canónica. `Number(null)` es 0 y `Number(undefined)` es NaN, así que
            // el saneo tiene que ser explícito.
            const firstNonZero = (...vals: any[]): number => {
                for (const v of vals) {
                    const n = Number(v);
                    if (Number.isFinite(n) && n !== 0) return n;
                }
                return 0;
            };

            const athleteRows = chosenEnrollments.map((e: any) => {
                const child = childMap.get(e.child_id) as any;
                const team  = teamMap.get(e.team_id) as any;
                const plan  = planMap.get(e.offering_plan_id) as any;
                const branchId = branchOf(e);
                return {
                    id: e.child_id || e.user_id || e.unregistered_athlete_id,
                    full_name: child?.full_name
                        || (athProfileMap.get(e.user_id) as any)?.full_name
                        || (uaMap.get(e.unregistered_athlete_id) as any)?.full_name
                        || 'Sin nombre',
                    team: teamNameMap.get(e.team_id) || '—',
                    sede: (branchId && branchNameMap.get(branchId)) || 'Principal',
                    status: 'active',
                    fee: firstNonZero(e.monthly_fee, plan?.price, team?.price_monthly, child?.monthly_fee),
                    joined: child?.created_at || (uaMap.get(e.unregistered_athlete_id) as any)?.created_at || e.created_at,
                    branchId,
                };
            });

            const athletesInScope = branchFilterId
                ? athleteRows.filter(r => r.branchId === branchFilterId)
                : athleteRows;

            // El potencial se calcula sobre TODOS los atletas del alcance y viaja aparte.
            // La lista va capada a 500 filas, y cuando el front sumaba la lista el KPI
            // quedaba corto en silencio para cualquier escuela con más de 500 atletas.
            const revenuePotential = athletesInScope.reduce((sum, r) => sum + r.fee, 0);

            const students = athletesInScope
                .slice()
                .sort((a, b) => String(b.joined ?? '').localeCompare(String(a.joined ?? '')))
                .slice(0, 500)
                .map(({ branchId, ...rest }) => rest);

            // 2. Payments
            // `payments` no tiene `payment_month` ni `student_id`: el periodo vive
            // en period_year/period_month y el sujeto del cobro es child_id (menor),
            // user_id/parent_id (adulto) o unregistered_athlete_id. Pedir las
            // columnas viejas hacía fallar el select y devolvía 500 en todo el
            // dashboard del auditor.
            let paymentsQuery = supabase
                .from('payments')
                .select('id, amount, amount_paid, status, concept, due_date, payment_date, period_year, period_month, created_at, child_id, user_id, parent_id, unregistered_athlete_id, branch_id')
                .eq('school_id', schoolId)
                // La ventana mira las DOS fechas. Con solo `created_at` se caía del
                // reporte un pago cobrado dentro del período cuyo cobro se había
                // emitido antes — que es el caso normal de una mensualidad (48 de
                // los 89 pagos de agosto de Dynasty).
                .or(`created_at.gte.${since},payment_date.gte.${since}`)
                .order('created_at', { ascending: false })
                .limit(PG_PAGE);

            // branch_id NULL = sin sede asignada, no "de otra sede". Ver el reporte
            // general más arriba.
            if (branchFilterId) paymentsQuery = paymentsQuery.or(`branch_id.is.null,branch_id.eq.${branchFilterId}`);

            const { data: paymentsRaw, error: paymentsErr } = await paymentsQuery;
            if (paymentsErr) throw paymentsErr;

            // Nombre del deportista según las TRES identidades posibles del cobro.
            const nameMap = new Map<string, string>();
            const collect = async (table: string, ids: string[]) => {
                if (!ids.length) return;
                const { data } = await supabase.from(table).select('id, full_name').in('id', ids);
                (data || []).forEach((r: any) => nameMap.set(r.id, r.full_name));
            };
            const uniq = (key: string) =>
                [...new Set((paymentsRaw || []).map((p: any) => p[key]).filter(Boolean))] as string[];
            await Promise.all([
                collect('children', uniq('child_id')),
                collect('unregistered_athletes', uniq('unregistered_athlete_id')),
                collect('profiles', [...new Set([...uniq('user_id'), ...uniq('parent_id')])]),
            ]);

            const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const periodo = (p: any) => {
                if (p.period_year && p.period_month) return `${MESES[p.period_month - 1]} ${p.period_year}`;
                const ref = p.due_date || p.created_at;
                if (!ref) return '—';
                const d = new Date(ref);
                return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
            };

            const payments = (paymentsRaw || []).map((p: any) => ({
                id: p.id,
                student: nameMap.get(p.child_id)
                    || nameMap.get(p.unregistered_athlete_id)
                    || nameMap.get(p.user_id)
                    || nameMap.get(p.parent_id)
                    || 'Desconocido',
                amount: Number(p.amount) || 0,
                status: p.status || 'pending',
                month: periodo(p),
                team: p.concept || '—',
            }));

            // 3. Coaches — sin join ambiguo
            let coachesQuery = supabase
                .from('school_members')
                .select('id, role, profile_id, branch_id')
                .eq('school_id', schoolId)
                .in('role', ['coach', 'staff']);

            if (branchFilterId) coachesQuery = coachesQuery.eq('branch_id', branchFilterId);

            const { data: coachesRaw, error: coachesErr } = await coachesQuery;
            if (coachesErr) throw coachesErr;

            const coachProfileIds = (coachesRaw || []).map((c: any) => c.profile_id).filter(Boolean);
            const profileMap = new Map<string, { full_name: string; email: string }>();
            if (coachProfileIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', coachProfileIds);
                (profiles || []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
            }

            const coaches = (coachesRaw || []).map((m: any) => ({
                id: m.id,
                name: profileMap.get(m.profile_id)?.full_name || 'Sin nombre',
                email: profileMap.get(m.profile_id)?.email || '—',
                team: '—',
                sede: branchNameMap.get(m.branch_id) || 'Principal',
                students: 0,
            }));

            // 4. Sedes
            let sedesQuery = supabase
                .from('school_branches')
                .select('id, name')
                .eq('school_id', schoolId);

            if (branchFilterId) sedesQuery = sedesQuery.eq('id', branchFilterId);

            const { data: sedesData, error: sedesErr } = await sedesQuery;
            if (sedesErr) throw sedesErr;

            const sedes = await Promise.all(
                (sedesData || []).map(async (sede: any) => {
                    // OJO: acá el `.eq('branch_id')` SÍ corresponde — es el desglose
                    // POR sede. La consecuencia es que los cobros sin sede asignada
                    // (44 de los 89 de agosto en Dynasty) no entran en ninguna fila,
                    // así que la suma de las sedes es menor que el ingreso total.
                    const [studRes, coachRes, pagos] = await Promise.all([
                        supabase.from('children').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id),
                        supabase.from('school_members').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id).in('role', ['coach', 'staff']),
                        fetchAllRows<any>(() => supabase
                            .from('payments')
                            .select('amount, amount_paid, status')
                            .eq('branch_id', sede.id)
                            .in('status', ['paid', 'partial'])
                            .order('id', { ascending: true })),
                    ]);
                    const income = pagos.reduce((s: number, p: any) => s + receivedAmount(p), 0);
                    return { id: sede.id, name: sede.name, students: studRes.count || 0, coaches: coachRes.count || 0, income };
                })
            );

            // 5. Teams
            let teamsQuery = supabase
                .from('teams')
                .select('id, name, price_monthly, description')   // monthly_fee no existe en teams
                .eq('school_id', schoolId)
                // La sección del panel se llama "Equipos Activos": un equipo dado
                // de baja no debe contarse ni listarse ahí.
                .eq('active', true);

            if (branchFilterId) teamsQuery = teamsQuery.eq('branch_id', branchFilterId);

            const { data: teamsData, error: teamsErr } = await teamsQuery;
            if (teamsErr) throw teamsErr;

            const teams = await Promise.all(
                (teamsData || []).map(async (p: any) => {
                    const { count } = await supabase
                        .from('children')
                        .select('id', { count: 'exact', head: true })
                        .eq('team_id', p.id);
                    const fee = Number(p.price_monthly) || 0;
                    return {
                        id: p.id,
                        name: p.name,
                        students: count || 0,
                        monthly_fee: fee,
                        revenue: (count || 0) * fee,
                    };
                })
            );

            // `revenue_potential` y `athletes_active` van aparte de `students` a
            // propósito: la lista está capada a 500 filas y ningún KPI puede depender
            // de cuántas quepan.
            return res.json({
                students,
                payments,
                coaches,
                sedes,
                teams,
                revenue_potential: revenuePotential,
                athletes_active: athletesInScope.length,
            });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte de dashboard');
            return res.status(500).json({ error: 'Error interno obteniendo el dashboard.' });
        }
    }
);

// ── GET /api/v1/reports/coach/:teamId ─────────────────────────────────────────
router.get(
    '/coach/:teamId',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'auditor', 'reporter', 'coach', 'staff', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { teamId } = req.params;
            const { schoolId } = req;

            const { data: team, error: teamErr } = await supabase
                .from('teams')
                .select('id, name, age_group, sport, coach_id, school_id')
                .eq('id', teamId)
                .single();

            if (teamErr || !team) return res.status(404).json({ error: 'Equipo no encontrado.' });

            if (req.role === 'school_admin' && team.school_id !== schoolId) {
                return res.status(403).json({ error: 'No tienes permiso para ver este equipo.' });
            }

            // Roster
            const { data: roster, error: rosterErr } = await supabase
                .from('team_members')
                .select('id, player_name, player_number, position, profile_id')
                .eq('team_id', teamId);

            if (rosterErr) throw rosterErr;

            // Match results — el deporte decide si usa sets (jsonb) o marcador plano (match_results)
            let usesSets = false;
            if (team.sport) {
                const { data: sportCat } = await supabase
                    .from('sports_categories')
                    .select('uses_sets_scoring')
                    .ilike('name', team.sport)
                    .maybeSingle();
                usesSets = sportCat?.uses_sets_scoring ?? false;
            }
            let results: any[] = [];

            if (usesSets) {
                const { data: compResults, error: resultsErr } = await supabase
                    .from('competition_results')
                    .select('id, competition_date, result_type, result_data, opponent, notes')
                    .eq('team_id', teamId)
                    .order('competition_date', { ascending: false });

                if (resultsErr) throw resultsErr;

                results = (compResults || []).map((r: any) => {
                    const rData = r.result_data || {};
                    const sets = rData.sets || [];
                    const setsWonTeam = rData.sets_won_team || 0;
                    const setsWonOpponent = rData.sets_won_opponent || 0;

                    const setsStr = sets
                        .map((s: any) => `${s.team_score}-${s.opponent_score}`)
                        .join(', ');
                    const score = sets.length > 0
                        ? `${setsWonTeam} - ${setsWonOpponent} (${setsStr})`
                        : null;

                    return {
                        id: r.id,
                        match_date: r.competition_date,
                        opponent: r.opponent,
                        result: rData.match_result || 'unknown',
                        score,
                        match_type: r.result_type === 'competencia_oficial' ? 'Competencia' : 'Amistoso',
                        notes: r.notes
                    };
                });
            } else {
                const { data: matchResults, error: resultsErr } = await supabase
                    .from('match_results')
                    .select('*')
                    .eq('team_id', teamId)
                    .order('match_date', { ascending: false });

                if (resultsErr) throw resultsErr;
                results = matchResults || [];
            }

            // Attendance
            const { data: attendance, error: attendanceErr } = await supabase
                .from('attendance_records')
                .select('status, child_id')
                .eq('team_id', teamId);

            if (attendanceErr) throw attendanceErr;

            const attendanceByPlayer: Record<string, { present: number; total: number }> = {};
            (attendance || []).forEach((record: any) => {
                if (!attendanceByPlayer[record.child_id]) {
                    attendanceByPlayer[record.child_id] = { present: 0, total: 0 };
                }
                attendanceByPlayer[record.child_id].total++;
                if (record.status === 'present' || record.status === 'late') {
                    attendanceByPlayer[record.child_id].present++;
                }
            });

            // Obtener child_ids únicos desde los registros de asistencia
            const childIds = [...new Set((attendance || []).map((r: any) => r.child_id).filter(Boolean))];

            let children: any[] = [];
            if (childIds.length > 0) {
                const { data: childrenData } = await supabase
                    .from('children')
                    .select('id, full_name')
                    .in('id', childIds);
                children = childrenData || [];
            }

            const attendanceReport = (children || []).map((child: any) => {
                const stat = attendanceByPlayer[child.id];
                return {
                    name: child.full_name,
                    percentage: stat && stat.total > 0
                        ? Math.round((stat.present / stat.total) * 100)
                        : 0,
                };
            }).sort((a: any, b: any) => b.percentage - a.percentage);

            const playedResults = usesSets
                ? results.filter((r: any) => r.result !== 'unknown')
                : results;

            return res.json({
                team: { id: team.id, name: team.name, age_group: team.age_group, sport: team.sport },
                roster: roster || [],
                results: results || [],
                results_played_count: playedResults.length,
                attendance: attendanceReport,
                scorers: [],
            });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte de coach');
            return res.status(500).json({ error: 'Error interno obteniendo reporte del equipo.' });
        }
    }
);

// ── GET /api/v1/reports/school/documents ─────────────────────────────────────
// Returns students + their identity document paths, filterable by team or plan.
router.get(
    '/school/documents',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'auditor', 'reporter', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { schoolId } = req;
            const branchFilterId = getBranchFilter(req);
            const teamId = req.query.team_id as string | undefined;
            const planId = req.query.offering_plan_id as string | undefined;

            // 1. Fetch children with document URL
            let childrenQuery = supabase
                .from('children')
                // NOTA: children NO tiene columna `status` en la BD; el default
                // se resuelve abajo con `child.status || 'active'`.
                .select('id, full_name, team_id, branch_id, id_document_url')
                .eq('school_id', schoolId)
                .order('full_name');

            if (branchFilterId) childrenQuery = childrenQuery.eq('branch_id', branchFilterId);
            if (teamId) childrenQuery = childrenQuery.eq('team_id', teamId);

            const { data: childrenRaw, error: childrenErr } = await childrenQuery;
            if (childrenErr) throw childrenErr;

            let childIds = (childrenRaw || []).map((c: any) => c.id);

            // 2. If filtering by plan, narrow down to children enrolled in that plan
            if (planId && childIds.length > 0) {
                const { data: enrollments, error: enrollErr } = await supabase
                    .from('enrollments')
                    .select('child_id')
                    .eq('offering_plan_id', planId)
                    .in('child_id', childIds);

                if (enrollErr) throw enrollErr;

                const enrolledChildIds = new Set((enrollments || []).map((e: any) => e.child_id));
                childIds = childIds.filter((id: string) => enrolledChildIds.has(id));
            }

            // 3. Resolve team names
            const teamIds = [...new Set((childrenRaw || []).map((c: any) => c.team_id).filter(Boolean))];
            const teamNameMap = new Map<string, string>();
            if (teamIds.length > 0) {
                const { data: teamRows } = await supabase
                    .from('teams')
                    .select('id, name')
                    .in('id', teamIds);
                (teamRows || []).forEach((t: any) => teamNameMap.set(t.id, t.name));
            }

            // 4. Resolve plan names for each child via enrollments
            const childPlanMap = new Map<string, string>();
            if (childIds.length > 0) {
                const { data: allEnrollments } = await supabase
                    .from('enrollments')
                    .select('child_id, offering_plan_id')
                    .in('child_id', childIds)
                    .eq('status', 'active');

                const planIds = [...new Set((allEnrollments || []).map((e: any) => e.offering_plan_id).filter(Boolean))];
                if (planIds.length > 0) {
                    const { data: planRows } = await supabase
                        .from('offering_plans')
                        .select('id, name')
                        .in('id', planIds);
                    const planNameMap = new Map<string, string>();
                    (planRows || []).forEach((p: any) => planNameMap.set(p.id, p.name));
                    (allEnrollments || []).forEach((e: any) => {
                        if (e.offering_plan_id && planNameMap.has(e.offering_plan_id)) {
                            childPlanMap.set(e.child_id, planNameMap.get(e.offering_plan_id)!);
                        }
                    });
                }
            }

            // 5. For each child with documents, list files from storage
            const childIdSet = new Set(childIds);
            const students = await Promise.all(
                (childrenRaw || [])
                    .filter((c: any) => childIdSet.has(c.id))
                    .map(async (child: any) => {
                        const documents: { name: string; path: string }[] = [];

                        // Try listing files from storage bucket
                        const folderPath = `children/${child.id}/docs`;
                        const { data: files } = await supabase.storage
                            .from('identity-documents')
                            .list(folderPath, { limit: 20 });

                        if (files && files.length > 0) {
                            files.forEach((f: any) => {
                                if (f.name && !f.name.startsWith('.')) {
                                    documents.push({
                                        name: f.name,
                                        path: `${folderPath}/${f.name}`,
                                    });
                                }
                            });
                        }

                        return {
                            id: child.id,
                            full_name: child.full_name || 'Sin nombre',
                            team_name: teamNameMap.get(child.team_id) || '—',
                            plan_name: childPlanMap.get(child.id) || '—',
                            status: child.status || 'active',
                            has_document: documents.length > 0,
                            documents,
                        };
                    })
            );

            return res.json({ students });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte de documentos');
            return res.status(500).json({ error: 'Error interno obteniendo documentos.' });
        }
    }
);

export default router;
