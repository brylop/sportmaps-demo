import { useRef, useState, useEffect } from 'react';
import { studentsAPI } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { todayColombia } from '@/lib/dateUtils';

export interface DashboardStats {
  // School stats
  students_count?: number;
  active_students?: number;
  classes_count?: number;
  active_classes?: number;
  total_enrolled?: number;
  monthly_revenue?: number;
  pending_payments?: number;
  coaches_count?: number;
  plans_count?: number;

  // Parent stats
  children?: number;
  children_attendance?: string;
  upcoming_payments?: number;

  // Coach stats
  my_classes?: number;
  my_students?: number;

  // Common
  notifications?: number;
  unreadNotifications?: number;
  messages?: number;
  activeTeams?: number;
  upcomingEvents?: number;
  attendanceRate?: number;
}

export function useDashboardStatsReal() {
  const { profile, user, loading: authLoading } = useAuth();
  const { schoolId, activeBranchId } = useSchoolContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Identidad de la carga: cambia solo cuando cambia algo que altera el resultado.
  // La dependencia del efecto era `profile` (el objeto), así que cada identidad
  // nueva que emitiera AuthContext redisparaba la tanda completa de consultas
  // aunque el usuario fuera el mismo.
  const statsKey = [
    profile?.id ?? '', profile?.role ?? '', schoolId ?? '', activeBranchId ?? '',
  ].join('|');

  // Hacen falta las tres: `inFlight` corta la carga duplicada, `loaded` evita
  // repetir una que ya terminó, y `latest` descarta la que llegó tarde. Bloquear a
  // secas perdería el resultado cuando cambian de sede en medio de una carga.
  const inFlightKeyRef = useRef<string | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const latestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    latestKeyRef.current = statsKey;

    // Sin perfil no hay stats que pedir. Se distingue "auth todavía resolviendo"
    // —seguir en loading, que el efecto vuelve cuando llegue el perfil porque
    // `profile?.id` es parte de la clave— de "no hay perfil", donde hay que cortar
    // el spinner. Antes seguía de largo con el perfil en null y la rama de acudiente
    // reventaba leyendo `profile.role`.
    if (!profile) {
      if (!authLoading) setLoading(false);
      return;
    }

    if (!schoolId && profile.role !== 'coach' && profile.role !== 'parent') {
      setLoading(false);
      return;
    }

    // El guard anterior era código muerto para el caso escuela: solo hacía
    // `return` cuando NO había schoolId, que es justo cuando no se cargaba nada.
    // Con schoolId presente entraban corridas concurrentes.
    if (inFlightKeyRef.current === statsKey || loadedKeyRef.current === statsKey) return;

    loadStats(statsKey);
  }, [statsKey, authLoading]);

  const loadStats = async (key: string) => {
    /** La carga dejó de ser la vigente: su resultado ya no se escribe. */
    const isStale = () => latestKeyRef.current !== key;

    try {
      inFlightKeyRef.current = key;
      setLoading(true);

      if (profile?.role === 'school' || (profile?.role as any) === 'school_admin' || profile?.role === 'admin' || (profile?.role as any) === 'super_admin' || profile?.role === 'coach') {
        // Primer día del mes en curso, hora Colombia. `new Date()` local sirve en
        // un navegador colombiano, pero el mes se compara contra `payment_date`,
        // que es una columna `date`: se arma como string para no meter husos.
        const startOfMonth = `${todayColombia().slice(0, 7)}-01`;

        // Revenue query with branch filter - only if schoolId exists
        let monthlyRevenue = 0;
        let pendingCount = 0;
        let coachesCount = 0;
        let plansCount = 0;

        if (schoolId) {
          // "Ingresos del Mes" = plata que ENTRÓ este mes, así que el eje es
          // `payment_date` (cuándo se pagó), no `created_at` (cuándo se emitió
          // el cobro). Con `created_at` agosto de Dynasty mostraba $6.660.000 en
          // vez de $13.900.000: se caían los 48 pagos de agosto sobre cobros
          // generados en julio, que es el caso NORMAL de una mensualidad.
          // `partial` cuenta por lo abonado, no por el total del cobro.
          let revenueQuery = supabase
            .from('payments')
            .select('amount, amount_paid, status')
            .eq('school_id', schoolId)
            .in('status', ['paid', 'partial'])
            .gte('payment_date', startOfMonth);

          // Un pago sin sede asignada no es "de otra sede": con `.eq()` se caían
          // 44 de los 89 pagos de agosto al seleccionar sede. Mismo criterio que
          // Finanzas y Gestión de Pagos.
          if (activeBranchId) {
            revenueQuery = revenueQuery.or(`branch_id.is.null,branch_id.eq.${activeBranchId}`);
          }

          const { data: revenueData } = await (revenueQuery as any);
          monthlyRevenue = revenueData?.reduce(
            (sum: number, p: any) => sum + Number(p.status === 'partial' ? (p.amount_paid ?? 0) : p.amount),
            0,
          ) || 0;

          // Pending payments query with branch filter
          let pendingQuery = supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .in('status', ['pending', 'awaiting_approval']);

          if (activeBranchId) {
            pendingQuery = pendingQuery.eq('branch_id', activeBranchId);
          }

          const { count: pendingCountRes } = await (pendingQuery as any);
          pendingCount = pendingCountRes || 0;

          // Coaches count from school_staff
          let coachQuery = supabase
            .from('school_staff')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('status', 'active');

          if (activeBranchId) {
            coachQuery = coachQuery.eq('branch_id', activeBranchId);
          }

          const { count: coachCountRes } = await (coachQuery as any);
          coachesCount = coachCountRes || 0;

          // Plans count from offering_plans
          // `offering_plans` NO tiene branch_id: la sede vive en el offering
          // padre. Filtrar por branch_id acá devolvía 400 de PostgREST
          // ("column offering_plans.branch_id does not exist") y el contador de
          // planes quedaba en 0 en cada carga del dashboard.
          let branchOfferingIds: string[] | null = null;
          if (activeBranchId) {
            const { data: branchOfferings } = await supabase
              .from('offerings')
              .select('id')
              .eq('school_id', schoolId)
              // Las escuelas de una sola sede dejan branch_id en NULL: sin esta
              // rama del OR perderían todos sus planes.
              .or(`branch_id.eq.${activeBranchId},branch_id.is.null`);
            branchOfferingIds = (branchOfferings || []).map((o: any) => o.id);
          }

          if (branchOfferingIds && branchOfferingIds.length === 0) {
            plansCount = 0;
          } else {
            let plansQuery = supabase
              .from('offering_plans' as any)
              .select('id', { count: 'exact', head: true })
              .eq('school_id', schoolId)
              .eq('is_active', true);

            if (branchOfferingIds) {
              plansQuery = (plansQuery as any).in('offering_id', branchOfferingIds);
            }

            const { count: plansCountRes } = await (plansQuery as any);
            plansCount = plansCountRes || 0;
          }
        }

        const isCoach = profile?.role === 'coach';
        let coachIdFilter = undefined;

        if (isCoach && user?.email) {
          let staffQuery = supabase
            .from('school_staff')
            .select('id')
            .eq('email', user.email);
          if (schoolId) {
            staffQuery = staffQuery.eq('school_id', schoolId);
          }
          const { data: staffData } = await staffQuery.maybeSingle();

          if (staffData) {
            coachIdFilter = staffData.id;
          }
        }

        // Note: studentsAPI and classesAPI might need branchId support too
        // If schoolId is null but it's a coach, we can still get stats for that coach
        const [studentStats, classStats] = await Promise.all([
          schoolId
            ? studentsAPI.getStats(schoolId, activeBranchId, coachIdFilter)
            : Promise.resolve({ total: 0, active: 0, inactive: 0, by_grade: {} }),
          schoolId
            ? classesAPI.getStats(schoolId, activeBranchId, coachIdFilter)
            : Promise.resolve({ total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 }),
        ]).catch((err) => {
          console.error("Error fetching dashboard stats:", err);
          return [{ total: 0, active: 0, inactive: 0, by_grade: {} }, { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 }];
        });

        // Fetch upcoming events for coach from calendar_events (same source as módulo Calendario)
        let upcomingEventsCount = 0;
        if (isCoach && user?.id) {
          const now = new Date().toISOString();
          const { count: eventCount } = await (supabase
            .from('calendar_events' as any)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('start_time', now) as any);
          upcomingEventsCount = eventCount || 0;
        }

        // Calcular asistencia real del coach
        let attendanceRate = 0;
        if (isCoach && coachIdFilter) {
          // Separate queries instead of invalid OR syntax
          const [{ data: teamsDirecta }, { data: teamsRelacion }] = await Promise.all([
            supabase.from('teams').select('id').eq('coach_id', coachIdFilter),
            supabase.from('team_coaches').select('team_id').eq('coach_id', coachIdFilter),
          ]);

          const teamIds = [
            ...(teamsDirecta || []).map((t: any) => t.id),
            ...(teamsRelacion || []).map((t: any) => t.team_id),
          ].filter((id, i, arr) => arr.indexOf(id) === i); // deduplicar
          // Calcular asistencia real del coach via BFF (Bypassa RLS interno)
          if (teamIds.length > 0) {
            try {
              const json = await bffClient.get<{ rate: number }>(
                `/api/v1/attendance/rate/${teamIds[0]}`
              );
              attendanceRate = json.rate || 0;
            } catch (err) {
              console.error('Error obteniendo tasa de asistencia del coach:', err);
            }
          }
        }

        if (isStale()) return;
        setStats({
          students_count: studentStats.total,
          active_students: studentStats.active,
          classes_count: classStats.total,
          active_classes: classStats.active,
          total_enrolled: classStats.total_enrolled,
          monthly_revenue: monthlyRevenue,
          pending_payments: pendingCount || 0,
          coaches_count: coachesCount,
          plans_count: plansCount,
          activeTeams: classStats.active,
          notifications: 0,
          upcomingEvents: upcomingEventsCount,
          attendanceRate,
        });
      } else if (profile.role === 'parent') {
        // Load parent-specific stats
        const { data: childrenData, count: childrenCount } = await (supabase
          .from('children') as any)
          .select('id', { count: 'exact' })
          .eq('parent_id', profile.id);

        const childIds = childrenData?.map(c => c.id) || [];

        // Fetch last 30 days attendance for all children
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);

        const { data: attendanceData } = await (supabase
          .from('attendance_records') as any)
          .select('status')
          .in('child_id', childIds)
          .gte('attendance_date', lastMonth.toISOString().split('T')[0]);

        const totalAttendance = attendanceData?.length || 0;
        const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
        const attendancePercentage = totalAttendance > 0
          ? Math.round((presentCount / totalAttendance) * 100)
          : 0;

        // Upcoming payments
        const { count: upcomingPayments } = await (supabase
          .from('payments') as any)
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', profile.id)
          .in('status', ['pending', 'awaiting_approval']);

        // Unread notifications
        const { count: unreadNotifications } = await (supabase
          .from('notifications') as any)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('read', false);

        if (isStale()) return;
        setStats({
          children: childrenCount || 0,
          children_attendance: `${attendancePercentage}%`,
          upcoming_payments: upcomingPayments || 0,
          unreadNotifications: unreadNotifications || 0,
        });
      }

      // Solo al terminar bien: si falló, un efecto posterior puede reintentar.
      loadedKeyRef.current = key;
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      if (!isStale()) setStats(null);
    } finally {
      if (inFlightKeyRef.current === key) inFlightKeyRef.current = null;
      if (!isStale()) setLoading(false);
    }
  };

  return {
    stats,
    loading,
    // `refresh` es una recarga pedida a mano: se salta el guard de "ya cargada".
    refresh: () => { loadedKeyRef.current = null; return loadStats(statsKey); },
  };
}
