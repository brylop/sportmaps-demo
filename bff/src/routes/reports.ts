import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

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

            const allEnrollmentsSet = new Set<string>(); // para estudiantes únicos 

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

            // 3. Obtener Pagos confirmados
            let paymentsQuery = supabase
                .from('payments')
                .select('amount, concept')
                .eq('school_id', schoolId)
                .eq('status', 'paid');

            if (branchFilterId) paymentsQuery = paymentsQuery.eq('branch_id', branchFilterId);

            const { data: payments, error: payError } = await paymentsQuery;
            if (payError) req.log?.warn({ err: payError }, 'Error fetching payments for reports');

            let revenueSum = 0;
            const revenueByConcept = new Map<string, number>();

            (payments || []).forEach((p: any) => {
                const amt = Number(p.amount) || 0;
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

            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const since = sinceDate.toISOString().split('T')[0];

            // 1. Students
            let studentsQuery = supabase
                .from('children')
                .select('id, full_name, status, created_at, team_id, branch_id')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false })
                .limit(500);

            if (branchFilterId) studentsQuery = studentsQuery.eq('branch_id', branchFilterId);

            const { data: studentsRaw, error: studentsErr } = await studentsQuery;
            if (studentsErr) throw studentsErr;

            // Fetch team names separately to avoid join ambiguity
            const studentTeamIds = [...new Set((studentsRaw || []).map((s: any) => s.team_id).filter(Boolean))];
            const teamNameMap = new Map<string, string>();
            if (studentTeamIds.length > 0) {
                const { data: teamRows } = await supabase
                    .from('teams')
                    .select('id, name, monthly_fee')
                    .in('id', studentTeamIds);
                (teamRows || []).forEach((t: any) => {
                    teamNameMap.set(t.id, t.name);
                });
            }

            // Fetch branch names
            const branchIds = [...new Set((studentsRaw || []).map((s: any) => s.branch_id).filter(Boolean))];
            const branchNameMap = new Map<string, string>();
            if (branchIds.length > 0) {
                const { data: branchRows } = await supabase
                    .from('school_branches')
                    .select('id, name')
                    .in('id', branchIds);
                (branchRows || []).forEach((b: any) => branchNameMap.set(b.id, b.name));
            }

            const students = (studentsRaw || []).map((s: any) => ({
                id: s.id,
                full_name: s.full_name || 'Sin nombre',
                team: teamNameMap.get(s.team_id) || '—',
                sede: branchNameMap.get(s.branch_id) || 'Principal',
                status: s.status || 'active',
                fee: 0, // simplified
                joined: s.created_at,
            }));

            // 2. Payments
            let paymentsQuery = supabase
                .from('payments')
                .select('id, amount, status, payment_month, created_at, student_id, branch_id')
                .eq('school_id', schoolId)
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (branchFilterId) paymentsQuery = paymentsQuery.eq('branch_id', branchFilterId);

            const { data: paymentsRaw, error: paymentsErr } = await paymentsQuery;
            if (paymentsErr) throw paymentsErr;

            // Fetch student names for payments
            const payStudentIds = [...new Set((paymentsRaw || []).map((p: any) => p.student_id).filter(Boolean))];
            const studentNameMap = new Map<string, string>();
            if (payStudentIds.length > 0) {
                const { data: childRows } = await supabase
                    .from('children')
                    .select('id, full_name')
                    .in('id', payStudentIds);
                (childRows || []).forEach((c: any) => studentNameMap.set(c.id, c.full_name));
            }

            const payments = (paymentsRaw || []).map((p: any) => ({
                id: p.id,
                student: studentNameMap.get(p.student_id) || 'Desconocido',
                amount: p.amount || 0,
                status: p.status || 'pending',
                month: p.payment_month || '—',
                team: '—',
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
                    const [studRes, coachRes, payRes] = await Promise.all([
                        supabase.from('children').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id),
                        supabase.from('school_members').select('id', { count: 'exact', head: true }).eq('branch_id', sede.id).in('role', ['coach', 'staff']),
                        supabase.from('payments').select('amount').eq('branch_id', sede.id).eq('status', 'paid'),
                    ]);
                    const income = (payRes.data || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
                    return { id: sede.id, name: sede.name, students: studRes.count || 0, coaches: coachRes.count || 0, income };
                })
            );

            // 5. Teams
            let teamsQuery = supabase
                .from('teams')
                .select('id, name, monthly_fee, description')
                .eq('school_id', schoolId);

            if (branchFilterId) teamsQuery = teamsQuery.eq('branch_id', branchFilterId);

            const { data: teamsData, error: teamsErr } = await teamsQuery;
            if (teamsErr) throw teamsErr;

            const teams = await Promise.all(
                (teamsData || []).map(async (p: any) => {
                    const { count } = await supabase
                        .from('children')
                        .select('id', { count: 'exact', head: true })
                        .eq('team_id', p.id);
                    return {
                        id: p.id,
                        name: p.name,
                        students: count || 0,
                        monthly_fee: p.monthly_fee || 0,
                        revenue: (count || 0) * (p.monthly_fee || 0),
                    };
                })
            );

            return res.json({ students, payments, coaches, sedes, teams });

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

            // Match results
            const { data: results, error: resultsErr } = await supabase
                .from('match_results')
                .select('*')
                .eq('team_id', teamId)
                .order('match_date', { ascending: false });

            if (resultsErr) throw resultsErr;

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

            return res.json({
                team: { id: team.id, name: team.name, age_group: team.age_group, sport: team.sport },
                roster: roster || [],
                results: results || [],
                attendance: attendanceReport,
                scorers: [],
            });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en reporte de coach');
            return res.status(500).json({ error: 'Error interno obteniendo reporte del equipo.' });
        }
    }
);

export default router;
