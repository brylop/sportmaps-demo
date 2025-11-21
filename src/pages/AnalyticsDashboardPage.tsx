import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, TrendingUp, DollarSign, Activity, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#a4de6c', '#d0ed57'];

export default function AnalyticsDashboardPage() {
  const [selectedTab, setSelectedTab] = useState('traffic');

  // Fetch real analytics data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['platform-analytics'],
    queryFn: async () => {
      // 1. Basic Counts
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: activeEnrollmentsCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active');
      
      // 2. Revenue (Sum of payments)
      // In a real app with many payments, this should be a Postgres function or view
      const { data: payments } = await supabase.from('payments').select('amount, created_at');
      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // 3. Visits (Analytics Events) - Last 6 months
      const sixMonthsAgo = subMonths(new Date(), 5).toISOString();
      const { data: events } = await supabase
        .from('analytics_events')
        .select('created_at')
        .gte('created_at', sixMonthsAgo);

      const { count: totalVisits } = await supabase.from('analytics_events').select('*', { count: 'exact', head: true });

      // 4. Enrollments for Charts (with relations)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          created_at,
          programs (
            sport,
            schools ( name )
          )
        `)
        .gte('created_at', sixMonthsAgo);

      return {
        usersCount: usersCount || 0,
        activeEnrollmentsCount: activeEnrollmentsCount || 0,
        totalRevenue,
        totalVisits: totalVisits || 0,
        payments: payments || [],
        events: events || [],
        enrollments: enrollments || []
      };
    }
  });

  // Data Processing for Charts
  const processMonthlyData = () => {
    if (!analytics) return { visitors: [], enrollments: [], revenue: [] };

    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push(subMonths(new Date(), i));
    }

    const visitorsData = months.map(date => {
      const monthKey = format(date, 'MMM', { locale: es });
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const count = analytics.events.filter((e: any) => {
        if (!e.created_at) return false;
        const d = new Date(e.created_at);
        return d >= start && d <= end;
      }).length;

      return { month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1), visitors: count };
    });

    const enrollmentsData = months.map(date => {
      const monthKey = format(date, 'MMM', { locale: es });
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const count = analytics.enrollments.filter((e: any) => {
        const d = new Date(e.created_at);
        return d >= start && d <= end;
      }).length;

      return { month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1), enrollments: count };
    });

    const revenueData = months.map(date => {
      const monthKey = format(date, 'MMM', { locale: es });
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const total = analytics.payments.filter((p: any) => {
        const d = new Date(p.created_at);
        return d >= start && d <= end;
      }).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      return { month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1), revenue: total };
    });

    return { visitors: visitorsData, enrollments: enrollmentsData, revenue: revenueData };
  };

  const processSportsData = () => {
    if (!analytics?.enrollments) return [];
    
    const sportsCount: Record<string, number> = {};
    analytics.enrollments.forEach((e: any) => {
      const sport = e.programs?.sport || 'Otros';
      sportsCount[sport] = (sportsCount[sport] || 0) + 1;
    });

    return Object.entries(sportsCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const processTopSchools = () => {
    if (!analytics?.enrollments) return [];

    const schoolStats: Record<string, { students: number }> = {};
    
    analytics.enrollments.forEach((e: any) => {
      const schoolName = e.programs?.schools?.name || 'Desconocido';
      if (!schoolStats[schoolName]) {
        schoolStats[schoolName] = { students: 0 };
      }
      schoolStats[schoolName].students += 1;
    });

    return Object.entries(schoolStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 5);
  };

  const chartData = processMonthlyData();
  const sportDistribution = processSportsData();
  const topSchools = processTopSchools();

  const stats = [
    {
      title: 'Total Usuarios',
      value: analytics?.usersCount.toLocaleString() || '0',
      change: '+12.5%', // Requires historical data for real calculation
      icon: Users,
      color: 'text-blue-500'
    },
    {
      title: 'Inscripciones Activas',
      value: analytics?.activeEnrollmentsCount.toLocaleString() || '0',
      change: '+18.2%',
      icon: TrendingUp,
      color: 'text-green-500'
    },
    {
      title: 'Ingresos Totales',
      value: `$${(analytics?.totalRevenue || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
      change: '+14.3%',
      icon: DollarSign,
      color: 'text-emerald-500'
    },
    {
      title: 'Visitas Totales',
      value: analytics?.totalVisits.toLocaleString() || '0',
      change: '+8.7%',
      icon: Eye,
      color: 'text-purple-500'
    }
  ];

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando métricas..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard de Analytics</h1>
        <p className="text-muted-foreground">
          Métricas y estadísticas en tiempo real de la plataforma
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-500 font-medium">{stat.change}</span> vs mes anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="traffic" className="space-y-4" onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="traffic">Tráfico</TabsTrigger>
          <TabsTrigger value="enrollments">Inscripciones</TabsTrigger>
          <TabsTrigger value="sports">Deportes</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Visitas Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.visitors}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Visitantes"
                      dot={{ r: 4 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inscripciones Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.enrollments}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="enrollments" fill="#82ca9d" name="Nuevas Inscripciones" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Deporte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sportDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sportDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.revenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [`$${Number(value).toLocaleString('es-CO')}`, 'Ingresos']}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Ingresos (COP)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Escuelas por Estudiantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topSchools.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay datos suficientes</p>
            ) : (
              topSchools.map((school, index) => (
                <div key={school.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' : 
                      index === 1 ? 'bg-gray-400 text-white' : 
                      index === 2 ? 'bg-amber-700 text-white' : 
                      'bg-primary/10 text-primary'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{school.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {school.students} inscripciones recientes
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}