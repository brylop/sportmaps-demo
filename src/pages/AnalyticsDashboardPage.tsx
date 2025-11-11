import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, TrendingUp, DollarSign, Activity, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AnalyticsDashboardPage() {
  // Demo data for analytics
  const visitorData = [
    { month: 'Ene', visitors: 1200 },
    { month: 'Feb', visitors: 1900 },
    { month: 'Mar', visitors: 2100 },
    { month: 'Abr', visitors: 2500 },
    { month: 'May', visitors: 2800 },
    { month: 'Jun', visitors: 3200 }
  ];

  const enrollmentData = [
    { month: 'Ene', enrollments: 45 },
    { month: 'Feb', enrollments: 62 },
    { month: 'Mar', enrollments: 78 },
    { month: 'Abr', enrollments: 91 },
    { month: 'May', enrollments: 105 },
    { month: 'Jun', enrollments: 120 }
  ];

  const sportDistribution = [
    { name: 'Fútbol', value: 450 },
    { name: 'Baloncesto', value: 280 },
    { name: 'Tenis', value: 190 },
    { name: 'Natación', value: 310 },
    { name: 'Voleibol', value: 120 }
  ];

  const revenueData = [
    { month: 'Ene', revenue: 15000000 },
    { month: 'Feb', revenue: 18500000 },
    { month: 'Mar', revenue: 22000000 },
    { month: 'Abr', revenue: 25500000 },
    { month: 'May', revenue: 28000000 },
    { month: 'Jun', revenue: 32000000 }
  ];

  const topSchools = [
    { name: 'Academia Elite', students: 520, revenue: 45000000 },
    { name: 'Club Champions', students: 410, revenue: 38000000 },
    { name: 'ProMasters', students: 350, revenue: 32000000 },
    { name: 'SportVille', students: 290, revenue: 25000000 },
    { name: 'Athletic Center', students: 180, revenue: 18000000 }
  ];

  const stats = [
    {
      title: 'Total Usuarios',
      value: '12,543',
      change: '+12.5%',
      icon: Users,
      color: 'text-blue-500'
    },
    {
      title: 'Inscripciones Activas',
      value: '3,891',
      change: '+18.2%',
      icon: TrendingUp,
      color: 'text-green-500'
    },
    {
      title: 'Ingresos Mensuales',
      value: '$32,000,000',
      change: '+14.3%',
      icon: DollarSign,
      color: 'text-emerald-500'
    },
    {
      title: 'Visitas al Sitio',
      value: '45,782',
      change: '+8.7%',
      icon: Eye,
      color: 'text-purple-500'
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
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
              <p className="text-xs text-green-500 mt-1">{stat.change} vs mes anterior</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="traffic" className="space-y-4">
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
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={visitorData}>
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
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inscripciones Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={enrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="enrollments" fill="#82ca9d" name="Inscripciones" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Deporte</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={sportDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => `$${value.toLocaleString('es-CO')}`}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Ingresos (COP)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Escuelas por Rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topSchools.map((school, index) => (
              <div key={school.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{school.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {school.students} estudiantes
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${(school.revenue / 1000000).toFixed(1)}M</p>
                  <p className="text-sm text-muted-foreground">Ingresos</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
