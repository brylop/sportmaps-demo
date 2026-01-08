import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  School, 
  ShoppingBag, 
  Calendar,
  DollarSign,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsData {
  totalRevenue: number;
  enrollments: number;
  productSales: number;
  appointments: number;
  activeUsers: number;
  schools: number;
  revenueByCategory: { name: string; value: number; color: string }[];
  monthlyTrend: { month: string; enrollments: number; sales: number; appointments: number }[];
  topCities: { city: string; users: number }[];
  recentTransactions: { id: string; type: string; amount: number; date: string }[];
}

// SportMaps brand colors
const COLORS = {
  primary: 'hsl(119, 60%, 32%)',
  accent: 'hsl(35, 97%, 55%)',
  green: '#248223',
  orange: '#FB9F1E',
  blue: '#3B82F6',
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch enrollments count
      const { count: enrollmentsCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true });

      // Fetch payments total
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'paid');

      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Fetch orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at');

      const productSales = orders?.reduce((sum, o) => sum + o.total, 0) || 0;

      // Fetch appointments
      const { count: appointmentsCount } = await supabase
        .from('wellness_appointments')
        .select('*', { count: 'exact', head: true });

      // Fetch active users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch schools
      const { count: schoolsCount, data: schoolsData } = await supabase
        .from('schools')
        .select('city', { count: 'exact' });

      // Calculate city distribution
      const cityCount: Record<string, number> = {};
      schoolsData?.forEach((s) => {
        cityCount[s.city] = (cityCount[s.city] || 0) + 1;
      });
      const topCities = Object.entries(cityCount)
        .map(([city, users]) => ({ city, users }))
        .sort((a, b) => b.users - a.users)
        .slice(0, 5);

      // Calculate revenue by category
      const enrollmentRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const appointmentRevenue = (appointmentsCount || 0) * 80000; // Estimated

      setData({
        totalRevenue: totalRevenue + productSales + appointmentRevenue,
        enrollments: enrollmentsCount || 0,
        productSales,
        appointments: appointmentsCount || 0,
        activeUsers: usersCount || 0,
        schools: schoolsCount || 0,
        revenueByCategory: [
          { name: 'Inscripciones', value: enrollmentRevenue, color: COLORS.green },
          { name: 'Tienda', value: productSales, color: COLORS.orange },
          { name: 'Wellness', value: appointmentRevenue, color: COLORS.blue },
        ],
        monthlyTrend: [
          { month: 'Ene', enrollments: 45, sales: 120000, appointments: 12 },
          { month: 'Feb', enrollments: 52, sales: 145000, appointments: 18 },
          { month: 'Mar', enrollments: 68, sales: 180000, appointments: 24 },
          { month: 'Abr', enrollments: 74, sales: 210000, appointments: 28 },
          { month: 'May', enrollments: 85, sales: 250000, appointments: 35 },
          { month: 'Jun', enrollments: 92, sales: 280000, appointments: 42 },
        ],
        topCities,
        recentTransactions: [],
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-spinner h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Panel de Analítica
          </h1>
          <p className="text-muted-foreground">
            Métricas de rendimiento del ecosistema SportMaps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
              <SelectItem value="1y">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <Badge className="bg-primary/20 text-primary">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                12%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.totalRevenue || 0)}</p>
            <p className="text-sm text-muted-foreground">Ingresos totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <School className="h-5 w-5 text-primary" />
              <Badge variant="secondary">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                8%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{data?.enrollments}</p>
            <p className="text-sm text-muted-foreground">Inscripciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="h-5 w-5 text-accent" />
              <Badge className="bg-accent/20 text-accent-foreground">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                24%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data?.productSales || 0)}</p>
            <p className="text-sm text-muted-foreground">Ventas tienda</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <Badge variant="secondary">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                15%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{data?.appointments}</p>
            <p className="text-sm text-muted-foreground">Citas wellness</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <Badge variant="secondary">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                18%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{data?.activeUsers}</p>
            <p className="text-sm text-muted-foreground">Usuarios activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <MapPin className="h-5 w-5 text-red-500" />
              <Badge variant="secondary">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                5%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{data?.schools}</p>
            <p className="text-sm text-muted-foreground">Escuelas</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ingresos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.revenueByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data?.revenueByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {data?.revenueByCategory.map((cat) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tendencia Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="enrollments" 
                    name="Inscripciones"
                    stroke={COLORS.green} 
                    fill={COLORS.green}
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="appointments" 
                    name="Citas"
                    stroke={COLORS.blue} 
                    fill={COLORS.blue}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Sales by City */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Actividad por Ciudad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topCities} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    type="category" 
                    dataKey="city" 
                    stroke="hsl(var(--muted-foreground))"
                    width={100}
                  />
                  <Tooltip />
                  <Bar 
                    dataKey="users" 
                    name="Escuelas"
                    fill={COLORS.green}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métricas Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Ticket Promedio</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-primary">
                {formatCurrency((data?.totalRevenue || 0) / Math.max((data?.enrollments || 1) + (data?.appointments || 1), 1))}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Conversión</span>
                <ArrowUpRight className="h-4 w-4 text-accent" />
              </div>
              <p className="text-xl font-bold text-accent">24.5%</p>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Retención</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold">87%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
