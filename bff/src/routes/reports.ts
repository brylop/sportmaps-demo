import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// Middleware helper to determine which branch_id to filter by.
// Enforces security so school_admin cannot request data for another branch.
const getBranchFilter = (req: AuthenticatedRequest): string | null => {
    // If the user is a school_admin, they are strictly locked to their own branch.
    if (req.role === 'school_admin') {
        return req.branchId;
    }
    // For global admins (owner, super_admin, auditor, etc.), they can optionally pass a branch_id query param
    const queryBranchId = req.query.branch_id as string;
    if (queryBranchId && queryBranchId !== 'undefined' && queryBranchId !== 'null') {
        return queryBranchId;
    }
    // Global admins without a branch_id query get data for all branches.
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

            // 1. Obtener equipos (Teams) para la Capacidad Total
            let teamsQuery = supabase
                .from('teams')
                .select('name, max_students')
                .eq('school_id', schoolId)
                .eq('status', 'active'); // o ignorar status si se requiere histórico? Dejaremos activos.

            if (branchFilterId) {
                teamsQuery = teamsQuery.eq('branch_id', branchFilterId);
            }

            const { data: allPrograms, error: teamsError } = await teamsQuery;
            if (teamsError) throw teamsError;

            let realTotalCapacity = 0;
            const programCapacityMap = new Map<string, number>();

            (allPrograms || []).forEach((p: any) => {
                const pname = p.name || 'Varios';
                const pcap = p.max_students || 0;
                realTotalCapacity += pcap;
                programCapacityMap.set(pname, (programCapacityMap.get(pname) || 0) + pcap);
            });

            // 2. Obtener inscripciones (Enrollments) para Ocupación y Crecimiento
            // Usando un inner join con equipos filtrados por la escuela (y sede)
            let enrollmentsQuery = supabase
                .from('enrollments')
                .select(`
                    status, 
                    created_at, 
                    teams!inner (
                        name, 
                        max_students, 
                        school_id,
                        branch_id
                    )
                `)
                .eq('teams.school_id', schoolId);

            if (branchFilterId) {
                enrollmentsQuery = enrollmentsQuery.eq('teams.branch_id', branchFilterId);
            }

            const { data: enrollmentsData, error: enrollError } = await enrollmentsQuery as any;
            if (enrollError) throw enrollError;

            const enrollments = enrollmentsData || [];

            // --- Calcular Ocupación ---
            let totalStudents = 0;
            const programOccupiedMap = new Map<string, number>();

            enrollments.forEach((e: any) => {
                if (e.status === 'active') {
                    const pName = e.teams?.name || 'Varios';
                    programOccupiedMap.set(pName, (programOccupiedMap.get(pName) || 0) + 1);
                    totalStudents++;
                }
            });

            const occupancyData = Array.from(programCapacityMap.entries()).map(([name, capacity]) => {
                const occupied = programOccupiedMap.get(name) || 0;
                return {
                    name,
                    occupied,
                    vacant: Math.max(0, capacity - occupied)
                };
            }).slice(0, 10); // Top 10

            // --- Calcular Crecimiento (últimos 6 meses) ---
            const growthMap = new Map<string, { nuevos: number, retiros: number, sortKey: number }>();
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const now = new Date();

            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const mKey = `${months[d.getMonth()]}`;
                growthMap.set(mKey, { nuevos: 0, retiros: 0, sortKey: d.getTime() });
            }

            let netGrowthThisMonth = 0;
            const currentMonthIndex = now.getMonth();
            const currentYear = now.getFullYear();

            enrollments.forEach((e: any) => {
                const d = new Date(e.created_at);
                const mKey = `${months[d.getMonth()]}`;
                const eMonth = d.getMonth();
                const eYear = d.getFullYear();

                if (growthMap.has(mKey)) {
                    if (e.status === 'active') {
                        growthMap.get(mKey)!.nuevos++;
                        if (eMonth === currentMonthIndex && eYear === currentYear) {
                            netGrowthThisMonth++;
                        }
                    } else if (e.status === 'inactive' || e.status === 'dropped') {
                        growthMap.get(mKey)!.retiros++;
                    }
                }
            });

            // Sort correctly by time and remove sortKey
            const growthDataList = Array.from(growthMap.entries())
                .sort((a, b) => a[1].sortKey - b[1].sortKey)
                .map(([month, data]) => ({ month, nuevos: data.nuevos, retiros: data.retiros }));

            // 3. Obtener Pagos para Revenue Mensual (solo del mes actual confirmados? o todos para gráfica de dona por concepto)
            let paymentsQuery = supabase
                .from('payments')
                .select('amount, concept')
                .eq('school_id', schoolId)
                .eq('status', 'paid');

            if (branchFilterId) {
                paymentsQuery = paymentsQuery.eq('branch_id', branchFilterId);
            }

            // NOTE: This usually brings all historical payments which is good for the pie chart.
            // If we strictly want the current month for the KPI summary, we filter in JS.
            const { data: payments, error: payError } = await paymentsQuery;
            if (payError) req.log?.warn({ err: payError }, 'Error fetching payments for reports');

            const validPayments = payments || [];
            let totalRevenueThisMonth = 0; // The KPI shows "Ingresos Mensuales Confirmados este mes". We need current month logic.

            // Re-fetch only current month payments for the revenueSum, or we could just filter.
            // But JS filter is safer if we also need pie chart from all time... wait, the original code did NOT filter by month.
            // Let's replicate original logic: total revenue of ALL time for the big KPI, or maybe it was intended for the month.
            // Let's just sum all for now to match exactly what it did.
            let revenueSum = 0;
            const revenueByConcept = new Map<string, number>();

            validPayments.forEach((p: any) => {
                const amt = Number(p.amount) || 0;
                revenueSum += amt;

                const conceptShort = p.concept?.split('-')[0]?.trim() || 'General';
                revenueByConcept.set(conceptShort, (revenueByConcept.get(conceptShort) || 0) + amt);
            });

            const revenueData = Array.from(revenueByConcept.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            // Respuesta Unificada
            return res.json({
                summary: {
                    occupancyRate: realTotalCapacity > 0 ? ((totalStudents / realTotalCapacity) * 100).toFixed(1) : '0',
                    totalStudents,
                    totalCapacity: realTotalCapacity,
                    totalRevenue: revenueSum,
                    netGrowth: netGrowthThisMonth
                },
                charts: {
                    occupancyData,
                    growthData: growthDataList,
                    revenueData
                }
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

            // Date for payments filter
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const since = sinceDate.toISOString().split('T')[0];

            // 1. Fetch Students
            let studentsQuery = supabase
                .from('children')
                .select(`
                    id, full_name, status, created_at,
                    teams!inner(name, monthly_fee, branch_id),
                    school_branches:branch_id (name)
                `)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });

            if (branchFilterId) {
                studentsQuery = studentsQuery.eq('teams.branch_id', branchFilterId);
            }

            const { data: studentsData, error: studentsErr } = await studentsQuery as any;
            if (studentsErr) throw studentsErr;

            const students = (studentsData || []).map((s: any) => ({
                id: s.id,
                full_name: s.full_name || 'Sin nombre',
                program: s.teams?.name || '—',
                sede: s.school_branches?.name || 'Principal',
                status: s.status || 'active',
                fee: s.teams?.monthly_fee || 0,
                joined: s.created_at
            }));

            // 2. Fetch Payments
            let paymentsQuery = supabase
                .from('payments')
                .select(`
                    id, amount, status, payment_month, created_at,
                    children:student_id (full_name),
                    teams!inner(name, branch_id)
                `)
                .eq('school_id', schoolId)
                .gte('created_at', since)
                .order('created_at', { ascending: false });

            if (branchFilterId) {
                // If branch_id doesn't exist on payments we might need to rely on teams!inner filtering...
                // But payments table has branch_id!
                paymentsQuery = paymentsQuery.eq('branch_id', branchFilterId);
            }

            const { data: paymentsData, error: paymentsErr } = await paymentsQuery as any;
            if (paymentsErr) throw paymentsErr;

            const payments = (paymentsData || []).map((p: any) => ({
                id: p.id,
                student: p.children?.full_name || 'Desconocido',
                amount: p.amount || 0,
                status: p.status || 'pending',
                month: p.payment_month || '—',
                program: p.teams?.name || '—',
            }));

            // 3. Fetch Coaches
            let coachesQuery = supabase
                .from('school_members')
                .select(`
                    id, role,
                    profiles:user_id (full_name, email),
                    teams (name),
                    school_branches:branch_id (name)
                `)
                .eq('school_id', schoolId)
                .in('role', ['coach', 'staff']);

            if (branchFilterId) {
                coachesQuery = coachesQuery.eq('branch_id', branchFilterId);
            }

            const { data: coachesData, error: coachesErr } = await coachesQuery as any;
            if (coachesErr) throw coachesErr;

            const coaches = (coachesData || []).map((m: any) => ({
                id: m.id,
                name: m.profiles?.full_name || 'Sin nombre',
                email: m.profiles?.email || '—',
                program: m.teams?.name || '—',
                sede: m.school_branches?.name || 'Principal',
                students: 0, // Simplified for now
            }));

            // 4. Fetch Sedes
            let sedesQuery = supabase
                .from('school_branches')
                .select('id, name')
                .eq('school_id', schoolId);

            if (branchFilterId) {
                sedesQuery = sedesQuery.eq('id', branchFilterId);
            }

            const { data: sedesData, error: sedesErr } = await sedesQuery;
            if (sedesErr) throw sedesErr;

            const sedes = await Promise.all(
                (sedesData || []).map(async (sede: any) => {
                    const [studRes, coachRes, payRes] = await Promise.all([
                        supabase.from('children').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id),
                        supabase.from('school_members').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id).in('role', ['coach', 'staff']),
                        supabase.from('payments').select('amount').eq('branch_id', sede.id).eq('status', 'paid'),
                    ]);
                    const income = (payRes.data || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
                    return {
                        id: sede.id,
                        name: sede.name,
                        students: studRes.count || 0,
                        coaches: coachRes.count || 0,
                        income,
                    };
                })
            );

            // 5. Fetch Programs
            let programsQuery = supabase
                .from('teams')
                .select('id, name, monthly_fee, description')
                .eq('school_id', schoolId);

            if (branchFilterId) {
                programsQuery = programsQuery.eq('branch_id', branchFilterId);
            }

            const { data: programsData, error: programsErr } = await programsQuery;
            if (programsErr) throw programsErr;

            const programs = await Promise.all(
                (programsData || []).map(async (p: any) => {
                    const { count } = await supabase
                        .from('children')
                        .select('id', { count: 'exact', head: true })
                        .eq('program_id', p.id);
                    return {
                        id: p.id,
                        name: p.name,
                        students: count || 0,
                        monthly_fee: p.monthly_fee || 0,
                        revenue: (count || 0) * (p.monthly_fee || 0),
                    };
                })
            );

            return res.json({
                students,
                payments,
                coaches,
                sedes,
                programs
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
    requireRole('owner', 'super_admin', 'admin', 'auditor', 'reporter', 'coach', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { teamId } = req.params;
            const { schoolId } = req;

            // 1. Basic Team Info
            const { data: team, error: teamErr } = await supabase
                .from('teams')
                .select('id, name, age_group, sport, coach_id, school_id')
                .eq('id', teamId)
                .single();

            if (teamErr || !team) {
                return res.status(404).json({ error: 'Equipo no encontrado.' });
            }

            // Authorization check
            if (req.role === 'school_admin' && team.school_id !== schoolId) {
                return res.status(403).json({ error: 'No tienes permiso para ver este equipo.' });
            }

            // 2. Fetch Roster
            const { data: roster, error: rosterErr } = await supabase
                .from('team_members')
                .select('id, player_name, player_number, position, profile_id')
                .eq('team_id', teamId);

            if (rosterErr) throw rosterErr;

            // 3. Fetch Match Results
            const { data: results, error: resultsErr } = await supabase
                .from('match_results')
                .select('*')
                .eq('team_id', teamId)
                .order('match_date', { ascending: false });

            if (resultsErr) throw resultsErr;

            // 4. Fetch Attendance Stats
            const { data: attendance, error: attendanceErr } = await supabase
                .from('attendance_records')
                .select('status, child_id')
                .eq('program_id', teamId);

            if (attendanceErr) throw attendanceErr;

            const attendanceByPlayer: Record<string, { present: number, total: number }> = {};
            attendance.forEach(record => {
                if (!attendanceByPlayer[record.child_id]) {
                    attendanceByPlayer[record.child_id] = { present: 0, total: 0 };
                }
                attendanceByPlayer[record.child_id].total++;
                if (record.status === 'present' || record.status === 'late') {
                    attendanceByPlayer[record.child_id].present++;
                }
            });

            const attendanceStats = Object.entries(attendanceByPlayer).map(([childId, stats]) => ({
                childId,
                percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
            }));

            const { data: children } = await supabase
                .from('children')
                .select('id, full_name')
                .eq('team_id', teamId);

            const attendanceReport = (children || []).map(child => {
                const stat = attendanceStats.find(s => s.childId === child.id);
                return {
                    name: child.full_name,
                    percentage: stat ? stat.percentage : 0
                };
            }).sort((a, b) => b.percentage - a.percentage);

            return res.json({
                team: {
                    id: team.id,
                    name: team.name,
                    age_group: team.age_group,
                    sport: team.sport
                },
                roster: roster || [],
                results: results || [],
                attendance: attendanceReport,
                scorers: []
            });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte de coach');
            return res.status(500).json({ error: 'Error interno obteniendo reporte del equipo.' });
        }
    }
);

export default router;
