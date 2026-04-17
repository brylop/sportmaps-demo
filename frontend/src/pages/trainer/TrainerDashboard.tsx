import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, DollarSign, Clock, ArrowRight, TrendingUp, Star } from 'lucide-react';

export default function TrainerDashboard() {
  const { trainerProfile, trainerSchoolId, isPersonalTrainer } = useTrainerContext();
  const { profile } = useAuth();

  const [stats, setStats] = useState({
    activeClients: 0,
    todaySessions: 0,
    pendingPayments: 0,
    upcomingSessions: 0,
  });

  useEffect(() => {
    if (!trainerSchoolId) return;

    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0]; // '2026-04-16'

      // 1. Sesiones de HOY desde attendance_sessions (tiene session_date)
      const { data: todaySessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('school_id', trainerSchoolId)
        .eq('session_date', today);

      const todaySessionIds = todaySessions?.map(s => s.id) ?? [];

      // 2. Sesiones PRÓXIMAS (hoy en adelante) desde attendance_sessions
      const { data: upcomingSessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('school_id', trainerSchoolId)
        .gte('session_date', today);

      const upcomingSessionIds = upcomingSessions?.map(s => s.id) ?? [];

      // Placeholder UUID para evitar query con array vacío
      const EMPTY = ['00000000-0000-0000-0000-000000000000'];

      const [enrollmentsRes, bookingsTodayRes, pendingPayRes, upcomingRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', trainerSchoolId)
          .eq('status', 'active'),

        supabase
          .from('session_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', trainerSchoolId)
          .in('session_id', todaySessionIds.length > 0 ? todaySessionIds : EMPTY),

        supabase
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', trainerSchoolId)
          .eq('status', 'pending'),

        supabase
          .from('session_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', trainerSchoolId)
          .in('session_id', upcomingSessionIds.length > 0 ? upcomingSessionIds : EMPTY),
      ]);

      setStats({
        activeClients:    enrollmentsRes.count    ?? 0,
        todaySessions:    bookingsTodayRes.count  ?? 0,
        pendingPayments:  pendingPayRes.count     ?? 0,
        upcomingSessions: upcomingRes.count       ?? 0,
      });
    };

    fetchStats();
  }, [trainerSchoolId]);

  const displayName = trainerProfile?.display_name || profile?.full_name || 'Entrenador';

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">¡Hola, {displayName.split(' ')[0]}! 👋</h1>
          <p className="text-muted-foreground text-sm">Este es el resumen de tu negocio hoy.</p>
        </div>
        {trainerProfile && !trainerProfile.is_published && (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 gap-1.5 self-start sm:self-auto">
            <Star className="h-3 w-3" />
            Perfil no publicado
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes activos', value: stats.activeClients, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', href: '/trainer/clients' },
          { label: 'Sesiones hoy', value: stats.todaySessions, icon: Clock, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', href: '/trainer/availability' },
          { label: 'Pagos pendientes', value: stats.pendingPayments, icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', href: '/trainer/payments' },
          { label: 'Próximas sesiones', value: stats.upcomingSessions, icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', href: '/trainer/availability' },
        ].map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <Card className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border-border/50">
              <CardContent className="p-4">
                <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Gestionar disponibilidad', href: '/trainer/availability', icon: Calendar },
            { label: 'Ver mis planes', href: '/trainer/plans', icon: TrendingUp },
            { label: 'Editar mi perfil', href: '/trainer/profile', icon: Star },
          ].map((action) => (
            <Link key={action.href} to={action.href}>
              <Button variant="outline" className="w-full justify-start gap-3 h-11 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <action.icon className="h-4 w-4 text-primary" />
                <span className="text-sm">{action.label}</span>
                <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Profile completeness nudge */}
      {trainerProfile && !trainerProfile.is_published && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Completa tu perfil público</p>
              <p className="text-xs text-muted-foreground mt-0.5">Publica tu perfil para que otros usuarios puedan encontrarte y reservar sesiones contigo.</p>
            </div>
            <Link to="/trainer/profile">
              <Button size="sm" className="whitespace-nowrap">Completar perfil</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
